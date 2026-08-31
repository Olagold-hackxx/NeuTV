# web

The NEU TV viewer app, rebuilt on Next.js 16 + TypeScript + Tailwind v4 to the
design brief in `docs/design-brief.md`. It replaces the template-with-a-video
look with the brief's discipline: color only carries meaning (cyan is
interactive, red means genuinely live, amber means needs attention), the brand
gradient appears on the wordmark and the sign-in gate's header rule and nowhere
else, and surfaces separate by value instead of blur.

```bash
npm run dev     # http://localhost:4175 (expects the API on :4173)
npm run build
npm start
```

From the repo root: `npm run web`, `npm run web:build`, `npm run web:start`.

## How it talks to the backend

The first paint is a server render: `app/page.tsx` fetches
`/catalog/bootstrap` and `/videos?limit=200` on every request (nothing is
cached) and hands the client app one trimmed, typed prop. If the API is
unreachable the page renders a designed offline state with a retry — there is
no bundled fallback catalog, so a dead backend never looks healthy.

In the browser, `lib/client.ts` covers the rest of the contract: the
server-owned stage (`/live/state`, `/live/stage`, `/live/stage/revert`),
identity, wallet and tipping, the social feed actions, hub chat, the
leaderboard, presence, and the `/live/stream` SSE subscription. Unlike the CDN
app this one handles every stream event — comments feed the ticker, gifts
raise the banner, telemetry moves the viewer count, `stage` adopts an
operator's promote live, and `live-event` frames read current state through a
ref so a frame arriving hours in never closes over stale state.

Live events play three ways, chosen exactly as the backend describes the
event: a browser-originated broadcast through `lib/segment-player.ts`
(MediaSource, init segment first, one append at a time, jump to the live
edge), an HLS URL through hls.js loaded lazily from the CDN, or a plain video
source. The 24/7 channel is locked — live television cannot be scrubbed — and
a takeover plays with controls and reverts on its own `ended` event.

- `NEUTV_API_BASE` — where the server render reaches the gateway
  (default `http://localhost:4173`).
- `NEXT_PUBLIC_NEUTV_API_BASE` — what the browser calls, when the public
  hostname differs from the server-side one.

## Where things live

```
app/globals.css        every color, radius, duration and shadow, once
app/page.tsx           server fetch → <App> or the offline state
lib/client.ts          typed browser client for the whole v1 contract
lib/segment-player.ts  MediaSource player for studio broadcasts
components/app.tsx     state owner: stage, session, SSE, toasts
components/…           rail, top bar, stage, reel, feed, chat rail,
                       gift palette, sign-in gate
```

The rail's "Preview loading states" toggle renders every skeleton at once —
the brief requires the loading states to be reachable, not theoretical.
