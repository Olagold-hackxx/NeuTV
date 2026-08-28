# social

The official announcements feed and its engagement suite.

- Seeded once from the catalog's designed posts; a restart does not duplicate
  the feed.
- **Engagement is rows, not counters.** A unique `(user, post)` pair means a
  double-tap cannot inflate anything.
- **Designed vs measured counts stay separate.** `seedUpvotes` is the number
  shipped with the content; `upvotes` adds real ones on top. Neither is
  mistaken for the other.
- **Keyset pagination** on `created_at`, so a post arriving mid-scroll cannot
  shift a page under the reader.
- Every post and comment passes the moderation gate. Blocked content never
  lands; flagged content lands marked for review.

Tests: `npm run test:social`.
