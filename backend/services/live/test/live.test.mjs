import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createLiveService } from '../service.mjs';
import { openLiveStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';

const build = async (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const live = createLiveService({ runtime, catalog, store: await testStore(openLiveStore), ...over });
  return { runtime, catalog, live };
};
const VIEWER = 'anon-abc12345';
const authFor = (id = 'u1', role = 'viewer') => ({
  userId: id, role, scopes: [],
  user: { name: `@${id}`, handle: id, avatar: 'a.png', badge: 'WorldStreet Verified' },
});

test('a click takes the stage and it reverts on its own', async () => {
  const { runtime, live } = await build();
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
  const { live } = await build();
  await live.takeStage(null, { videoId: 'cr-1', viewerId: VIEWER });
  const other = await live.stage(null, { viewerId: 'anon-other999' });
  assert.equal(other.isOverride, false);
});

test('closing a video early returns to the main broadcast immediately', async () => {
  const { live } = await build();
  await live.takeStage(null, { videoId: 'cr-1', viewerId: VIEWER });
  const reverted = await live.revertStage(null, { viewerId: VIEWER });
  assert.equal(reverted.isOverride, false);
});

test('a global promote needs broadcast rights and then moves every stage', async () => {
  const { live } = await build();
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
  const { live } = await build();
  await assert.rejects(
    () => live.takeStage(null, { videoId: 'does-not-exist', viewerId: VIEWER }),
    (err) => err.status === 404,
  );
});

test('an anonymous viewer needs a well formed viewerId', async () => {
  const { live } = await build();
  await assert.rejects(() => live.takeStage(null, { videoId: 'cr-1' }), (e) => e.status === 400);
  await assert.rejects(() => live.takeStage(null, { videoId: 'cr-1', viewerId: 'ab' }), (e) => e.status === 400);
  await assert.rejects(() => live.takeStage(null, { videoId: 'cr-1', viewerId: '../etc' }), (e) => e.status === 400);
});

test('viewer count measures presence heartbeats and decays', async () => {
  const { runtime, live } = await build();
  await live.presence(null, { viewerId: 'anon-viewer001' });
  await live.presence(null, { viewerId: 'anon-viewer002' });
  assert.equal((await live.telemetry()).viewers, 2);
  runtime.advance(46_000); // past the presence window
  assert.equal((await live.telemetry()).viewers, 0, 'a tab that stopped beating stops counting');
});

test('the viewer count is measured, and there is no invented baseline', async () => {
  const { live, catalog } = await build();
  const t = await live.telemetry();
  assert.equal(t.viewers, 0, 'nobody is watching yet, so it says nobody');
  assert.ok(!('baselineViewers' in t), 'no seeded floor to sit on top of');
  assert.equal(catalog.centralTv().viewers, undefined, 'the catalog no longer ships one');
});

test('blocked live comments never reach the ticker', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'block', allowed: false, needsReview: false, matches: [{ reason: 'scam' }] } }) };
  const { live } = await build({ moderation });
  await assert.rejects(() => live.postComment(authFor(), { text: 'send 1 eth get 2 back' }), (e) => e.status === 400);
  assert.equal((await live.comments()).comments.length, 0, 'nothing was published');
});

test('flagged comments publish but are marked for review', async () => {
  const moderation = { call: async () => ({ status: 200, body: { verdict: 'flag', allowed: true, needsReview: true, matches: [] } }) };
  const { live } = await build({ moderation });
  const res = await live.postComment(authFor(), { text: 'check bit.ly/x' });
  assert.equal(res.moderation.needsReview, true);
  assert.equal((await live.comments()).comments[0].flagged, 1);
});

test('the ticker starts empty rather than inventing chatter', async () => {
  // It used to fall back to seeded messages attributed to named people, which
  // read as real viewers talking. An empty ticker is the honest state.
  const { live } = await build();
  assert.deepEqual((await live.comments()).comments, []);
  await live.postComment(authFor(), { text: 'first real message' });
  const after = await live.comments();
  assert.equal(after.comments.length, 1);
  assert.equal(after.comments[0].text, 'first real message');
});

