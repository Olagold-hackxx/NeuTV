# catalog

The content spine of the network: products, community hubs, creator spotlights,
media rows, platforms, schedule, VOD, hashtags, trending, and search.

**No database.** Everything derives from `seed/catalog.seed.json` plus the
clock, so there is no mutable state and nothing for two processes to disagree
about. The seed is committed content, edited in place.

- `GET /catalog/bootstrap` returns the whole `window.CentralData` payload, so
  the existing frontend can drop it in.
- `SCHEDULE_ITEMS` is resolved against the clock. The seed's static `isCurrent`
  flag is ignored: a 24/7 channel cannot have a block that is permanently on
  air. Outside the published grid the list loops, and that block is marked
  `looped: true` rather than pretending it was scheduled.
- Search is deterministic scoring. Prefix beats substring, title beats body,
  ties break by kind then id, so the same query always returns the same order.

Tests: `npm run test:catalog`. Eval: search precision@1, threshold 75%.
