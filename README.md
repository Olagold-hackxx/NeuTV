# NEU TV — Central Stream

24/7 linear Web3 media network. Two halves, two folders.

```
backend/     API: 7 services, zero dependencies, Node 22 stdlib only
frontend/    The app: index.html, src/, assets/
```

```bash
npm start     # gateway + frontend on http://localhost:4173
npm test      # 172 gate tests, ~1.5s
npm run eval  # quality evals with pass thresholds
npm run seed:videos  # give every catalog video a row in the admin library
```

Every script delegates to `backend/`, which holds its own `package.json` so it
stays an independent deploy unit. The frontend has no build step and no
dependencies: it is served as static files, by this gateway in development or by
anything else in production (`NEUTV_FRONTEND_ROOT`).

## Deploying

The API is a long-lived process; the two front ends are static/edge and go on
Vercel. Splitting them is the supported shape, and it is why the gateway sends
permissive CORS and why the client takes an API base URL.

**API** (`backend/`) — a VPS, via Docker:

```bash
cp deploy/.env.example .env      # fill it in; compose refuses to start without
docker compose up -d             # the required ones
```

Three containers by default: the gateway, Postgres and MediaMTX. The API and the
HLS port are published on **loopback only**; the internet reaches them through
whatever terminates TLS.

Most VPS images already have Caddy installed and serving its welcome page on
:80, and two processes cannot both bind it. So use the one that is there:

```bash
sudo tee -a /etc/caddy/Caddyfile < deploy/Caddyfile.host   # append, never replace
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Append it. That file usually holds every other site on the machine, and
overwriting it takes them all down.

If the machine has no Caddy, run ours instead and it will get the certificate:

```bash
docker compose --profile edge up -d
```

RTMP (1935) is published either way: OBS does not speak HTTP, so it cannot go
through a reverse proxy.

TLS is not optional. The front ends are on Vercel over https, and a browser
blocks an http:// API from an https page before the request is sent - which
surfaces as "Failed to fetch" and looks exactly like the backend being down.
Caddy gets a Let's Encrypt certificate on boot, so point `API_DOMAIN` at the
machine before the first `up`.

It must stay a process, not a function: the live event stream is a held-open SSE
connection, and a browser broadcast arrives as segments written to a volume.

Updating it is a pull and a restart, because migrations run on boot:

```bash
npm run verify                   # 243 tests + evals, ~4s. Do this before, not after.
ssh you@vps 'cd NEUTV && git pull && docker compose up -d --build'
```

If the build fails, compose aborts and the old container keeps serving. Rolling
back is checking out the previous tag and building again - there is no faster
path, so tag what you deploy.

| | |
|---|---|
| Video | Cloudinary stores and transcodes; Fastly serves. No bucket involved. |
| Live from OBS | MediaMTX takes RTMP on 1935 and republishes HLS at `/hls`. |
| Live from the browser | The admin studio, straight to the API. No media server needed. |
| State | Postgres, plus one volume for live segments. |

### Fastly in front of Cloudinary

Point a Fastly service at `res.cloudinary.com` as its origin, then set

```bash
NEUTV_MEDIA_BASE_URL=https://cdn.your-domain.com/<cloud-name>/video/upload
```

The database stores a relative path, never a URL, so moving CDNs is this one
variable and not a migration.

**Viewer app** (`frontend/`) — a Vercel static project. Root `vercel.json`
already points at it: it builds Tailwind and generates `src/config.js` from
`NEUTV_API_BASE`, which is the one thing that differs between deployments.

```
Project root       .              (repo root; vercel.json is here)
Environment        NEUTV_API_BASE=https://api.your-host.com
```

Without that variable the page assumes the API is same-origin, which is correct
when the gateway serves it (`npm start`) and wrong on Vercel.

**Back office** (`admin/`) — a second Vercel project, Next.js, auto-detected.

```
Root directory     admin
Environment        NEUTV_API_BASE=https://api.your-host.com
```

The admin token lives in an httpOnly cookie set by a server action, so the API
base here is read on the server and never reaches the browser.

Two limits worth knowing before you rely on them:

- **Uploads pass through the admin's own route** (`/api/upload/[videoId]`), which
  on Vercel is capped at 300s. That is a few hundred megabytes at a typical
  upstream. Larger files need a presigned upload straight to object storage.
- **`NEUTV_ADMIN_EMAILS` is set on the API**, not on either Vercel project. Roles
  come from the deployment that owns the database.

## backend/

Seven services — `catalog`, `identity`, `wallet`, `social`, `live`, `admin`,
`moderation` — each with its own store, tests, evals and README. None imports
another; they talk through `contracts/manifest.mjs` and are wired together in
`services/gateway/compose.mjs`.

No AI, deliberately. See `backend/README.md` for why, and
`backend/ARCHITECTURE.md` for the boundaries.

## frontend/

`index.html` plus `src/{app.js, catalog.js, bridge.js, styles.css,
neutv-api.js}` and `assets/logos/`. `neutv-api.js` is the client for the whole
API contract; `index.html` hydrates from it before the first render — the
editorial catalog from `/catalog/bootstrap`, the on-demand shelves from the
published admin library at `/videos`. There is no bundled copy of the content:
what the back office publishes is what the site carries.

Migrating the remaining handlers (likes, comments, tips, chat) to the API, the
admin/CRM screens, the Next.js move and the design pass are the next phase.
