# Deploying NEU TV

Setting up a new domain from scratch. Follow the order — each step verifies the
one before it, and skipping ahead is how the last attempt broke.

## The rule that matters

**One hostname, one system.** Two hostnames are needed and they can never be the
same name:

| Hostname | Points at | Serves |
| --- | --- | --- |
| `api.example.com` | the VPS, and nothing else | API, admin API, live HLS |
| `cdn.example.com` | Fastly, and nothing else | video from Cloudinary |

The previous setup pointed one name at both the VPS and Fastly. DNS handed out
both addresses, Fastly answered with its default certificate
(`x.sni-498-default.ssl.fastly.net`), and every request that landed there failed
TLS. The backend was healthy the whole time and nothing in its logs said
otherwise. That is the failure this document is ordered to prevent.

Pick your two names now and use them consistently. `api.` and `cdn.` are fine;
what matters is that they are different.

---

## 1. DNS

Create one record. Only one.

```
api.example.com    A    <your VPS IP>
```

Leave the CDN alone for now — it comes after the origin works. Then:

```bash
cd backend
npm run check:domain -- --api api.example.com
```

It fails until DNS propagates, and it fails loudly if the name resolves to more
than one address. Do not continue until it passes. It queries 1.1.1.1 and 8.8.8.8
rather than your machine's resolver, because a stale local cache is exactly what
makes a broken record look fixed.

---

## 2. The server

```bash
git clone https://github.com/Olagold-hackxx/NeuTV.git /opt/neutv
cd /opt/neutv
cp deploy/.env.example .env
```

Fill in `.env`. The required ones:

```bash
API_DOMAIN=api.example.com          # must match DNS and step 3 exactly
POSTGRES_PASSWORD=<long random>
NEUTV_ADMIN_EMAILS=you@example.com
```

Then:

```bash
docker compose up -d
docker compose logs -f api          # wait for "NEU TV gateway on ..."
```

The catalog seeds itself on first boot — 12 posts, 12 spotlights, the products,
hubs and schedule. It seeds once, so restarts and redeploys do not duplicate it.

---

## 3. TLS

If the VPS already runs Caddy, generate the site block and **append** it:

```bash
cd backend
npm run deploy:caddy -- --api api.example.com | sudo tee -a /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

**Append, never replace.** `>>` not `>`. A VPS is rarely serving one thing, and
overwriting `/etc/caddy/Caddyfile` takes every other site on the machine down.
Reload rather than restart, so open connections are not dropped.

If Caddy is *not* already on the box, the compose file includes one and this step
is unnecessary.

Verify:

```bash
npm run check:domain -- --api api.example.com
curl https://api.example.com/health
```

You want `{"ok":true,...}` and a certificate issued by Let's Encrypt.

---

## 4. The admin account

```bash
docker compose exec api npm run admin:create -- --email you@example.com --generate
```

It prints a password once. The email must already be in `NEUTV_ADMIN_EMAILS` —
the script refuses otherwise, so it cannot mint an administrator the deployment
has not authorised. Running it again **resets** the password and revokes live
sessions, so run it once and keep what it gives you.

---

## 5. The front ends

Both deploy to Vercel from the same repo, with different root directories:

| Project | Root directory | Env |
| --- | --- | --- |
| viewer | `web` | `NEUTV_API_BASE=https://api.example.com` |
| admin | `admin` | `NEUTV_API_BASE=https://api.example.com` |

The hostname now appears in three places and must match in all of them: DNS, the
Caddy site block, and `NEUTV_API_BASE` on both Vercel projects.

---

## 6. Video, and only now the CDN

Video never touches the VPS. Cloudinary stores and transcodes; Fastly caches.

**6a. Cloudinary.** Put the credentials in `.env` and restart the API:

```bash
NEUTV_MEDIA_DRIVER=cloudinary
NEUTV_CLOUDINARY_CLOUD_NAME=
NEUTV_CLOUDINARY_API_KEY=
NEUTV_CLOUDINARY_API_SECRET=
```

Upload one video through the admin panel and confirm it plays. That proves
storage works **before** a CDN is in front of it — debugging both at once is how
you end up unable to tell which is broken.

**6b. Fastly.** Create the service with origin `res.cloudinary.com`, then add its
hostname as a CNAME:

```
cdn.example.com    CNAME    <your-service>.map.fastly.net
```

A CNAME rather than their A records: Fastly can change anycast addresses, and a
CNAME follows automatically.

Check before asking Fastly to verify:

```bash
npm run check:domain -- --api api.example.com --cdn cdn.example.com
```

Both must pass. In particular `api.example.com` must still resolve to exactly
one address — the VPS. If adding the CDN changed that, stop and fix it.

**6c. Point playback at the CDN:**

