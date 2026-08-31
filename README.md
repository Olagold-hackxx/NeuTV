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

**API** (`backend/`) — anywhere that runs a Node process and keeps it running:
Railway, Fly, Render, a container. It must stay a process, not a function: the
live event stream is a held-open SSE connection, and broadcasting from the admin
studio writes segments to local disk. Needs `DATABASE_URL` (Postgres) and, for
uploaded video that outlives one host, a media driver that is not `local` -
`cloudinary` or `s3`, whichever you already pay for.

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
