# Architecture

## One rule

No service imports another. Every cross-service call goes through
`contracts/manifest.mjs`, and the wiring happens in exactly one file:
`services/gateway/compose.mjs`.

```
                          ┌──────────────────────────────┐
   browser ──────────────▶│  gateway                     │
   frontend/src/          │  sockets, auth, limits, SSE  │
     neutv-api.js         └──────────────┬───────────────┘
                                         │ normalized request
                  ┌──────────┬───────────┼───────────┬──────────┐
                  ▼          ▼           ▼           ▼          ▼
              catalog    identity     social       live       admin
                                         │           │          │
                                         └─────┬─────┘          │
                                               ▼                │
                                          moderation ◀──────────┘
                                        (deterministic)
```

## Why the gateway holds the sockets

A service handler takes a normalized `{ method, path, query, body, auth }` and
returns `{ status, body }`. It never touches a socket. Three things follow:

1. **Gate tests need no ports.** They call `dispatch(router, req)` directly.
2. **In-process and over-the-wire behave identically.** The loopback client
   dispatches into a peer's router with the same shape an HTTP call would carry,
   so splitting a service onto its own port is a config change.
3. **Auth is enforced once.** The gateway reads the level the contract declares
   for a route and applies it. Eleven admin routes cannot each forget to check.

## Why the contract is a data file

`contracts/manifest.mjs` declares every route: method, path, owning service,
auth level, and the `raw`/`stream` flags. Three gate tests hold it to that:
every declared route exists, no undeclared route is exposed, and the flags
match. That last one is not theoretical — the router originally dropped `raw`,
which routed video uploads into the JSON parser.

## Cross-service reads that are not API routes

Two of these exist, and both are injected at the composition root rather than
imported:

- **`wallet.events`** — a tip emits a gift event that becomes the banner on the
  live stage. The wallet does not know the live service exists.
- **`admin.ports`** — the CRM aggregates viewers, spend, engagement and the
  moderation queue. Each is a narrow read-only view a service chose to expose,
  not a database handle. Unwired ports report `null` instead of throwing, so the
  CRM degrades to what it can see.

Exposing these as public routes would widen the API for one back-office screen.
Letting admin open four databases would end the isolation entirely.

**Loopback calls are trusted, so a service must not depend on a peer's
admin-only route.** `dispatch()` does not enforce auth levels; the gateway does.
That means an in-process call sails through a route the same call would be
refused over HTTP. The live service originally resolved stage takeovers via
`GET /admin/videos/:id` and worked perfectly in one process, while a split
deployment would have 403'd. The fix was a public `GET /videos/:videoId` that
serves published videos only. Any new cross-service read has to be reachable at
the auth level the caller actually holds.

## Everything here is deterministic

Same input, same output, every time: seed extraction, schedule resolution,
search ranking, the moderation ruleset, ledger arithmetic, stage expiry,
telemetry, pagination. Nothing calls a model.

There *was* an LLM service, for arbitrating ambiguous moderation calls. It was
removed in contract 2.0.0 because the need did not survive examination: the
ruleset scores 100% recall and 100% precision on the eval corpus without it, and
the grey band has a better destination than a model's guess - the CRM review
queue, where a person decides. Adding inference to a system that does not need
it buys latency, cost, and non-reproducibility.

The catalog seed is the clearest case of the same principle: it is committed,
checksummed content rather than anything generated at runtime, so drift is
visible. Videos have since moved out of it into the admin store, where an
operator owns them; `scripts/seed-videos.mjs` was the one-time bridge, and it is
idempotent so re-running it is a no-op.

## State decisions worth knowing

- **Balances are `SUM()` over a double-entry ledger**, never a cached column. A
  cached balance is a second source of truth that drifts the first time a write
  path is wrong. `SELECT SUM(amount) FROM entries` must be `0`; that is a test.
- **Engagement counts are rows, not counters.** A unique `(user, post)` pair
  cannot be double-counted by a retry.
- **Viewer count is `COUNT(*)` over a presence window**, not an
  increment/decrement pair. Tabs die without saying goodbye.
- **Seeded numbers and measured numbers are separate fields.** `upvotes` vs
  `seedUpvotes`, `viewers` vs `baselineViewers`. The designed feed looks right
  without anyone mistaking shipped content for real engagement.
- **The catalog has no database.** Everything it serves derives from a committed
  seed plus the clock. Adding SQLite would buy nothing and add a failure mode.

## Time and ids are injected

Nothing calls `Date.now()` or `Math.random()` directly. Services take a
`runtime`; tests pass `fakeRuntime()`. This is what lets the stage tests assert
a four-hour revert instantly and the rate-limiter tests assert an exact window
boundary without sleeping.

## Adding a service

1. Declare its routes in `contracts/manifest.mjs`, bump `contracts/version.mjs`.
2. Create `services/<name>/` with `service.mjs`, `router.mjs`, `store.mjs`,
   `test/`, `evals/`, `README.md`.
3. Wire it in `services/gateway/compose.mjs`.
4. `npm test` — the conformance suite will tell you what is missing.
