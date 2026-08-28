import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createLiveService } from '../service.mjs';

const build = (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const live = createLiveService({ runtime, catalog, ...over });
  return { runtime, catalog, live };
};
const VIEWER = 'anon-abc12345';
const authFor = (id = 'u1', role = 'viewer') => ({
  userId: id, role, scopes: [],
  user: { name: `@${id}`, handle: id, avatar: 'a.png', badge: 'WorldStreet Verified' },
});

test('a click takes the stage and it reverts on its own', async () => {
  const { runtime, live } = build();
  const before = await live.stage(null, { viewerId: VIEWER });
  assert.equal(before.isOverride, false);

  const during = await live.takeStage(null, { videoId: 'cr-1', viewerId: VIEWER });
  assert.equal(during.current.id, 'cr-1');
  assert.equal(during.isOverride, true);

  runtime.advance(during.revertsIn - 1);
  assert.equal((await live.stage(null, { viewerId: VIEWER })).current.id, 'cr-1');

  runtime.advance(2);
  const after = await live.stage(null, { viewerId: VIEWER });
  assert.equal(after.isOverride, false);
  assert.equal(after.current.id, before.current.id);
});

test('one viewer taking the stage does not change what anyone else sees', async () => {
  const { live } = build();
  await live.takeStage(null, { videoId: 'cr-1', viewerId: VIEWER });
  const other = await live.stage(null, { viewerId: 'anon-other999' });
  assert.equal(other.isOverride, false);
});

test('closing a video early returns to the main broadcast immediately', async () => {
  const { live } = build();
  await live.takeStage(null, { videoId: 'cr-1', viewerId: VIEWER });
  const reverted = await live.revertStage(null, { viewerId: VIEWER });
  assert.equal(reverted.isOverride, false);
});

test('a global promote needs broadcast rights and then moves every stage', async () => {
  const { live } = build();
  await assert.rejects(
    () => live.takeStage(authFor('u1'), { videoId: 'cr-1', scope: 'broadcast' }),
    (err) => err.status === 403,
  );
  await live.takeStage(authFor('admin1', 'admin'), { videoId: 'cr-3', scope: 'broadcast' });
  const guest = await live.stage(null, { viewerId: 'anon-somebody1' });
  assert.equal(guest.current.id, 'cr-3');
  assert.equal(guest.scope, 'broadcast');
});

test('an unknown video cannot take the stage', async () => {
  const { live } = build();
  await assert.rejects(
    () => live.takeStage(null, { videoId: 'does-not-exist', viewerId: VIEWER }),
    (err) => err.status === 404,
  );
});

test('an anonymous viewer needs a well formed viewerId', async () => {
  const { live } = build();
  await assert.rejects(() => live.takeStage(null, { videoId: 'cr-1' }), (e) => e.status === 400);
  await assert.rejects(() => live.takeStage(null, { videoId: 'cr-1', viewerId: 'ab' }), (e) => e.status === 400);
  await assert.rejects(() => live.takeStage(null, { videoId: 'cr-1', viewerId: '../etc' }), (e) => e.status === 400);
});

test('viewer count measures presence heartbeats and decays', () => {
  const { runtime, live } = build();
  live.presence(null, { viewerId: 'anon-viewer001' });
  live.presence(null, { viewerId: 'anon-viewer002' });
  assert.equal(live.telemetry().viewers, 2);
  runtime.advance(46_000); // past the presence window
  assert.equal(live.telemetry().viewers, 0, 'a tab that stopped beating stops counting');
});

test('seeded viewer numbers are reported separately from measured ones', () => {
  const { live, catalog } = build();
  const t = live.telemetry();
  assert.equal(t.viewers, 0, 'nothing measured yet');
  assert.equal(t.baselineViewers, catalog.centralTv().viewers, 'seed content, clearly labelled');
});

test('blocked live comments never reach the ticker', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'block', allowed: false, needsReview: false, matches: [{ reason: 'scam' }] } }) };
  const { live } = build({ moderation });
  await assert.rejects(() => live.postComment(authFor(), { text: 'send 1 eth get 2 back' }), (e) => e.status === 400);
  assert.equal(live.comments().seeded, true, 'nothing was published');
});

test('flagged comments publish but are marked for review', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'flag', allowed: true, needsReview: true, matches: [] } }) };
  const { live } = build({ moderation });
  const res = await live.postComment(authFor(), { text: 'check bit.ly/x' });
  assert.equal(res.moderation.needsReview, true);
  assert.equal(live.comments().comments[0].flagged, 1);
});

test('the ticker falls back to seeded chatter only while it is empty', async () => {
  const { live } = build();
  assert.equal(live.comments().seeded, true);
  await live.postComment(authFor(), { text: 'first real message' });
  const after = live.comments();
  assert.equal(after.seeded, false);
  assert.equal(after.comments[0].text, 'first real message');
});

test('reactions accumulate and reject anything off the palette', () => {
  const { live } = build();
  assert.equal(live.react(null, { emoji: '🔥' }).total, 1);
  assert.equal(live.react(null, { emoji: '🔥' }).total, 2);
  assert.throws(() => live.react(null, { emoji: '💩' }), (e) => e.status === 400);
});

test('the broadcast like is a toggle, not a counter that can run away', async () => {
  const { live } = build();
  const auth = authFor('u1');
  assert.equal((await live.toggleLike(auth)).total, 1);
  assert.equal((await live.toggleLike(auth)).total, 0, 'same viewer un-likes');
  await live.toggleLike(auth);
  assert.equal((await live.toggleLike(authFor('u2'))).total, 2, 'a different viewer adds one');
});

test('hub chat rejects a channel that does not exist', async () => {
  const { live } = build();
  assert.throws(() => live.chat('worldstreet', 'no-such-channel'), (e) => e.status === 404);
  await assert.rejects(() => live.postChat(authFor(), 'worldstreet', 'nope', { text: 'hi' }), (e) => e.status === 404);
});

test('hub chat stores and returns messages in order', async () => {
  const { runtime, live } = build();
  await live.postChat(authFor(), 'worldstreet', 'ws-c1', { text: 'first' });
  runtime.tick();
  await live.postChat(authFor('u2'), 'worldstreet', 'ws-c1', { text: 'second' });
  const { messages } = live.chat('worldstreet', 'ws-c1');
  assert.deepEqual(messages.map((m) => m.text), ['first', 'second']);
});