```bash
NEUTV_MEDIA_BASE_URL=https://cdn.example.com/<cloud-name>/video/upload
```

Restart the API. Existing videos pick this up automatically: the stored path is
relative, so only the prefix changes.

---

## 7. Live streaming

Nothing to configure for browser broadcasting — an admin opens `/live`, picks
camera or screen, and goes on air. Segments post to the API and viewers assemble
them. Latency is 3–6 seconds.

An event is **fed by an external encoder unless you say otherwise**. The studio
only appears for an event set to *Broadcast from this browser* — an encoder event
gets its ingest URL instead, because the API refuses browser segments for one.

For an encoder, MediaMTX is in the compose file. OBS publishes RTMP to the VPS
and Caddy serves the HLS at `/hls`:

```bash
NEUTV_LIVE_DRIVER=mediamtx
```

The ingest URL is `rtmp://`, not `rtmps://`. MediaMTX serves plain RTMP on 1935;
pointing OBS at `rtmps://` sends a TLS handshake to it and the log says
`invalid rtmp version (22)` — 22 being the first byte of that handshake.

### Sub-second ingest with WHIP

The studio publishes WebRTC straight to MediaMTX rather than posting recorded
chunks, which takes ingest from about three seconds to under one:

```bash
NEUTV_MEDIAMTX_WHIP_BASE=https://api.example.com/whip
```

Then open **8189 on both UDP and TCP** in the firewall:

```bash
sudo ufw allow 8189/udp && sudo ufw allow 8189/tcp
```

That port cannot be proxied. Caddy carries the signalling on `/whip`, but the
browser sends media straight to 8189 — so signalling succeeding while the port is
closed gives you a connection that looks established and carries no video.

The studio publishes **H264**, and has to. The ingest log names the codec:

```
[path live-xxx] stream is available and online, 2 tracks (Opus, H264)
```

`VP8` there means viewers will see nothing, however healthy the rest looks — HLS
cannot carry it and hls.js cannot decode it. The publisher pins H264 explicitly,
because left to itself Chrome offers VP8 and Safari offers H264, which made
whether a broadcast reached anyone depend on the operator's browser.

Confirm WebRTC actually started, because a config MediaMTX cannot parse leaves it
restarting with the other listeners up:

```bash
docker compose logs mediamtx | grep WebRTC     # want a listener on :8889
curl -X OPTIONS https://api.example.com/whip/test/whip -o /dev/null -w '%{http_code}\n'
```

Nothing host-specific goes in `deploy/mediamtx.yml` — it has no variable
substitution. Override with `MTX_<NAME>` environment variables in compose, the
way `MTX_WEBRTCADDITIONALHOSTS` supplies the public hostname.

### The transcoder, and why segments were six seconds

MediaMTX repackages; it does not re-encode. An HLS segment can only start on a
keyframe, so segment length is whatever keyframe interval the *publisher's*
encoder chose — and a browser stretches that interval out on a static scene.
The 2 September broadcast shows it happening live:

```
segment duration changed from 1s to 3s
segment duration changed from 3s to 4s
segment duration changed from 4s to 6s
```

No HLS setting fixes this. `deploy/mediamtx.yml` therefore runs ffmpeg on every
publish (`runOnAvailable`), re-encoding with `-g 30 -keyint_min 30` at a forced
30fps — one keyframe per second, permanently — and writing the result to
`abr/<path>`. Viewers read that; the studio still publishes to `<path>`.

Two settings make it work, and both are easy to miss:

```bash
NEUTV_MEDIAMTX_TRANSCODE_PREFIX=abr     # or empty to send viewers back to the raw path
```

and the mediamtx service must run the **`latest-ffmpeg`** image — the plain one
has no ffmpeg for the hook to spawn. RTSP is switched on in the config as the
transcoder's private back channel, bound to `127.0.0.1` and never published, so
it is reachable only from inside that container.

After deploying, confirm the transcoder actually ran:

```bash
docker compose logs mediamtx | grep -E "abr/|ffmpeg"
curl -sI https://<cdn-host>/hls/abr/<stream-key>/index.m3u8   # 200 while on air
```

If `abr/<path>` never appears, playback 404s. Unset the prefix to fall straight
back to the raw path — six seconds behind, but playing — and debug from there.
Each concurrent stream costs roughly one CPU core at `veryfast`; past a handful
of simultaneous broadcasts this wants a GPU host and `h264_nvenc`.

### Moving the CDN hostname from video-on-demand to live

VOD gains nothing from a CDN. Cloudinary serves `q_auto,f_auto` responses as
`cache-control: private` with `vary: User-Agent`, because they are adapted per
client — so a shared cache is forbidden to store them, and Fastly in front of
Cloudinary records `x-cache: MISS` on every request it ever sees. It is an extra
hop and a second invoice buying zero cache hits, in front of an origin that is
already behind Akamai.

