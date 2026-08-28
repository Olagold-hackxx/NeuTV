import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createSocialService } from '../service.mjs';
import { openSocialStore } from '../store.mjs';

const build = (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  return { runtime, catalog, social: createSocialService({ runtime, catalog, ...over }) };
};
const authFor = (id = 'u1') => ({
  userId: id, user: { name: `@${id}`, handle: id, avatar: 'a.png', verified: false },
});

test('the feed is seeded with the designed announcements', () => {
  const { social, catalog } = build();
  assert.equal(social.feed(null, {}).posts.length, catalog.seedPosts().length);
});

test('seeding runs once, so a restart does not duplicate the feed', () => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const store = openSocialStore(':memory:');
  const first = createSocialService({ runtime, catalog, store });
  const afterFirstBoot = first.feed(null, {}).posts.length;
  // Same store, fresh service: this is what a process restart looks like.
  const second = createSocialService({ runtime, catalog, store });
  assert.equal(second.feed(null, {}).posts.length, afterFirstBoot, 'the feed was seeded twice');
  assert.equal(afterFirstBoot, catalog.seedPosts().length);
});

test('guests read the feed without viewer state leaking in', () => {
  const { social } = build();
  const post = social.feed(null, {}).posts[0];
  assert.equal(post.isUpvoted, false);
  assert.equal(post.isSaved, false);
  assert.equal(post.isFollowing, false);
});

test('upvote is a toggle and cannot be double-counted', () => {
  const { social } = build();
  const id = social.feed(null, {}).posts[0].id;
  const auth = authFor();
  const base = social.post(auth, id).post.upvotes;
  const on = social.toggleUpvote(auth, id);
  assert.equal(on.upvotes, base + 1);
  // Same viewer hammering the button cannot inflate the count.
  social.toggleUpvote(auth, id);
  const again = social.toggleUpvote(auth, id);
  assert.equal(again.upvotes, base + 1);
  assert.equal(again.isUpvoted, true);
});

test('two viewers each add one upvote', () => {
  const { social } = build();
  const id = social.feed(null, {}).posts[0].id;
  const base = social.post(null, id).post.upvotes;
  social.toggleUpvote(authFor('u1'), id);
  const res = social.toggleUpvote(authFor('u2'), id);
  assert.equal(res.upvotes, base + 2);
});

test('designed counts and measured counts are both visible and never conflated', () => {
  const { social } = build();
  const id = social.feed(null, {}).posts[0].id;
  const before = social.post(null, id).post;
  assert.ok(before.seedUpvotes > 0, 'the seed ships a designed number');
  social.toggleUpvote(authFor(), id);
  const after = social.post(null, id).post;
  assert.equal(after.seedUpvotes, before.seedUpvotes, 'the seed number never moves');
  assert.equal(after.upvotes, before.seedUpvotes + 1);
});

test('save and follow are per-viewer toggles', () => {
  const { social } = build();
  const id = social.feed(null, {}).posts[0].id;
  const auth = authFor();
  assert.equal(social.toggleSave(auth, id).isSaved, true);
  assert.equal(social.toggleSave(auth, id).isSaved, false);
  assert.equal(social.toggleFollow(auth, 'neutv').handle, '@neutv');
  assert.equal(social.follows(auth).handles.length, 1);
  social.toggleFollow(auth, '@neutv');
  assert.equal(social.follows(auth).handles.length, 0);
  assert.equal(social.post(authFor('u2'), id).post.isSaved, false, 'another viewer is unaffected');
});

test('you cannot follow yourself', () => {
  const { social } = build();
  assert.throws(() => social.toggleFollow(authFor('u1'), '@u1'), (e) => e.status === 400);
});

test('the feed filters by ecosystem product', () => {
  const { social } = build();
  const ark = social.feed(null, { productId: 'ark' });
  assert.ok(ark.posts.length > 0);
  assert.ok(ark.posts.every((p) => p.productId === 'ark'));
  assert.equal(social.feed(null, { productId: 'all' }).posts.length, social.feed(null, {}).posts.length);
});

