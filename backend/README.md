# NEU TV — Backend

The 24/7 linear broadcast network behind NEU TV (Central Stream): seven
services, zero npm dependencies, Node 22 standard library only.

```bash
npm run seed:videos  # give every catalog video a row in the admin library
npm test          # 183 gate tests, deterministic, ~1.7s
npm run eval      # quality evals with pass thresholds
npm start         # gateway + frontend on http://localhost:4173
```

Open `http://localhost:4173` and the UI renders against the live API. There is
no bundled fallback catalog any more: the frontend has no content of its own, so
the API is a hard dependency and a page that cannot reach it says so.

## Storage

Two engines, one codebase.

```bash
npm start                                   # SQLite: a file per service, zero setup
DATABASE_URL=postgres://... npm start       # Postgres: one database, a schema per service
```

Each service owns a Postgres **schema**, which is the same isolation a private
SQLite file gave it. That is not decorative: social and live both define a table
called `comments`, and sharing one namespace made the second service's migration
fail outright.

Move existing SQLite data across:

```bash
npm run migrate:postgres -- --url postgres://localhost:5432/neutv --dry-run
npm run migrate:postgres -- --url postgres://localhost:5432/neutv
```

Rows insert with `ON CONFLICT DO NOTHING`, so a repeat run is safe and a partial
one resumes.

### Both engines are tested

```bash
npm test                                    # SQLite, in memory, ~5s
npm run test:pg                             # the identical suite against Postgres
```

Running both is the point. The Postgres pass immediately caught the `comments`
collision and thirteen camelCase column aliases that Postgres folds to lower
case (`AS ruleIds` comes back as `ruleids`) - bugs SQLite is happy to hide.

## Video storage

Three drivers, one interface. Pick one; they are not layered and none of them
is a prerequisite for another.

```bash
NEUTV_MEDIA_DRIVER=local                    # default: disk, served at /media
NEUTV_MEDIA_DRIVER=cloudinary               # Cloudinary, which transcodes too
NEUTV_MEDIA_DRIVER=s3                       # any S3-compatible bucket
NEUTV_MEDIA_BASE_URL=https://cdn.neu.tv     # serve playback from the edge
```

The Cloudinary driver uploads with one signed multipart POST, signed with a sha1
over the sorted parameters. The API secret is never transmitted, only the digest.
It records the `public_id` and format Cloudinary reports rather than what was
sent, because Cloudinary transcodes and its numbers are the ones that describe
the file people will actually fetch.

The S3 driver speaks the S3 REST API directly, signing with SigV4 built from
`node:crypto`. It works against Cloudflare R2, AWS S3, Backblaze B2, DigitalOcean
Spaces and MinIO. The AWS SDK is tens of megabytes of dependency for two HTTP
calls; the signing algorithm is public and about forty lines.

Uploads stream rather than buffer, so a multi-gigabyte file never sits in memory.
That means object storage needs a `Content-Length` up front - discovering the
length by buffering is exactly what this avoids - and the driver refuses an
upload without one. The type allowlist, the size cap and the id-derived object
key all apply the same as on disk.

**Unverified:** the signing is covered by tests through an injected `fetch`, but
no request has been made against a real bucket, because there are no credentials
on this machine. Point it at a bucket and upload once before relying on it.

## Why (almost) no dependencies

`pg` is the only runtime dependency, and only because there is no way to speak
the Postgres wire protocol without a driver.

Everything else is Node 22 standard library: `node:http` for the server,
`node:sqlite` for the zero-setup engine, `node:test` for the suite,
`node:crypto` for scrypt passwords and for S3 request signing, and SSE over
plain HTTP instead of a websocket library. Nothing here is a
framework decision anyone has to relitigate, there is no build step, and
`npm install` is not part of running it.

**And no AI.** There was an LLM service; it was removed in contract 2.0.0. The
only plausible use was arbitrating ambiguous moderation calls, and the
deterministic ruleset scores 100% recall and 100% precision without it. Those
calls now go to the human review queue in the CRM, which is cheaper, instant,
reviewable, and does not disagree with itself on re-runs.

## The services

| Service | Owns | Store |
| --- | --- | --- |
| `catalog` | Products, hubs, spotlights, schedule, VOD, search | none (seed + clock) |
| `identity` | SSO across the 5 products, sessions, consent scopes, roles | SQLite |
| `wallet` | KashCoin balances, double-entry ledger, gifting | SQLite |
| `social` | Announcements feed, comments, upvotes, saves, follows | SQLite |
| `live` | The stage, telemetry, ticker, reactions, hub chat, SSE | SQLite |
| `admin` | Video library, uploads, **the main broadcast**, CRM | SQLite + files |
| `moderation` | Deterministic ruleset, audit trail, review queue | SQLite |