test('reactions accumulate and reject anything off the palette', async () => {
  const { live } = await build();
  assert.equal((await live.react(null, { emoji: '🔥' })).total, 1);
  assert.equal((await live.react(null, { emoji: '🔥' })).total, 2);
  await assert.rejects(() => live.react(null, { emoji: '💩' }), (e) => e.status === 400);
});

test('the broadcast like is a toggle, not a counter that can run away', async () => {
  const { live } = await build();
  const auth = authFor('u1');
  assert.equal((await live.toggleLike(auth)).total, 1);
  assert.equal((await live.toggleLike(auth)).total, 0, 'same viewer un-likes');
  await live.toggleLike(auth);
  assert.equal((await live.toggleLike(authFor('u2'))).total, 2, 'a different viewer adds one');
});

test('hub chat rejects a channel that does not exist', async () => {
  const { live } = await build();
  await assert.rejects(() => live.chat('worldstreet', 'no-such-channel'), (e) => e.status === 404);
  await assert.rejects(() => live.postChat(authFor(), 'worldstreet', 'nope', { text: 'hi' }), (e) => e.status === 404);
});

test('hub chat stores and returns messages in order', async () => {
  const { runtime, live } = await build();
  await live.postChat(authFor(), 'worldstreet', 'ws-c1', { text: 'first' });
  runtime.tick();
  await live.postChat(authFor('u2'), 'worldstreet', 'ws-c1', { text: 'second' });
  const { messages } = await live.chat('worldstreet', 'ws-c1');
  assert.deepEqual(messages.map((m) => m.text), ['first', 'second']);
});

test('the stage resolves an admin video through the public route, not the admin one', async () => {
  // Pinning the deployment-mode bug: resolving through /admin/videos worked
  // in-process because loopback skips the gateway's auth gate, and would 403
  // once the services were split across hosts.
  const calls = [];
  const programmeClient = {
    call: async (service, method, path) => {
      calls.push(path);
      if (path === '/programme/current') return { status: 200, body: { video: null } };
      if (path === '/videos/vid-1') {
        return { status: 200, body: { video: { id: 'vid-1', title: 'Uploaded Clip', durationSeconds: 60, playbackUrl: '/media/vid-1.mp4' } } };
      }
      return { status: 404, body: null };
    },
  };
  const { live } = await build({ programmeClient });
  const stage = await live.takeStage(null, { videoId: 'vid-1', viewerId: VIEWER });
  assert.equal(stage.current.id, 'vid-1');
  assert.ok(calls.includes('/videos/vid-1'), 'must use the public route');
  assert.ok(!calls.some((p) => p.startsWith('/admin/')), 'must not depend on an admin-only route');
});

test('a video attached to an announcement post can take the stage', async () => {
  // Clicking a video in the feed puts it on the main stage, so the stage must
  // resolve a post id, not only spotlights and uploads.
  const socialClient = {
    call: async (_service, _method, path) => {
      if (path === '/social/posts/post-neu-1') {
        return {
          status: 200,
          body: {
            post: {
              id: 'post-neu-1', videoTitle: 'TSLA Breakout', productId: 'worldstreet',
              productName: 'WorldStreet', author: 'NEU TV Official', handle: '@neutv',
              videoMp4: 'https://cdn/x.mp4', duration: '03:00', content: 'a breakdown',
            },
          },
        };
      }
      return { status: 404, body: null };
    },
  };
  const { live } = await build({ socialClient });
  const stage = await live.takeStage(null, { videoId: 'post-neu-1', viewerId: VIEWER });
  assert.equal(stage.current.id, 'post-neu-1');
  assert.equal(stage.current.kind, 'post');
  assert.equal(stage.current.videoUrl, 'https://cdn/x.mp4');
  assert.equal(stage.revertsIn, 180_000, 'holds the stage for the length of the video');
});

test('a post with no video cannot take the stage', async () => {
  const socialClient = {
    call: async () => ({ status: 200, body: { post: { id: 'post-text', content: 'just text' } } }),
  };
  const { live } = await build({ socialClient });
  await assert.rejects(
    () => live.takeStage(null, { videoId: 'post-text', viewerId: VIEWER }),
    (e) => e.status === 404,
  );
});
