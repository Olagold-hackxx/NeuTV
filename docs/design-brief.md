# Design brief — NEU TV

*A prompt written the way you'd hand a brief to a senior design engineer. Copy the whole thing into a fresh chat. Swappable slots are marked at the bottom.*

---

## 1. Who you are, who this is for

You are the design lead and frontend engineer on this project. The backend is finished and the API is stable; what does not exist yet is a point of view. Assume a client who can already see the product working and is now paying specifically for it to stop looking like a template with a video in the middle.

**Product:** NEU TV — a 24/7 linear broadcast network for the New Economy, and the media anchor for five ecosystem products (WorldStreet, KashPlus, mARKet, ARK, Tsion Cars).
**Primary user:** Alex, an active trader, 20s–40s, holds leveraged equity positions on WorldStreet around the clock and keeps NEU TV open on a second monitor for hours at a time.
**The job the screen does:** answer **"is something worth watching on right now, and is there a signal I need to act on before it goes stale?"** within four seconds of load, without the user clicking anything.

Everything below serves that. If a decision doesn't make that question easier to answer, cut it.

**The one tension that decides most calls:** this is television. The video is the subject; every pixel of chrome competes with it. When two options are close, pick the one that gives the broadcast more room and more contrast.

---

## 2. Process — follow this order, do not skip ahead

**Step 1 — Plan before you build.** Before writing any component, produce a short written design plan:

- **Color:** 5–6 named hex values (base, elevated surface, primary text, secondary text, one accent, one alert). Name each one and say what it's for.
- **Type:** one or two families max, with a set scale (sizes, weights, line-heights, tracking). If two families, they must be obviously different, not two neutral grotesques.
- **Space:** an 8px-based scale with named steps. State the outer page gutter and the internal card padding as specific values.
- **Radius, border, elevation:** state the actual values and where each applies. Do not use one radius on everything regardless of hierarchy.
- **Motion:** durations and easing curves as tokens. State which elements move and why.
- **Layout concept:** one paragraph plus a rough ASCII wireframe of the desktop grid.

**Step 2 — Critique the plan against the brief before coding.** Ask yourself: would I have produced this exact plan for any other streaming or dashboard product? Where the answer is yes, change it and say what you changed and why. Then code against the revised plan.

**Step 3 — Build.**

**Step 4 — Critique the built result** against the checklist in §11 and report what you found.

---

## 3. Aesthetic direction

The existing palette is right and is not up for redesign — it is the brand. Work inside it:

| Token | Hex | Use |
|---|---|---|
| `--base` | `#060A12` | page ground |
| `--midnight` | `#0B1220` | primary surface |
| `--obsidian` | `#111B33` | raised surface, one measurable step above midnight |
| `--cyan` | `#00F6A7` | the ecosystem accent |
| `--sky` | `#00C8FF` | gradient partner, secondary accent |
| `--cobalt` | `#4D6BFF` | gradient terminus |
| `--live` | `#FF2A5F` | on-air only |

What *is* up for redesign is the discipline with which those are used. Two rules do most of the work:

**The gradient is an identity mark, not a decoration.** Cyan→sky→cobalt belongs on the wordmark and at most one other place per screen. It is currently applied to headings, pills, buttons, avatars, borders and stat numbers, which is why nothing on the page reads as more important than anything else.

**`--live` red is reserved for one meaning: this is happening now.** Not for errors, not for destructive buttons, not for badges that merely look urgent. A viewer must be able to tell a genuinely live broadcast from a looping recording at a glance, from across a room, and red is the only thing on the page allowed to say it.

Surfaces should separate by *value*, not only by a hairline border and a blur. Glassmorphism is currently doing all the work of hierarchy and therefore establishing none.

Numbers are half the content here — viewer counts, coin balances, gift values, follower counts, durations. Use tabular figures everywhere a number can change in place, so a viewer count ticking from 34,200 to 34,201 does not reflow the row.

**Do not use any of these** — they are the current tells of generated UI:

- Tracked-out ALL-CAPS eyebrow labels above headings.
- Meta strings joined by middle dots (`Updated · 2h ago · by Priya`).
- `→` appended to link and button text.
- Gradient washes used as decoration rather than to encode data.
- Identical rounded cards for every piece of content, each with the same `rgba(0,0,0,.1)` shadow.
- `01 / 02 / 03` numbered markers on content that isn't a sequence.
- Fade-and-slide-up entrance animations on every section, and hover lift on every card.
- A monospace face used decoratively on small labels. (Tabular numerals in the data are fine and wanted; monospace-as-vibe is not.)