test('pagination is stable while new posts arrive', async () => {
  const { runtime, social } = build();
  const first = social.feed(null, { limit: 2 });
  assert.equal(first.posts.length, 2);
  assert.ok(first.nextCursor);
  // Someone posts while a reader is mid-scroll. Keyset paging must not shift.
  runtime.advance(10_000);
  await social.create(authFor(), { content: 'a brand new post arrives', productId: 'ark' });
  const second = social.feed(null, { limit: 2, cursor: first.nextCursor });
  const overlap = second.posts.filter((p) => first.posts.some((f) => f.id === p.id));
  assert.equal(overlap.length, 0, 'no post appears on two pages');
});

test('the last page reports no cursor', () => {
  const { social } = build();
  assert.equal(social.feed(null, { limit: 50 }).nextCursor, null);
});

test('a post blocked by moderation never lands in the feed', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'block', allowed: false, matches: [{ reason: 'scam' }] } }) };
  const { social } = build({ moderation });
  const before = social.feed(null, {}).posts.length;
  await assert.rejects(() => social.create(authFor(), { content: 'send 1 eth get 2 back' }), (e) => e.status === 400);
  assert.equal(social.feed(null, {}).posts.length, before);
});

test('a flagged post lands but is marked for review', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'flag', allowed: true, needsReview: true, matches: [] } }) };
  const { social } = build({ moderation });
  const res = await social.create(authFor(), { content: 'check bit.ly/x' });
  assert.equal(res.post.flagged, true);
  assert.equal(social.engagementSummary().flagged, 1);
});

test('comments are gated the same way posts are', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'block', allowed: false, matches: [] } }) };
  const { social } = build({ moderation });
  const id = social.feed(null, {}).posts[0].id;
  const before = social.comments(null, id).comments.length;
  await assert.rejects(() => social.comment(authFor(), id, { text: 'seed phrase please' }), (e) => e.status === 400);
  assert.equal(social.comments(null, id).comments.length, before);
});

test('a comment lands and bumps the count', async () => {
  const { social } = build();
  const id = social.feed(null, {}).posts[0].id;
  const before = social.post(null, id).post.commentCount;
  await social.comment(authFor(), id, { text: 'Great breakdown' });
  assert.equal(social.post(null, id).post.commentCount, before + 1);
});

test('a post must belong to a real ecosystem product', async () => {
  const { social } = build();
  await assert.rejects(() => social.create(authFor(), { content: 'hi', productId: 'fakebank' }), (e) => e.status === 400);
});

test('empty and oversized content are refused', async () => {
  const { social } = build();
  await assert.rejects(() => social.create(authFor(), { content: '   ' }), (e) => e.status === 400);
  await assert.rejects(() => social.create(authFor(), { content: 'x'.repeat(2001) }), (e) => e.status === 400);
});

test('guests cannot write anything', async () => {
  const { social } = build();
  const id = social.feed(null, {}).posts[0].id;
  await assert.rejects(() => social.create(null, { content: 'hi' }), (e) => e.status === 401);
  await assert.rejects(() => social.comment(null, id, { text: 'hi' }), (e) => e.status === 401);
  assert.throws(() => social.toggleUpvote(null, id), (e) => e.status === 401);
  assert.throws(() => social.toggleSave(null, id), (e) => e.status === 401);
  assert.throws(() => social.follows(null), (e) => e.status === 401);
});

test('an unknown post is a 404 everywhere', () => {
  const { social } = build();
  assert.throws(() => social.post(null, 'nope'), (e) => e.status === 404);
  assert.throws(() => social.toggleUpvote(authFor(), 'nope'), (e) => e.status === 404);
  assert.throws(() => social.comments(null, 'nope'), (e) => e.status === 404);
});

test('sharing returns a link that reopens the post', () => {
  const { social } = build();
  const id = social.feed(null, {}).posts[0].id;
  const res = social.share(null, id, { origin: 'https://neu.tv' });
  assert.equal(res.url, `https://neu.tv/?post=${id}`);
  assert.equal(social.share(null, id, {}).shares, res.shares + 1);
});