Each has its own directory, store, tests, evals and README. None imports
another: they talk through `contracts/manifest.mjs` and are wired together in
`services/gateway/compose.mjs`.

## The main broadcast and the stage

One video is the main broadcast and owns the main page. Click any other video
and it takes the stage; when it ends, the stage returns to the main broadcast on
its own.

```
GET  /api/v1/programme/current            what the stage reverts to
PUT  /api/v1/admin/programme              set the main broadcast (admin)
GET  /api/v1/live/stage?viewerId=…        what is on the stage right now
POST /api/v1/live/stage                   take it over  { videoId, scope }
POST /api/v1/live/stage/revert            end a takeover early
```

The revert is expiry, not a timer: a takeover records when it ends and every
read resolves against the clock. Nothing has to fire on time, nothing leaks on
restart, and a viewer who closed the tab an hour ago is already back on the main
broadcast. `scope: 'viewer'` (the default) changes only that viewer's stage;
`scope: 'broadcast'` moves everyone and needs broadcast rights.

## Going live

An admin can put a real broadcast on air, and it **outranks the programmed
video**: while an event is live it *is* the main broadcast. Ending it hands the
stage back automatically. Precedence is `live event > programme > seed`.

```
POST /api/v1/admin/live-events              schedule, and mint a stream key
POST /api/v1/admin/live-events/:id/start    go on air
POST /api/v1/admin/live-events/:id/stop     end, and fall back to the programme
POST /api/v1/admin/live-events/:id/rotate   new key; the old one dies immediately
GET  /api/v1/live-event/current             public. Never carries the stream key.
```

Exactly one event may be live at a time - the network has one main stage, and
two things claiming it is not a state the stage machine can resolve.

Going on and off air is published over SSE, so a viewer already watching
switches without reloading, and a viewer mid-takeover is not yanked away: they
return to the live event when their video ends.

### Broadcasting from the admin page

The admin page is the studio. It captures the camera or the screen in the
browser, records short chunks with MediaRecorder, and posts each one to the API;
viewers fetch those chunks and assemble them through MediaSource. No encoder to
install, no media server, no accounts.

```
PUT /api/v1/admin/live-events/:id/segment      one recorded chunk (admin)
GET /api/v1/live-event/:id/manifest?after=N    which segments exist (public)
GET /api/v1/live-event/:id/segment/:seq        the bytes (public, immutable)
```

**Latency is roughly 3-6 seconds**, because a segment cannot be sent until it has
been recorded. That is a broadcast, not a conversation. Sub-second needs an SFU,
which is what the hosted ingest drivers below are for.

Two details that make late joiners work: segment 0 is the WebM header and is
never evicted, because a viewer joining an hour in still needs it to decode
anything; everything after it is a rolling window, so a six-hour broadcast does
not fill the volume. The player fetches segment 0 first regardless of where the
window currently starts, appends one chunk at a time (a SourceBuffer rejects
overlapping appends), and skips forward if it drifts more than a few seconds
behind the edge.

An event declares how it is fed:

| `source` | Video comes from | Needs a playback URL |
| --- | --- | --- |
| `browser` | the admin tab, as segments | no |
| `external` | a URL you supply | yes |

### Ingest

```bash
NEUTV_LIVE_DRIVER=manual        # default: no accounts, no infrastructure
NEUTV_LIVE_DRIVER=mux           # RTMP ingest + HLS minted via the Mux API
NEUTV_LIVE_DRIVER=cloudflare    # Cloudflare Stream live inputs
```

**manual** is the default and works today: stream to YouTube Live or your own
RTMP server with OBS, then paste the public playback URL - an `.m3u8` manifest
or a YouTube id. The other two provision ingest for you and fill the playback
URL in automatically.

The stream key is a bearer credential for an encoder and is treated like one: it
never appears in the public payload, and `publicEvent()` is built by naming
fields rather than deleting them, so a field added to the admin shape later
cannot leak by accident. A test asserts the key appears nowhere in the public
response or the SSE announcement.

**Unverified:** the Mux and Cloudflare adapters are covered by tests through an
injected `fetch`, but no request has been made against either service - there
are no credentials here. The manual driver is fully exercised end to end.

## Admin / CRM

```bash
cp .env.example .env                                   # then edit NEUTV_ADMIN_EMAILS
npm run admin:create -- --email you@example.com --generate
npm start
```

