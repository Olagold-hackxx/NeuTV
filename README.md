# NEU TV — Backend

The 24/7 linear broadcast network behind NEU TV (Central Stream): eight services,
zero npm dependencies, Node 22 standard library only.

```bash
npm run seed      # regenerate the catalog seed from src/data.js
npm test          # 183 gate tests, deterministic, ~1.7s
npm run eval      # quality evals with pass thresholds
npm start         # gateway + frontend on http://localhost:4173
```

Open `http://localhost:4173` and the existing UI renders against the live API.
Stop the server and it renders against the bundled `window.CentralData`, exactly
as it did before — the backend is additive, never a hard dependency.

## Why no dependencies

Node 22 ships everything this needed: `node:http` for the server, `node:sqlite`
for storage, `node:test` for the suite, `node:crypto` (scrypt) for passwords,
and SSE over plain HTTP instead of a websocket library. Nothing here is a
framework decision anyone has to relitigate, there is no build step, and
`npm install` is not part of running it.

## The services

| Service | Owns | Store |
| --- | --- | --- |
| `catalog` | Products, hubs, spotlights, schedule, VOD, search | none (seed + clock) |
| `identity` | SSO across the 5 products, sessions, consent scopes, roles | SQLite |
| `wallet` | KashCoin balances, double-entry ledger, gifting | SQLite |
| `social` | Announcements feed, comments, upvotes, saves, follows | SQLite |
| `live` | The stage, telemetry, ticker, reactions, hub chat, SSE | SQLite |
| `admin` | Video library, uploads, **the main broadcast**, CRM | SQLite + files |
| `moderation` | Deterministic ruleset + LLM escalation, audit trail | SQLite |
| `llm` | Local Claude Code. Never a hosted API. | none |

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

## Admin / CRM

```bash
export NEUTV_ADMIN_EMAILS=you@example.com   # roles come from deployment, not signup
npm start
```

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

Deterministic rules first: seed-phrase phishing, doubling scams, staff
impersonation, guaranteed-return fraud, off-platform funnels, flooding. Free,
microseconds, identical verdict every time. Only the grey band between the
review and block thresholds escalates to latent space, and that call goes to
local Claude Code through the `llm` service.

If Claude Code is not installed, escalation degrades: the message publishes
**flagged for review** rather than blocked. Taking a live chat down because a
side channel is unavailable is the worse failure.

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
  threshold. Allowed to be slower and to use the LLM; not allowed to pass below
  their number.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `4173` | Gateway port |
| `NEUTV_ADMIN_EMAILS` | none | Comma-separated emails granted the admin role |
| `NEUTV_CLAUDE_BIN` | auto-discovered | Absolute path to the Claude Code binary |

See `ARCHITECTURE.md` for the boundaries, and `contracts/manifest.mjs` for the
route contract itself.
