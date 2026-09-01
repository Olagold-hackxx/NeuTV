// Strip invented engagement from the catalog.
//
// The seed is editorial: titles, creators, thumbnails, video URLs, schedule.
// It also carried numbers - 89,400 likes, 34,200 viewers, "92.1K followers",
// "58,400 Members" - which were never measurements of anything. Showing them
// next to real counts made both meaningless: nobody could tell whether 4,821
// upvotes was one real vote on top of a made-up 4,820, or a real 4,821.
//
// Counts now come from the database or not at all. A brand new deployment shows
// zero, which is true, and every number that moves afterwards is something that
// actually happened.
//
// Deliberately applied when serving rather than by rewriting the seed file: the
// seed is regenerated from editorial content, and a transform here cannot be
// undone by the next person who regenerates it.

const COUNT_FIELDS = new Set([
  'views', 'likes', 'upvotes', 'shares', 'followers',
  'memberCount', 'activeNow', 'viewers', 'postsCount', 'commentCount',
]);

// Kept because they describe the video rather than count an audience.
const KEEP = new Set(['duration', 'durationSeconds', 'time']);

/**
 * Recursively drop count fields. Structure and editorial content are untouched;
 * only the invented numbers go.
 */
export function stripCounts(value) {
  if (Array.isArray(value)) return value.map(stripCounts);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, inner] of Object.entries(value)) {
      if (COUNT_FIELDS.has(key) && !KEEP.has(key)) continue;
      out[key] = stripCounts(inner);
    }
    return out;
  }
  return value;
}

/**
 * Seeded comment threads go too. A comment attributed to a person who never
 * wrote it is worse than an empty thread, and the empty thread is the honest
 * state of a feed nobody has commented on yet.
 */
export function stripSeededComments(posts) {
  return posts.map(({ comments, ...post }) => ({ ...post, comments: [] }));
}
