# frontend

The NEU TV app. No build step, no dependencies, no bundler — React 18 and
Tailwind from CDN, served as static files.

```
index.html          shell: CDN tags, loading state, mount + hydration
src/app.js          the React tree (React.createElement, no JSX)
src/catalog.js      reads the hydrated catalog during render
src/neutv-api.js    client for the whole backend contract
src/bridge.js       optimistic-then-reconcile wrapper around the client
src/styles.css      animations and glassmorphic surfaces
assets/logos/       the ecosystem brand marks
```

`index.html` used to carry its own inline copy of all three — a second, drifting
version of the same app, with the logos as base64 rather than the files in
`assets/`. The two were byte-identical apart from that encoding, and a one-line
fix had to be made twice to land. It is now a shell that loads `src/`, so there
is one copy of everything.

## How it talks to the backend

`index.html` calls `NeuTV.hydrate()` before the first render. It fills
`window.CentralData` from two places, both over the API:

- `GET /catalog/bootstrap` — products, community hubs, editorial media rows,
  schedule, spotlights, trending. Served by the catalog service from its
  committed seed.
- `GET /videos` — every **published** video in the admin library, straight out
  of the database. These become the on-demand shelves, so publishing a video in
  the back office puts it on the site.

```js
await NeuTV.identity.sso('worldstreet', 'Alex Trader');
await NeuTV.wallet.tip('crown', { type: 'creator', id: '@david_trades' });
await NeuTV.live.takeStage('cr-1');       // reverts when the video ends
NeuTV.live.subscribe({ gift: showBanner, comment: pushTicker });
```

## There is no bundled catalog

`src/data.js` used to ship a 34KB `window.CentralData` blob that the page
rendered when the API was unreachable. It is gone. That fallback was worse than
no fallback: a dead backend looked exactly like a healthy one, and a video
published in the back office never appeared because the hardcoded copy won.

If the API cannot be reached the page now says so and offers a retry, rather
than rendering fixtures. Content is edited in the back office, not in this
folder.
