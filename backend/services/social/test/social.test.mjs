import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createSocialService } from '../service.mjs';
import { openSocialStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';

const build = async (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const store = over.store ?? await testStore(openSocialStore);
  const social = createSocialService({ runtime, catalog, ...over, store });
  await social.seed();
  return { runtime, catalog, social, store };
};
const authFor = (id = 'u1') => ({
  userId: id, user: { name: `@${id}`, handle: id, avatar: 'a.png', verified: false },
});

test('the feed is seeded with the designed announcements', async () => {
  const { social, catalog } = await build();
  assert.equal((await social.feed(null, {})).posts.length, catalog.seedPosts().length);
});

test('seeding runs once, so a restart does not duplicate the feed', async () => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const store = await testStore(openSocialStore);

  const first = createSocialService({ runtime, catalog, store });
  assert.equal((await first.seed()).seeded, true, 'first boot seeds');
  const afterFirstBoot = (await first.feed(null, {})).posts.length;

  // Same store, fresh service: this is what a process restart looks like.
  const second = createSocialService({ runtime, catalog, store });
  assert.equal((await second.seed()).seeded, false, 'a restart must not seed again');
  assert.equal((await second.feed(null, {})).posts.length, afterFirstBoot, 'the feed was seeded twice');
  assert.equal(afterFirstBoot, catalog.seedPosts().length);
});

test('guests read the feed without viewer state leaking in', async () => {
  const { social } = await build();
  const post = (await social.feed(null, {})).posts[0];
  assert.equal(post.isUpvoted, false);
  assert.equal(post.isSaved, false);
  assert.equal(post.isFollowing, false);
});

test('upvote is a toggle and cannot be double-counted', async () => {
  const { social } = await build();
  const id = (await social.feed(null, {})).posts[0].id;
  const auth = authFor();
  const base = (await social.post(auth, id)).post.upvotes;
  const on = await social.toggleUpvote(auth, id);
  assert.equal(on.upvotes, base + 1);
  // Same viewer hammering the button cannot inflate the count.
  await social.toggleUpvote(auth, id);
  const again = await social.toggleUpvote(auth, id);
  assert.equal(again.upvotes, base + 1);
  assert.equal(again.isUpvoted, true);
});

test('two viewers each add one upvote', async () => {
  const { social } = await build();
  const id = (await social.feed(null, {})).posts[0].id;
  const base = (await social.post(null, id)).post.upvotes;
  await social.toggleUpvote(authFor('u1'), id);
  const res = await social.toggleUpvote(authFor('u2'), id);
  assert.equal(res.upvotes, base + 2);
});

test('a seeded post starts at zero engagement', async () => {
  // The seed is editorial - video, title, creator - and carries no counts. A
  // post that ships claiming 4,820 upvotes makes the 4,821st meaningless.
  const { social } = await build();
  const post = (await social.feed(null, {})).posts[0];
  assert.equal(post.upvotes, 0, 'no invented upvotes');
  assert.equal(post.commentCount, 0, 'no invented comment thread');
  assert.ok(!('seedUpvotes' in post), 'and nothing to add a real count to');
  assert.ok(post.videoMp4 || post.youtubeId, 'but the video is still there');

  await social.toggleUpvote(authFor(), post.id);
  assert.equal((await social.post(null, post.id)).post.upvotes, 1, 'the first real vote reads as 1');
});

test('save and follow are per-viewer toggles', async () => {
  const { social } = await build();
  const id = (await social.feed(null, {})).posts[0].id;
  const auth = authFor();
  assert.equal((await social.toggleSave(auth, id)).isSaved, true);
  assert.equal((await social.toggleSave(auth, id)).isSaved, false);
  assert.equal((await social.toggleFollow(auth, 'neutv')).handle, '@neutv');
  assert.equal((await social.follows(auth)).handles.length, 1);
  await social.toggleFollow(auth, '@neutv');
  assert.equal((await social.follows(auth)).handles.length, 0);
  assert.equal((await social.post(authFor('u2'), id)).post.isSaved, false, 'another viewer is unaffected');
});

test('you cannot follow yourself', async () => {
  const { social } = await build();
  await assert.rejects(() => social.toggleFollow(authFor('u1'), '@u1'), (e) => e.status === 400);
});