**And these, which this codebase specifically has:**

- Emoji inside product copy and system messages. `Sent Royal Crown 🎁! 🎉` is a toast written by a machine. Emoji belong in user-generated content and in the reaction palette, nowhere else.
- Gradient text on anything that is not the wordmark.
- Glass-blur panels stacked on glass-blur panels, so depth stops meaning anything.
- Every surface at the same 16–24px radius regardless of what it is.

Motion budget: **one** orchestrated page-load moment, plus motion that responds to user action (opening, expanding, sorting, tipping, going live). Two exceptions, because they carry meaning rather than decoration: the on-air pulse, and the spotlight reel's continuous pan. Both stop entirely under `prefers-reduced-motion`. Nothing else moves on its own.

---

## 4. Layout

**Desktop (1440px+)**
- Left rail, 264px expanded / 72px collapsed, with a persistent toggle: product switcher (five products plus All) above community hubs. Collapsed shows logos with tooltips on hover and focus.
- Top bar: search, live telemetry (viewer count, resolution), KashCoin balance, sign-in / avatar menu. Sticky, with a surface change once scrolled.
- Centre column on a 12-column grid, 24px gutters, max content width 1440px, centred beyond that.
- Order down the centre: hero broadcast stage, spotlight reel, announcements feed.
- Right rail, 320px: live chat, then the gifting leaderboard. Independently scrollable; never pushes the stage narrower than 720px.

**Tablet (768–1023px)**
- Left rail defaults collapsed. Right rail becomes a bottom sheet with a handle, defaulting closed, with an unread badge on the handle.
- The stage keeps 16:9 and full width.

**Mobile (375px)**
- Left rail becomes an off-canvas drawer with a scrim and a focus trap. Top bar keeps search (icon that expands) and the avatar; telemetry collapses to a single on-air chip.
- The stage is the first thing on screen and stays 16:9. Overlays that sit on the video on desktop — the floating comment ticker, the gift banner — move below it rather than covering a 375px-wide picture.
- The spotlight reel keeps its pan but at one card per viewport with snap points.
- Feed cards go full width; the comment drawer becomes a sheet.
- Nothing may overflow horizontally at exactly 375px. Tap targets minimum 44×44px.

---

## 5. Components and required states

Every interactive element needs **default, hover, focus-visible, active, disabled, and loading** treatments. Focus-visible must be a real visible ring, not the browser default and not `outline: none`. Build the skeletons as actual components and expose a toggle to view them.

**Hero broadcast stage** — the single most important element on the page. It shows one of three things and must be unmistakably distinguishable between them:

1. the 24/7 linear channel (looping, seeking locked — this is live television, not a video file);
2. a live event, which supersedes the channel while it runs and carries the on-air treatment;
3. a takeover, when the viewer has clicked another video, which plays with controls, ends, and returns to whatever it interrupted.

The takeover needs a persistent, obvious way back, and a visible indication that the main broadcast is still running underneath. Mute/unmute is a first-class control, not a hover-reveal, because the viewer arrives muted by browser policy and unmuting is the first thing they do.

**Product switcher** — five products plus All. The active item must be distinguishable by something other than colour alone. Each product carries its own brand logo, and those logos are inconsistent in weight and colour — solve that rather than letting the rail look like a sticker sheet.

**Spotlight reel** — a continuously panning row of creator cards, each autoplaying muted video. Pause on hover and on focus. Drag and keyboard scroll. Each card promotes to the stage on click, and the card must make that outcome obvious before the click. Include the loading skeleton.

**Announcements feed** — video posts from NEU TV Official. Per post: like, save, share, a collapsible comment drawer, and a tip control. Clicking the video promotes it to the stage. Engagement counts update optimistically and reconcile against the server, so design the state where a count corrects itself, and the state where a comment is rejected by moderation and has to be pulled back out of the thread.

**Live chat and ticker** — the floating comment ticker over the stage, and the hub chat in the right rail. Both need a moderation-flagged state: a published message awaiting human review looks different from a clean one, without shaming the author.

**Tipping** — a gift palette with nine items from 10 to 1,000 KashCoin. Balances open at zero, so the *insufficient funds* path is the common one, not the edge case: design it as a first-class state with a way forward, not an error toast. A sent gift produces a banner on the stage and a burst of reaction particles.

