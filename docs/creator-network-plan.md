# NEU Network — creators, viewers, and the incentive engine

A working proposal for the platform notes of 2026-09-02. It turns the ideas
into a model that fits what is already built (NEU Passport, KashCoin wallet,
the spotlight rail, the browser studio) and answers the open question:
*what is the incentivization process?*

## 1. Two roles, one passport

Everyone signs in with the same NEU Passport. **Viewer** is the default role.
**Creator** is an upgrade on the same account — approved, subscribed, and
badged — never a separate identity system. This reuses the identity service
as-is: `role` is already a stored column; `creator` becomes a third value
beside `viewer` and `admin`.

- **Viewers** watch, chat, gift, and subscribe.
- **Creators** publish videos and go live *into the Creator Spotlight only*.

## 2. The spotlight is the creators' stage — the main view is untouched

The main broadcast stays exactly what it is today: programmed by the network
in the back office, with live events outranking it. Creators never take the
main stage.

Instead, each creator gets a **spotlight channel**: their uploads and their
live sessions appear as cards in the Creator Spotlight rail. A creator going
live puts a LIVE badge on their card; clicking it plays their stream *in the
expanded viewer or as a personal takeover* — the network's broadcast keeps
running underneath for everyone else. Technically this is the existing
machinery reused: the admin's upload pipeline and browser studio (WHIP /
segment ingest) scoped to a creator's own channel instead of the network
stage.

## 3. The creators portal

A separate portal (own subdomain, same Passport sign-in) where creators:

- **Receive tasks.** The network posts briefs — "cover the WorldStreet
  keynote", "3-minute explainer on KashPlus cashouts" — each with a deadline
  and a KashCoin bounty. Creators accept, deliver through the portal, and the
  delivery lands in the moderation/review queue before it reaches the
  spotlight.
- **Publish.** Upload videos and go live to their spotlight channel with the
  same studio the back office uses.
- **See their numbers.** Views, watch time, gifts received, task earnings,
  payout history.
- **Get paid.** Earnings accrue in KashCoin and cash out through KashPlus —
  the 2-second USD cashout is the ecosystem's own pitch; use it.

The creator *community* (discussion, collaboration, networking) lives on
**WorldSpace**, not here — the portal links out to it. NEU Network hosts the
work; WorldSpace hosts the conversation.

## 4. The incentive engine — the answer to the open question

Subscription is the **gate**, not the incentive. People do not create because
they paid; they create because creating pays. Three earning streams, all
denominated in KashCoin so the wallet and ledger already built carry them:

1. **Gift share.** Gifts sent on a creator's spotlight content split
   creator/network (say 70/30). This already half-exists: gifts, the ledger
   and the leaderboard are live today — the split is a ledger rule.
2. **Task bounties.** Fixed KashCoin per accepted brief. This is the
   "receives tasks on the platform" idea made concrete: it is commissioned
   work, so payment is guaranteed on acceptance, which is what attracts
   serious creators before an audience exists.
3. **Spotlight pool.** A fixed share of monthly *viewer* subscription revenue
   goes into a pool, split by verified watch time across spotlight content.
   This ties creator income to what viewers actually watch, and it scales
   with the audience.

And the subscriptions themselves:

- **Viewer subscription** — full HD, ad-free, and a monthly KashCoin
  allowance included (which viewers then gift onward: the allowance feeds
  stream 1, so the subscription money circulates *through* creators rather
  than around them).
- **Creator subscription** — unlocks the portal, spotlight placement, and
  the task marketplace. Priced low; it is a commitment filter and a spam
  gate, not a profit center. A creator who works even a little earns it back
  through streams 1–3, which is the point.

## 5. The network rules

- **Everything points home.** Every ecosystem platform (WorldStreet,
  mARKet) shows teasers, clips and
  headlines only — full content lives on NEU Network and every card links
  here. No platform carries full content about itself on itself.
- **E-News.** A downloadable magazine (monthly, PDF/EPUB) assembled from the
  announcements feed and the best spotlight work — distributed on the portal
  and teased across the platforms. Free tease, full issue for subscribers.
- **The press desk.** Accredited agencies on the network's payroll get a
  press role in the portal: embargoed story packets, downloadable assets and
  the E-News early. They collect stories *here* and carry them out to the
  public — the network is the source of record.

## 6. Build order

| Phase | Ships | Reuses |
|---|---|---|
| 1 | `creator` role, creator uploads + live to spotlight, gift split | identity roles, admin upload/studio, wallet ledger |
| 2 | Creators portal (tasks, analytics), viewer + creator subscriptions | Passport SSO, moderation queue, KashPlus payments |
| 3 | Spotlight pool payouts, E-News pipeline, press desk, WorldSpace links | ledger, catalog/announcements feed |

Phase 1 needs no new product surface — it is scoping what exists. The portal
is the first genuinely new build.