test('the feed filters by ecosystem product', async () => {
  const { social } = await build();
  const ark = await social.feed(null, { productId: 'ark' });
  assert.ok(ark.posts.length > 0);
  assert.ok(ark.posts.every((p) => p.productId === 'ark'));
  assert.equal((await social.feed(null, { productId: 'all' })).posts.length, (await social.feed(null, {})).posts.length);
});

test('pagination is stable while new posts arrive', async () => {
  const { runtime, social } = await build();
  const first = await social.feed(null, { limit: 2 });
  assert.equal(first.posts.length, 2);
  assert.ok(first.nextCursor);
  // Someone posts while a reader is mid-scroll. Keyset paging must not shift.
  runtime.advance(10_000);
  await social.create(authFor(), { content: 'a brand new post arrives', productId: 'ark' });
  const second = await social.feed(null, { limit: 2, cursor: first.nextCursor });
  const overlap = second.posts.filter((p) => first.posts.some((f) => f.id === p.id));
  assert.equal(overlap.length, 0, 'no post appears on two pages');
});

test('the last page reports no cursor', async () => {
  const { social } = await build();
  assert.equal((await social.feed(null, { limit: 50 })).nextCursor, null);
});

test('a post blocked by moderation never lands in the feed', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'block', allowed: false, matches: [{ reason: 'scam' }] } }) };
  const { social } = await build({ moderation });
  const before = (await social.feed(null, {})).posts.length;
  await assert.rejects(() => social.create(authFor(), { content: 'send 1 eth get 2 back' }), (e) => e.status === 400);
  assert.equal((await social.feed(null, {})).posts.length, before);
});

test('a flagged post lands but is marked for review', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'flag', allowed: true, needsReview: true, matches: [] } }) };
  const { social } = await build({ moderation });
  const res = await social.create(authFor(), { content: 'check bit.ly/x' });
  assert.equal(res.post.flagged, true);
  assert.equal((await social.engagementSummary()).flagged, 1);
});

test('comments are gated the same way posts are', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'block', allowed: false, matches: [] } }) };
  const { social } = await build({ moderation });
  const id = (await social.feed(null, {})).posts[0].id;
  const before = (await social.comments(null, id)).comments.length;
  await assert.rejects(() => social.comment(authFor(), id, { text: 'seed phrase please' }), (e) => e.status === 400);
  assert.equal((await social.comments(null, id)).comments.length, before);
});

test('a comment lands and bumps the count', async () => {
  const { social } = await build();
  const id = (await social.feed(null, {})).posts[0].id;
  const before = (await social.post(null, id)).post.commentCount;
  await social.comment(authFor(), id, { text: 'Great breakdown' });
  assert.equal((await social.post(null, id)).post.commentCount, before + 1);
});

test('a post must belong to a real ecosystem product', async () => {
  const { social } = await build();
  await assert.rejects(() => social.create(authFor(), { content: 'hi', productId: 'fakebank' }), (e) => e.status === 400);
});

test('empty and oversized content are refused', async () => {
  const { social } = await build();
  await assert.rejects(() => social.create(authFor(), { content: '   ' }), (e) => e.status === 400);
  await assert.rejects(() => social.create(authFor(), { content: 'x'.repeat(2001) }), (e) => e.status === 400);
});

test('guests cannot write anything', async () => {
  const { social } = await build();
  const id = (await social.feed(null, {})).posts[0].id;
  await assert.rejects(() => social.create(null, { content: 'hi' }), (e) => e.status === 401);
  await assert.rejects(() => social.comment(null, id, { text: 'hi' }), (e) => e.status === 401);
  await assert.rejects(() => social.toggleUpvote(null, id), (e) => e.status === 401);
  await assert.rejects(() => social.toggleSave(null, id), (e) => e.status === 401);
  await assert.rejects(() => social.follows(null), (e) => e.status === 401);
});

test('an unknown post is a 404 everywhere', async () => {
  const { social } = await build();
  await assert.rejects(() => social.post(null, 'nope'), (e) => e.status === 404);
  await assert.rejects(() => social.toggleUpvote(authFor(), 'nope'), (e) => e.status === 404);
  await assert.rejects(() => social.comments(null, 'nope'), (e) => e.status === 404);
});

test('sharing returns a link that reopens the post', async () => {
  const { social } = await build();
  const id = (await social.feed(null, {})).posts[0].id;
  const res = await social.share(null, id, { origin: 'https://neu.tv' });
  assert.equal(res.url, `https://neu.tv/?post=${id}`);
  assert.equal((await social.share(null, id, {})).shares, res.shares + 1);
});
