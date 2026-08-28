# live

The 24/7 central stage and everything overlaid on it.

## The stage

One video is the main broadcast and owns the main page. Clicking another video
takes the stage; when it ends, the stage returns to the main broadcast.

`stage.mjs` is a pure function of `(state, now)`. A takeover stores when it
ends, and every read compares that to the clock:

- nothing has to fire on time, and nothing leaks if the process restarts
- a viewer who closed the tab an hour ago is already back on the main broadcast
- a four-hour revert is asserted in a test instantly, by moving a fake clock

`scope: 'viewer'` (default) is that viewer's stage only. `scope: 'broadcast'`
is the PRD's "Stream on Central TV Stage" promote and moves every viewer, so it
requires the admin role or `broadcast:promote`. A viewer's own click wins over a
global promote: the person who chose what to watch is the one looking at it.

The main broadcast comes from the admin service through the contract, falling
back to the seeded Central TV programme so the page is never empty.

## Overlays

Floating comment ticker (moderated, falls back to seeded chatter while empty),
reaction totals with a fixed palette, community hub chat (channel validated
against the catalog), broadcast likes as a toggle, gift banners, and the
leaderboard.

**Telemetry is honest.** `viewers` is a `COUNT(*)` over presence heartbeats
inside a 45s window — a real measurement that decays when tabs close.
`baselineViewers` is the number shipped in the seed, kept under its own name so
nobody mistakes content for a measurement.

`GET /live/stream` is SSE over plain HTTP: server-to-client only, which is what
SSE is for and what a websocket dependency would have cost extra.

Tests: `npm run test:live`.
