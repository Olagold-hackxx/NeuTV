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
npm run seed  # regenerate the catalog seed from frontend/src/data.js
```

Every script delegates to `backend/`, which holds its own `package.json` so it
stays an independent deploy unit. The frontend has no build step and no
dependencies: it is served as static files, by this gateway in development or by
anything else in production (`NEUTV_FRONTEND_ROOT`).

## backend/

Seven services — `catalog`, `identity`, `wallet`, `social`, `live`, `admin`,
`moderation` — each with its own store, tests, evals and README. None imports
another; they talk through `contracts/manifest.mjs` and are wired together in
`services/gateway/compose.mjs`.

No AI, deliberately. See `backend/README.md` for why, and
`backend/ARCHITECTURE.md` for the boundaries.

## frontend/

`index.html` plus `src/{app.js, data.js, styles.css, neutv-api.js}` and
`assets/logos/`. `neutv-api.js` is the client for the whole API contract;
`index.html` hydrates from it before the first render and falls back to the
bundled `window.CentralData` when the backend is down, so the page works with no
server running.

Migrating the remaining handlers (likes, comments, tips, chat) to the API, the
admin/CRM screens, the Next.js move and the design pass are the next phase.