Live HLS is the opposite: segments are immutable, every viewer wants the same
bytes within the same second, and nothing marks them private. Point the hostname
there instead — **in this order**, so VOD never breaks mid-swap:

```bash
# 1. Take VOD off the CDN first and confirm video still plays.
NEUTV_MEDIA_BASE_URL=https://res.cloudinary.com/<cloud-name>/video/upload
docker compose up -d --build
```

```bash
# 2. Only now repoint the CDN service at the API origin, serving /hls/* only.
#    Origin: api.example.com:443, TLS on, Host override api.example.com.
#    Replace the VCL with the four snippets below.
```

```bash
# 3. Finally, send live playback through it.
NEUTV_MEDIAMTX_HLS_BASE=https://cdn.example.com/hls
docker compose up -d --build
```

Existing events pick up both changes on restart — playback endpoints are
re-derived from configuration on every read, never trusted from storage.

### Fanning live out through Fastly

Direct `/hls` from the VPS is fine for hundreds of viewers. Beyond that, the
origin must serve each segment once, not once per viewer — which is the whole
reason playback is HLS-over-HTTPS: it is the only transport a CDN can cache.

The live CDN gets **its own hostname**. One hostname, one system — the rule at
the top of this document. `cdn.` fronts Cloudinary and cannot also front the
VPS.

**1. A secret, so the CDN can introduce itself.** MediaMTX greets each new HLS
session with a cookie-support probe (a 302 adding `?cookieCheck=1`). Cached by
a CDN, that probe would be handed to every viewer; stripped, it loops. A fetch
carrying `Authorization: Bearer <secret>` skips the probe entirely — that is
what `hlsCDNSecret` is for.

```bash
openssl rand -hex 24    # keep it; it goes in .env AND in the Fastly snippet
```

In `.env`:

```bash
NEUTV_HLS_CDN_SECRET=<that secret>
```

**2. The Fastly service.** Create a new service:

| Setting | Value |
| --- | --- |
| Domain | `live.example.com` |
| Origin host | `api.example.com`, port 443, TLS on |
| SNI / cert hostname | `api.example.com` |
| **Override host** | `api.example.com` — without this the origin sees the CDN hostname and Caddy has no site for it |
| **TLS CA certificate** | the contents of `deploy/origin-ca.pem` |

**Origin TLS.** Caddy issues the API's certificate from Let's Encrypt and serves
a cross-signed chain:

```
leaf api.example.com  <-  Let's Encrypt YE2  <-  ISRG Root YE  <-  ISRG Root X2  <-  ISRG Root X1
```

The CDN has to verify that, so paste `deploy/origin-ca.pem` — both ISRG roots —
into the backend's TLS CA field. Either root validates the origin on its own
today; both are there so a future change to the chain Caddy serves cannot break
verification. The CA is pinned, not the leaf, so Caddy's 90-day renewals are
invisible to the CDN. Check the pasted anchor against the live origin before
trusting it:

```bash
echo | openssl s_client -connect api.example.com:443 -servername api.example.com \
  -CAfile deploy/origin-ca.pem -no-CApath 2>/dev/null | grep "Verify return code"
```

**SNI is not optional here.** The certificate carries one name, and Caddy
refuses the handshake outright for any other — not a name mismatch you could
ignore, but `tlsv1 alert internal error` and no certificate at all:

```
$ openssl s_client -connect api.example.com:443 -servername cdn.example.com
tlsv1 alert internal error ... no peer certificate available
```

So the CDN must send SNI *and* Host as `api.example.com`. Sending the CDN's own
hostname to the origin does not degrade the connection, it removes it.

**3. VCL snippets.** Four of them — `recv`, `miss`, `pass`, `fetch`. Set
**Placement** to the phase named — never "none" — and paste the *body only*, no
`sub vcl_... { }` wrapper.

**Delete the service's existing snippets first.** Fastly runs *every* snippet in
a phase, so an old one is not replaced by a new one — both run, in sequence. The
segmented-caching VCL this service carried for video-on-demand existed only
because a 50 MB MP4 exceeded Fastly's 20 MB object limit. A live segment is
roughly 200 KB, two orders of magnitude under that, so the range machinery buys
nothing and complicates a manifest that changes every second. It also aims at an
origin this service no longer has.

`recv`:

```vcl
# This service serves live HLS and nothing else - it must not be usable
# as a free proxy to the rest of the API.
if (req.url.path !~ "^/hls/") {
  error 403 "live CDN serves /hls/<stream>/... only";
}
# Viewer cookies must not fragment the cache, and a viewer-supplied
# Authorization must not impersonate the CDN at the origin.
unset req.http.Cookie;
unset req.http.Authorization;
```