**Sign-in gate** — five ecosystem SSO buttons plus email. The consent checklist is the screen's most sensitive copy: it lists what the viewer is granting. It must be readable, not decorative, and must not imply a verification that has not happened. Include the "no starter balance" reality — a new viewer opens at zero coins and the celebration must not imply otherwise.

---

## 6. Data — hardcode this, invent nothing generic

**On air now:** *NEU TV Live: The New Economy Central Broadcast Stream* — 34,200 watching, 89,400 likes, 1080p.

**Schedule:** 18:00 Daily New Economy Briefing (30m) · 18:30 WorldStreet 20x Stock Leverage Masterclass (45m) · 19:15 KashPlus 2-Second USD Cashout Telemetry (30m) · 19:45 mARKet Peer-to-Peer Commerce Deep Dive (45m) · 20:30 NEU Global Network & Leadership Keynote (60m).

**Creators in the reel:**
Dr. Kwame Danquah @kwame_macro — *The New Economy: Sovereign Wealth Framework* — NEU TV — 68.9K views — 12:30 — 92.1K followers.
Jin Takahashi @jin_alpha — *Algorithmic Yield Vault Arbitrage Live* — ARK — 52.7K views — 09:05 — 76.4K followers.
Sarah Jenkins @sarah_quant — *24/7 Weekend Market Volatility Map* — WorldStreet — 48.1K views — 07:30 — 63.9K followers.
David Okonkwo @david_trades — *20x TSLA & NVDA Momentum Setup* — WorldStreet — 42.8K views — 04:12 — 38.4K followers.
Mateo Rossi @mateo_gtb — *Ferrari 488 GTB Verified Onchain Escrow* — Tsion Cars — 41.3K views — 06:45 — 58.2K followers.
Elena Vance @elena_pay — *Instant Apple Pay Virtual Card Setup* — KashPlus — 31.5K views — 03:45 — 29.1K followers.

**Feed posts** (all by NEU TV Official @neutv, verified):
*KashPlus Global Virtual Cards: Apple Pay & Google Pay* — 7,850 likes — 89.4K views — 28:50.
*Pastor Chris Launches Christ Embassy Business Trading Desk* — ARK — 7,180 likes — 69.3K views — 22:30.
*NEU TV Market Intel: Macro Liquidity & Institutional Alpha* — 4,820 likes — 54.8K views — 18:40.
*WorldStreet 20x Stock Leverage: Real-Time Trade Execution* — 3,890 likes — 35.7K views — 16:40.
*Ferrari 488 GTB Delivery Day: Verified Onchain Escrow* — Tsion Cars — 3,100 likes — 37.8K views — 09:40.

