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

For an encoder instead, MediaMTX is in the compose file. OBS publishes RTMP to
the VPS and Caddy serves the HLS at `/hls`:

```bash
NEUTV_LIVE_DRIVER=mediamtx
```

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
