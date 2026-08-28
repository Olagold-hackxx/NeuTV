# frontend

The NEU TV app. No build step, no dependencies, no bundler — React 18 and
Tailwind from CDN, served as static files.

```
index.html          93-line shell: CDN tags, loading state, mount + hydration
src/app.js          the React tree (React.createElement, no JSX)
src/data.js         window.CentralData — the designed content, and the source
                    the backend seed is generated from
src/styles.css      animations and glassmorphic surfaces
src/neutv-api.js    client for the whole backend contract
assets/logos/       the ecosystem brand marks
```

`index.html` used to carry its own inline copy of all three — a second, drifting
version of the same app, with the logos as base64 rather than the files in
`assets/`. The two were byte-identical apart from that encoding, and a one-line
fix had to be made twice to land. It is now a shell that loads `src/`, so there
is one copy of everything.

## How it talks to the backend

`index.html` calls `NeuTV.hydrate()` before the first render. If the backend
answers, `window.CentralData` is replaced with the live catalog and
`window.NEUTV_LIVE` is `true`. If it does not, the bundled data in `src/data.js`
renders exactly as before — the backend is additive, never a hard dependency.

```js
await NeuTV.identity.sso('worldstreet', 'Alex Trader');
await NeuTV.wallet.tip('crown', { type: 'creator', id: '@david_trades' });
await NeuTV.live.takeStage('cr-1');       // reverts when the video ends
NeuTV.live.subscribe({ gift: showBanner, comment: pushTicker });
```

## Current wiring state

The catalog is live. Likes, comments, tips and chat still run on local React
state — migrating those handlers is the next phase, along with the admin/CRM
screens and the Next.js move.

## src/data.js is the content source of truth

`npm run seed` parses this file into `backend/services/catalog/seed/`. Edit the
content here, re-run the seed, and the API serves it. Do not hand-edit the seed.