**Community hubs:** TSION General 58,400 members (#tsion-general, 420 active) · KashPlus 49,100 (#linkpay-cashouts 389, #linkpay-cards 156) · WorldStreet 42,800 (#worldstreet-trades 312, #worldstreet-alerts 185) · mARKet 34,200 (#market-commerce 247) · ARK 28,600 (#ark-vaults 198) · Tsion Cars 19,500 (#tsioncars-marketplace 95).

**Trending:** #LinkPayInstant 48.2K posts · #WorldStreet20x 34.1K posts · #mARKetProtocol 29.8K posts.

**Gift palette:** Applause 10 · Kash Spike 25 · Super Flame 50 · Golden Trophy 75 · Rocket Booster 100 · Diamond Gem 250 · Supercar Key 350 · Royal Crown 500 · Luxury Gift Box 1,000.

**The signed-in viewer** holds **0 KashCoin**. Design for that as the default state.

---

## 7. Copy rules

Sentence case throughout. Buttons say what happens: "Send Royal Crown," not "Confirm." The verb stays the same through the flow. Empty states give direction rather than mood. Errors say what happened and what to do about it, without apologising.

Three rules specific to this product:

- **No emoji in system copy.** Toasts, empty states, button labels, errors and confirmations are written by the product. Emoji belong in user messages and in the reaction palette.
- **One name per product.** The data currently says both "KashPlus" and "LinkPay" for the same thing, including in channel names. Pick KashPlus and use it everywhere the user can see.
- **Never claim a verification that hasn't happened.** SSO badges are currently self-asserted — the ecosystem gateway is not built. Say "WorldStreet member," not "WorldStreet Verified," until it is.

---

## 8. Technical

**Next.js (App Router) + TypeScript + Tailwind.** Design tokens defined once — a Tailwind theme block or CSS custom properties — then referenced. No hardcoded hex scattered through components.

Build against the real API, which exists and is running on `:4173`:

```
GET  /api/v1/catalog/bootstrap             products, hubs, spotlights, schedule, trending
GET  /api/v1/social/posts                  the feed, cursor paginated
GET  /api/v1/live/state?viewerId=…         stage + telemetry + like state
POST /api/v1/live/stage                    promote a video   { videoId, viewerId }
POST /api/v1/live/stage/revert             end a takeover
GET  /api/v1/live-event/current            a live event, if one is on air
GET  /api/v1/live/stream                   SSE: comments, reactions, gifts, chat, live-event
GET  /api/v1/wallet/gifts                  the gift palette with costs
```

Three behaviours the design has to accommodate because the backend already works this way:

- **The stage state machine is server-owned.** A takeover has an expiry and reverts on its own; a live event supersedes the programmed video. Reloading mid-takeover returns the viewer to what they were watching. Do not model this as local component state.
- **SSE pushes changes.** A live event starting, a gift landing, a comment arriving — these appear without a reload. Design what that interruption looks like when the viewer is mid-scroll.
- **Moderation is server-side and optimistic.** A comment posts immediately and can be withdrawn a moment later. That is a designed state, not an error.

The page must render with the API unreachable, using bundled fallback data. Server components for the first paint; client components only where interaction demands it.

---

## 9. Accessibility floor

Text contrast at least 4.5:1 (3:1 for large display numerals). Full keyboard operation, including the reel, the drawer, menus, the gift palette and the comment drawers. Visible focus on everything focusable. Status conveyed by more than colour — on-air, moderation-flagged and product-active states all need a second signal.

`prefers-reduced-motion` is not optional here: under it the spotlight pan stops, the on-air pulse becomes static, and the reaction particle burst does not run. Autoplaying video must be muted and must respect the setting.

The locked live player must still be operable by keyboard for the controls it does expose (mute, fullscreen, tip, react) even though seeking is deliberately disabled.

---

## 10. Explicitly out of scope

Routing to other screens, the admin back office (it exists and has its own design), auth backends, real payments. Build this one screen. Don't stub other pages.

---

## 11. Verify before you finish, then report

Walk this list and tell me the result of each, including anything that failed and what you did about it:

1. Renders with no horizontal overflow at 375, 768, 1024, and 1440px.
2. Every interactive element has all six states, and focus-visible is actually visible against `#060A12`.
3. Every skeleton and every empty state exists and is reachable — including zero-balance tipping, an empty comment thread, a moderation-flagged message, and the API-unreachable fallback.
4. Search, product filter, reel pause, stage promote, revert, tipping, comment post, and the mobile drawer all genuinely work.
5. Every colour, size and space value traces back to a token.
6. No item from either do-not-use list in §3 appears anywhere. Count the gradient usages and the emoji in system copy; both numbers should be small enough to name.
7. Tab order is sane end to end; nothing is a focus trap except the mobile drawer, which should be.
8. Under `prefers-reduced-motion`, the reel, the pulse and the particles are all still.
9. The three stage states are visually distinguishable in a screenshot with no motion — a still frame should tell you whether this is live, looping, or a takeover.
10. Numbers are consistent — the viewer count in the top bar equals the one on the stage, the bell count equals pending items, and the coin balance is the same everywhere it appears.

---

## Adapting this brief

Five slots carry the weight; change these and the rest still holds.

| Slot | This brief | How to swap |
|---|---|---|
| §1 user and four-second question | Trader, "is something worth watching on, and is there a signal to act on" | The single question your screen answers on load, unclicked. Be specific — it's what makes the layout decidable. |
| §3 palette and anti-patterns | NEU brand palette, disciplined | Keep the generic anti-pattern list verbatim; rewrite the second list by looking at what *your* codebase actually overuses. |
| §4 layout | Three columns collapsing to one | Describe by breakpoint, and say what *changes* between them, not just that it's "responsive." |
| §5 component list | 7 components with states | The states paragraph is the load-bearing part. Keep it verbatim for any screen type. |
| §6 data | Real seeded catalog values | Pull them from your own database rather than inventing them. This is the highest-leverage 10 minutes in the whole brief. |

The two things most worth keeping regardless of what you're building: the **plan-critique-build-critique** sequence in §2, and the **verify-and-report** list in §11. They're what turn a wish list into something the model can check itself against.

For the admin back office, the swaps are: user becomes the operator, the four-second question becomes *"is anything on air, and is anything waiting on me?"*, and §5 becomes the studio, the video library and the moderation queue. Everything else stands.
