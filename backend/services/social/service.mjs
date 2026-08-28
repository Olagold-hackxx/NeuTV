// Social service: the official announcements feed and its engagement suite.
//
// Engagement counts are stored as rows, never as columns that get incremented.
// A "likes" integer is a lie the first time a request retries; COUNT(*) over a
// unique (user, post) pair cannot be wrong. Seeded content keeps its shipped
// count in seed_upvotes and the two are added on read, so the feed looks like
// the designed product without pretending seed numbers are real engagement.

import { validate } from '../../platform/validate.mjs';
import { notFound, badRequest, unauthorized } from '../../platform/errors.mjs';

const OFFICIAL = { author: 'NEU TV Official', handle: '@neutv', verified: 1 };

export function createSocialService({
  runtime,
  store,
  catalog,
  moderation = null,
}) {
  // The seed is the designed feed. Loaded once; a restart must not duplicate it.
  // Exposed rather than run in the constructor because it is async now, and a
  // constructor that starts unawaited work is a race waiting to happen.
  async function seed() {
    if ((await store.get('SELECT COUNT(*) AS n FROM posts')).n > 0) return { seeded: false };
    const posts = catalog.seedPosts();
    await store.tx(async (t) => {
      for (const [index, p] of posts.entries()) {
        // Seeded posts keep their designed order: newest first in the array.
        const createdAt = runtime.now() - index * 3_600_000;
        await t.run(
          `INSERT INTO posts (id, author_id, author, handle, avatar, verified, product_id, product_name,
                              category_tag, role, bio, followers, content, video_title, duration, views,
                              youtube_id, video_mp4, media_url, shares, seed_upvotes, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          p.id, null, p.author, p.handle, p.avatar, p.verified ? 1 : 0, p.productId, p.productName ?? '',
          p.categoryTag ?? '', p.role ?? '', p.bio ?? '', p.followers ?? '', p.content ?? '',
          p.videoTitle ?? null, p.duration ?? null, p.views ?? null, p.youtubeId ?? null,
          p.videoMp4 ?? null, p.mediaUrl ?? null, p.shares ?? 0, p.upvotes ?? 0, createdAt,
        );
        for (const c of p.comments ?? []) {
          await t.run(
            'INSERT INTO comments (id, post_id, author_id, author, handle, avatar, text, likes, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            c.id, p.id, null, c.author, c.handle, c.avatar ?? null, c.text, c.likes ?? 0, createdAt + 60_000,
          );
        }
      }
    });
    return { seeded: true, posts: posts.length };
  }

  const upvoteCount = async (postId) =>
    (await store.get('SELECT COUNT(*) AS n FROM upvotes WHERE post_id = ?', postId)).n;

  // Async because the per-post counters and the viewer's own state are reads.
  // Callers map with Promise.all so a page of posts is one round of queries,
  // not a sequential walk.
  const shape = async (row, auth) => ({
    id: row.id,
    author: row.author,
    handle: row.handle,
    avatar: row.avatar,
    verified: Boolean(row.verified),
    productId: row.product_id,
    productName: row.product_name,
    categoryTag: row.category_tag,
    role: row.role,
    bio: row.bio,
    followers: row.followers,
    content: row.content,
    videoTitle: row.video_title,
    duration: row.duration,
    views: row.views,
    youtubeId: row.youtube_id,
    videoMp4: row.video_mp4,
    mediaUrl: row.media_url,
    shares: row.shares,
    // Designed count plus measured count, and both are visible so neither is
    // mistaken for the other.
    upvotes: row.seed_upvotes + await upvoteCount(row.id),
    seedUpvotes: row.seed_upvotes,
    commentCount: (await store.get('SELECT COUNT(*) AS n FROM comments WHERE post_id = ?', row.id)).n,
    createdAt: row.created_at,
    flagged: Boolean(row.flagged),
    // Viewer-specific state, absent for guests.
    isUpvoted: auth ? Boolean(await store.get('SELECT 1 AS x FROM upvotes WHERE user_id = ? AND post_id = ?', auth.userId, row.id)) : false,
    isSaved: auth ? Boolean(await store.get('SELECT 1 AS x FROM saves WHERE user_id = ? AND post_id = ?', auth.userId, row.id)) : false,
    isFollowing: auth ? Boolean(await store.get('SELECT 1 AS x FROM follows WHERE user_id = ? AND handle = ?', auth.userId, row.handle)) : false,
  });

  const getRow = async (postId) => {
    const row = await store.get('SELECT * FROM posts WHERE id = ?', postId);
    if (!row) throw notFound(`No post "${postId}".`);
    return row;
  };

  const gate = async (text, surface, userId) => {
    if (!moderation) return { verdict: 'allow', allowed: true, needsReview: false, matches: [] };
    const res = await moderation.call('moderation', 'POST', '/moderation/check', {
      body: { text, surface }, auth: userId ? { userId } : null,
    });
    if (res.status !== 200) return { verdict: 'allow', allowed: true, needsReview: false, matches: [] };
    return res.body;
  };

  return {
    seed,

    async feed(auth, { productId = null, limit = 20, cursor = null } = {}) {
      const size = Math.min(Math.max(limit, 1), 50);
      // Keyset pagination on created_at: an offset shifts under you every time
      // someone posts while a reader is scrolling.
      const before = cursor ? Number(cursor) : Number.MAX_SAFE_INTEGER;
      const rows = productId && productId !== 'all'
        ? await store.all('SELECT * FROM posts WHERE product_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?', productId, before, size + 1)
        : await store.all('SELECT * FROM posts WHERE created_at < ? ORDER BY created_at DESC LIMIT ?', before, size + 1);

      const page = rows.slice(0, size);
      return {
        posts: await Promise.all(page.map((r) => shape(r, auth))),
        nextCursor: rows.length > size ? String(page[page.length - 1].created_at) : null,
        filter: productId ?? 'all',
      };
    },

    async post(auth, postId) { return { post: await shape(await getRow(postId), auth) }; },

    async create(auth, input) {
      if (!auth) throw unauthorized('Sign in to post.');
      const v = validate(input, {
        content: { type: 'string', required: true, min: 1, max: 2_000 },
        productId: { type: 'string', required: false, default: 'worldstreet', max: 40 },
        mediaUrl: { type: 'string', required: false, max: 600 },
        videoMp4: { type: 'string', required: false, max: 600 },
        youtubeId: { type: 'string', required: false, max: 40 },
        videoTitle: { type: 'string', required: false, max: 200 },
      });
      const product = catalog.product?.(v.productId);
      if (!product) throw badRequest(`"${v.productId}" is not an ecosystem product.`);

      const decision = await gate(v.content, 'post', auth.userId);
      if (!decision.allowed) {
        throw badRequest('That post was blocked by moderation.', {
          reasons: (decision.matches || []).map((m) => m.reason),
        });
      }

      const id = `post_${runtime.uuid()}`;
      await store.run(
        `INSERT INTO posts (id, author_id, author, handle, avatar, verified, product_id, product_name,
                            category_tag, content, media_url, video_mp4, youtube_id, video_title,
                            flagged, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, auth.userId, auth.user.name, auth.user.handle, auth.user.avatar,
        auth.user.verified ? 1 : 0, v.productId, product.name, product.name,
        v.content, v.mediaUrl ?? null, v.videoMp4 ?? null, v.youtubeId ?? null, v.videoTitle ?? null,
        decision.needsReview ? 1 : 0, runtime.now(),
      );
      return { post: await shape(await getRow(id), auth), moderation: { verdict: decision.verdict, needsReview: decision.needsReview } };
    },

    async toggleUpvote(auth, postId) {
      if (!auth) throw unauthorized();
      await getRow(postId);
      const existing = await store.get('SELECT 1 AS x FROM upvotes WHERE user_id = ? AND post_id = ?', auth.userId, postId);
      if (existing) await store.run('DELETE FROM upvotes WHERE user_id = ? AND post_id = ?', auth.userId, postId);
      else await store.run('INSERT INTO upvotes (user_id, post_id, created_at) VALUES (?,?,?)', auth.userId, postId, runtime.now());
      const row = await getRow(postId);
      return { postId, isUpvoted: !existing, upvotes: row.seed_upvotes + await upvoteCount(postId) };
    },

    async toggleSave(auth, postId) {
      if (!auth) throw unauthorized();
      await getRow(postId);
      const existing = await store.get('SELECT 1 AS x FROM saves WHERE user_id = ? AND post_id = ?', auth.userId, postId);
      if (existing) await store.run('DELETE FROM saves WHERE user_id = ? AND post_id = ?', auth.userId, postId);
      else await store.run('INSERT INTO saves (user_id, post_id, created_at) VALUES (?,?,?)', auth.userId, postId, runtime.now());
      return { postId, isSaved: !existing };
    },

    async share(auth, postId, { origin = '' } = {}) {
      const row = await getRow(postId);
      await store.run('UPDATE posts SET shares = shares + 1 WHERE id = ?', postId);
      return { postId, shares: row.shares + 1, url: `${origin}/?post=${postId}` };
    },

    async comments(auth, postId, { limit = 50 } = {}) {
      await getRow(postId);
      return {
        postId,
        comments: await store.all(
          'SELECT id, author, handle, avatar, text, likes, created_at AS "createdAt", flagged FROM comments WHERE post_id = ? ORDER BY created_at ASC LIMIT ?',
          postId, Math.min(limit, 200),
        ),
      };
    },

    async comment(auth, postId, input) {
      if (!auth) throw unauthorized('Sign in to comment.');
      await getRow(postId);
      const { text } = validate(input, { text: { type: 'string', required: true, min: 1, max: 1_000 } });
      const decision = await gate(text, 'comment', auth.userId);
      if (!decision.allowed) {
        throw badRequest('That comment was blocked by moderation.', {
          reasons: (decision.matches || []).map((m) => m.reason),
        });
      }
      const id = `c_${runtime.uuid()}`;
      await store.run(
        'INSERT INTO comments (id, post_id, author_id, author, handle, avatar, text, flagged, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        id, postId, auth.userId, auth.user.name, auth.user.handle, auth.user.avatar, text,
        decision.needsReview ? 1 : 0, runtime.now(),
      );
      return {
        comment: { id, author: auth.user.name, handle: auth.user.handle, avatar: auth.user.avatar, text, likes: 0, createdAt: runtime.now() },
        moderation: { verdict: decision.verdict, needsReview: decision.needsReview },
      };
    },

    async toggleFollow(auth, handle) {
      if (!auth) throw unauthorized();
      const normalized = handle.startsWith('@') ? handle : `@${handle}`;
      if (normalized === auth.user.handle || normalized === auth.user.name) {
        throw badRequest('You cannot follow yourself.');
      }
      const existing = await store.get('SELECT 1 AS x FROM follows WHERE user_id = ? AND handle = ?', auth.userId, normalized);
      if (existing) await store.run('DELETE FROM follows WHERE user_id = ? AND handle = ?', auth.userId, normalized);
      else await store.run('INSERT INTO follows (user_id, handle, created_at) VALUES (?,?,?)', auth.userId, normalized, runtime.now());
      return { handle: normalized, isFollowing: !existing };
    },

    async follows(auth) {
      if (!auth) throw unauthorized();
      return {
        handles: (await store.all('SELECT handle FROM follows WHERE user_id = ? ORDER BY created_at DESC', auth.userId)).map((r) => r.handle),
      };
    },

    // Read port for the admin CRM.
    async engagementSummary() {
      const [posts, comments, upvotes, flagged] = await Promise.all([
        store.get('SELECT COUNT(*) AS n FROM posts'),
        store.get('SELECT COUNT(*) AS n FROM comments'),
        store.get('SELECT COUNT(*) AS n FROM upvotes'),
        store.get('SELECT COUNT(*) AS n FROM posts WHERE flagged = 1'),
      ]);
      return { posts: posts.n, comments: comments.n, upvotes: upvotes.n, flagged: flagged.n };
    },

    close: () => store.close(),
  };
}