`miss`:

```vcl
set bereq.http.Authorization = "Bearer <that secret>";
```

`pass` — the identical line a second time. A request that skips the cache still
has to introduce itself to the origin, and a snippet placed in `miss` does not
run on that path:

```vcl
set bereq.http.Authorization = "Bearer <that secret>";
```

`fetch`:

```vcl
unset beresp.http.Set-Cookie;
if (req.url.ext == "m3u8") {
  # The playlist is the only thing that changes. One second keeps every
  # viewer within a segment of the edge while collapsing their requests
  # into one origin fetch.
  set beresp.ttl = 1s;
  set beresp.stale_while_revalidate = 2s;
} else {
  # Segments and parts are immutable: a given URL only ever holds one
  # thing, and after the live window nobody asks again.
  set beresp.ttl = 1h;
}
```

**4. DNS, then verify before flipping anything:**

```
live.example.com    CNAME    <your-service>.map.fastly.net
```

```bash
npm run check:domain -- --api api.example.com --cdn live.example.com
curl -sI "https://live.example.com/hls/nothing/index.m3u8"   # 404 - NOT a 302
```

Read that response carefully — three outcomes, only one of them good:

| Response | Meaning |
| --- | --- |
| `404`, `server: mediamtx` | **Working.** The request reached MediaMTX, which correctly reports no such stream. |
| `302` with `cookieCheck` | The secret is not reaching the origin: `miss`/`pass` snippets missing, or the secret differs from `.env`. |
| `200`, `content-length: 0`, `server: Caddy` | **The Host override is not in effect.** Caddy matches site blocks by `Host`; a request carrying the CDN's name matches none, and Caddy's answer to that is a bare empty 200. Every path looks identical because none of them reach MediaMTX. |

That last one has a nasty second act: the empty 200 gets cached, and any
`Range` request against a zero-byte object returns `416 Range Not Satisfiable`
with `content-range: bytes */0`. A 416 on a live manifest is this fault, not a
MediaMTX one — MediaMTX answers a ranged 404 with a 404.

Three things that let it happen once, all worth checking before blaming the
origin:

- **Activate the version.** Fastly edits land in a draft version and do nothing
  until you click Activate. The console showing the right value proves nothing;
  only the edge does. Test with a cache-buster (`?v=<random>`) so you are not
  reading a stale object.
- **Segmented caching is a service setting, not a snippet.** Deleting the
  VOD-era VCL does not turn it off. It sends `Range` requests to the origin,
  which is where the 416 comes from once an empty object is cached.
- **Purge all after fixing.** The empty object is cached independently at every
  edge that saw a request — three continents' worth, in one outage — under the
  one-hour segment TTL. Fixing the origin does not evict it.

**5. Point playback at it.** In `.env`:

```bash
NEUTV_MEDIAMTX_HLS_BASE=https://live.example.com/hls
```

`docker compose up -d --build`. Every event — existing ones included — serves
CDN URLs immediately, because playback endpoints are re-derived from this value
on every read. WHIP stays on the api hostname: ingest is one broadcaster, and
WebRTC cannot be cached.

While on air, prove the cache is doing the work:

```bash
curl -sI "https://live.example.com/hls/<path>/index.m3u8" | grep -i x-cache
```

Fetch a segment URL from the playlist twice; the second must say `HIT`. Expect
playback ~1–2s further behind than direct — that is the manifest TTL buying the
million-viewer fan-out.

Then `docker compose up -d --build`. A restart is not enough: it reuses the
image, so a code or config change does not take.

---

## Verifying the whole thing

```bash
npm run check:domain -- --api api.example.com --cdn cdn.example.com
curl https://api.example.com/health
curl https://api.example.com/api/v1/social/posts | head -c 200    # 12 seeded posts
```

Then in a browser: the viewer app loads with the broadcast playing, the admin
panel signs in, and `/live` reaches the camera.

---

## When something is wrong

**Everything fails TLS.** The hostname resolves to more than one place. Run
`check:domain`. This is the failure mode that cost the last attempt.

**The admin shows "That page didn't load."** Its server components could not
reach the API. Check `NEUTV_API_BASE` on Vercel and that `curl https://<api>/health`
works from outside the VPS.

**A page works on reload but not on navigation.** Version skew: the app was
rebuilt while a tab was open, so it is requesting chunks from a build that no
longer exists. Harmless, and a reload fixes it.

**Videos do not play.** The seeded catalog references third-party sample URLs
that now return 403. Upload real video through the admin panel; the seed's
placeholder URLs were never meant to survive launch.

**DNS looks fixed but still fails.** Your resolver cached the old record. Wait a
full TTL and test from a network you have not used yet. `check:domain` queries
public resolvers to sidestep this.