There is no password in the environment. `NEUTV_ADMIN_EMAILS` says *who* may be
an administrator; `admin:create` sets that account's password and prints it
once. Pass `--password 'your-own'` instead of `--generate` to choose it, and run
the same command again later to reset it (which also revokes every live
session).

The script refuses any email not in `NEUTV_ADMIN_EMAILS`, so it cannot mint an
administrator the deployment has not authorised. The admin panel has a login
form and no sign-up form for the same reason.

`npm start` loads `.env` through Node's own `--env-file-if-exists`, so there is
no dotenv dependency and a checkout without a `.env` still starts. Exported
shell variables still work and take precedence.

Roles come from deployment, never from self-service: an email in
`NEUTV_ADMIN_EMAILS` gets the admin role when that account signs up. SSO cannot
mint an admin, and neither can signing up with any other address.

```bash
# register, upload, and put it on air
curl -X POST  localhost:4173/api/v1/admin/videos      -H "authorization: Bearer $TOKEN" \
     -H 'content-type: application/json' -d '{"title":"Daily Briefing","kind":"upload"}'
curl -X PUT   localhost:4173/api/v1/admin/videos/$ID/file -H "authorization: Bearer $TOKEN" \
     -H 'content-type: video/mp4' --data-binary @clip.mp4
curl -X PUT   localhost:4173/api/v1/admin/programme   -H "authorization: Bearer $TOKEN" \
     -H 'content-type: application/json' -d "{\"videoId\":\"$ID\"}"
```

Uploads are a raw binary `PUT`, not multipart: hand-rolling a multipart parser
for gigabyte video is a bug farm, and streaming straight to disk behaves better.
Playback is served from `/media/<id>.<ext>` with byte-range support, so seeking
works and Safari plays it.

`/api/v1/admin/crm/*` aggregates viewers, spend, engagement and the moderation
queue. Those numbers live in other services' databases, so admin reads them
through injected ports (`services/admin/ports.mjs`) rather than opening anything
it does not own.

## Moderation

Seed-phrase phishing, doubling scams, staff impersonation, guaranteed-return
fraud, off-platform funnels, flooding. Free, microseconds, identical verdict
every time.

Three outcomes: `allow` publishes, `block` never lands, and the grey band in
between **publishes flagged and queues for a human** in `/admin/crm/moderation`.
Blocking legitimate speech on a live broadcast is the worse error, and a
moderator pulls a bad message in seconds.

Current eval: **100% recall on the abuse corpus, 100% precision on the clean
corpus** (`npm run eval`).

## The client

`src/neutv-api.js` is a zero-dependency browser client covering the whole
contract. `index.html` calls `NeuTV.hydrate()` before the first React render and
falls back to the bundled data if the backend is down.

```js
await NeuTV.identity.sso('worldstreet', 'Alex Trader');
await NeuTV.wallet.tip('crown', { type: 'creator', id: '@david_trades' });
await NeuTV.live.takeStage('cr-1');            // reverts when the video ends
NeuTV.live.subscribe({ gift: showBanner, comment: pushTicker });
```

## Testing

Two lanes, on purpose.

- **Gate tests** (`npm test`) — deterministic, in-memory, no sockets except the
  gateway suite, no network, under 2 seconds. Clock and ids are injected, so a
  four-hour takeover is asserted without waiting for it.
- **Evals** (`npm run eval`) — quality across a corpus, scored against a
  threshold. Broader than the gate tests on purpose: they measure whether the
  ruleset and the search ranking are *good*, not just whether specific cases
  behave. Both eval misses that led to real fixes were found here, not by a
  test.

## Configuration

Set these in `backend/.env` (see `.env.example`) or export them.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4173` | Gateway port |
| `DATABASE_URL` | none | Postgres. Unset means SQLite per service. |
| `NEUTV_MEDIA_DRIVER` | `local` | `local` or `s3` |
| `NEUTV_MEDIA_BASE_URL` | `/media` | CDN hostname for playback |
| `NEUTV_ADMIN_EMAILS` | none | Comma-separated emails granted the admin role |
| `NEUTV_FRONTEND_ROOT` | `../frontend` | Static files the gateway serves |

## Known limits

- **Rate limiting is per-process and in-memory.** Correct for the single-process
  deployment this ships as; running several gateway instances behind a load
  balancer would give each its own budget. That needs a shared store before
  horizontal scaling, not before launch.
- **The existing UI is wired to the catalog only.** `NeuTV.hydrate()` feeds the
  live catalog into the first render; likes, comments, tips and chat still run
  on local React state. Migrating those handlers is the next phase, along with
  the admin/CRM screens.

See `ARCHITECTURE.md` for the boundaries, and `contracts/manifest.mjs` for the
route contract itself.
