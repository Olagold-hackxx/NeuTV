import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createAdminService } from '../service.mjs';
import { openAdminStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';

// The creator surface. Two invariants matter more than anything else here:
// a creator live session never touches the main stage, and nothing a creator
// owns leaks into the network library or another creator's channel.

const subscribed = new Set();
const bountiesPaid = [];

const build = async (over = {}) => {
  subscribed.clear();
  bountiesPaid.length = 0;
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const root = mkdtempSync(join(tmpdir(), 'neutv-creators-'));
  const admin = createAdminService({
    runtime, catalog, uploadsRoot: root,
    store: await testStore(openAdminStore),
    ports: {
      wallet: {
        subscriptionActive: async (userId, plan) => plan === 'creator' && subscribed.has(userId),
        payBounty: async (userId, amount, reference, memo) => {
          bountiesPaid.push({ userId, amount, reference, memo });
          return { credited: amount, replayed: false };
        },
      },
      identity: {
        profile: async (userId) => ({
          id: userId, name: `@${userId}`, handle: userId, avatar: 'https://a/x.png', productId: 'worldstreet',
        }),
      },
    },
    ...over,
  });
  return { runtime, admin };
};

const creator = (id = 'cr-user-1', role = 'creator') => ({ userId: id, role, scopes: [], user: { id } });

const publishOwn = async (admin, auth, over = {}) => {
  const { video } = await admin.creators.createOwn(auth, {
    title: 'My Signal Review', kind: 'external', sourceUrl: 'https://cdn.neu.tv/mine.mp4', ...over,
  });
  await admin.creators.updateOwn(auth, video.id, { status: 'published' });
  return video;
};

test('publishing needs an active creator subscription; the role alone is not enough', async () => {
  const { admin } = await build();
  const alex = creator('alex');
  await assert.rejects(
    () => admin.creators.createOwn(alex, { title: 'Blocked', kind: 'external', sourceUrl: 'https://x/y.mp4' }),
    (e) => e.status === 403,
    'no subscription, no publishing',
  );
  subscribed.add('alex');
  const { video } = await admin.creators.createOwn(alex, { title: 'Now Allowed', kind: 'external', sourceUrl: 'https://x/y.mp4' });
  assert.equal(video.status, 'ready');
});

test('a creator video never appears in the network library or the public shelves', async () => {
  const { admin } = await build();
  const alex = creator('alex');
  subscribed.add('alex');
  const video = await publishOwn(admin, alex);

  const library = await admin.listVideos({});
  assert.equal(library.videos.length, 0, 'the back office library is network content only');
  const shelves = await admin.publishedVideos({});
  assert.equal(shelves.videos.length, 0, 'the public shelves are network content only');
  await assert.rejects(() => admin.publishedVideo(video.id), (e) => e.status === 404);

  const { video: viaCreators } = await admin.creators.publishedOwn(video.id);
  assert.equal(viaCreators.id, video.id, 'but the creator route serves it');
});

test('one creator cannot read or edit another creator channel', async () => {
  const { admin } = await build();
  subscribed.add('alex').add('bola');
  const video = await publishOwn(admin, creator('alex'));
  await assert.rejects(
    () => admin.creators.updateOwn(creator('bola'), video.id, { title: 'Hijacked' }),
    (e) => e.status === 404,
    'someone else video answers as if it does not exist',
  );
  const bolaList = await admin.creators.listOwn(creator('bola'));
  assert.equal(bolaList.videos.length, 0);
});

test('a creator going live never touches the main stage', async () => {
  const { admin } = await build();
  const alex = creator('alex');
  subscribed.add('alex');
  const { event } = await admin.creators.createLive(alex, { title: 'Alex Live Desk' });
  assert.equal(event.scope, 'creator');
  await admin.creators.startLive(alex, event.id);

  const main = await admin.liveEvents.current();
  assert.equal(main.event, null, 'the main stage sees nothing');

  // And the network can still go on air: the singleton is per-scope.
  const { event: network } = await admin.liveEvents.create('admin-1', {
    title: 'Network Special', source: 'browser',
  });
  await admin.liveEvents.start(network.id);
  assert.equal((await admin.liveEvents.current()).event.id, network.id);
});

test('a creator cannot be live twice, and cannot start someone else\'s session', async () => {
  const { admin } = await build();
  const alex = creator('alex');
  subscribed.add('alex').add('bola');
  const { event: first } = await admin.creators.createLive(alex, { title: 'First' });
  const { event: second } = await admin.creators.createLive(alex, { title: 'Second' });
  await admin.creators.startLive(alex, first.id);
  await assert.rejects(() => admin.creators.startLive(alex, second.id), (e) => e.status === 409);
  await assert.rejects(() => admin.creators.startLive(creator('bola'), first.id), (e) => e.status === 404);
});

test('the spotlight lists live channels first and published work, and nothing unpublished', async () => {
  const { admin } = await build();
  const alex = creator('alex');
  const bola = creator('bola');
  subscribed.add('alex').add('bola');

  await publishOwn(admin, alex, { title: 'Alex Published' });
  // Bola has only a draft - no card for that.
  await admin.creators.createOwn(bola, { title: 'Bola Draft', kind: 'upload' });

  const { event } = await admin.creators.createLive(alex, { title: 'Alex On Air' });
  await admin.creators.startLive(alex, event.id);

  const { spotlights } = await admin.creators.spotlights({});
  assert.equal(spotlights.length, 1, 'only creators with something to show get a card');
  assert.equal(spotlights[0].isLive, true);
  assert.equal(spotlights[0].liveEventId, event.id);
  assert.equal(spotlights[0].title, 'Alex On Air', 'the live session outranks the published video on the card');
  assert.equal(spotlights[0].handle, '@alex');
});

test('the task lifecycle pays the bounty exactly once, on approval', async () => {
  const { admin } = await build();
  const alex = creator('alex');
  subscribed.add('alex');

  const { task } = await admin.creators.adminCreateTask('admin-1', {
    title: 'Cover the keynote', bounty: 400, productId: 'worldstreet',
  });
  await admin.creators.acceptTask(alex, task.id);
  const video = await publishOwn(admin, alex, { title: 'Keynote Coverage' });
  await admin.creators.deliverTask(alex, task.id, { videoId: video.id });

  const approved = await admin.creators.adminApproveTask(task.id);
  assert.equal(approved.task.status, 'approved');
  assert.equal(bountiesPaid.length, 1);
  assert.deepEqual(
    { userId: bountiesPaid[0].userId, amount: bountiesPaid[0].amount, reference: bountiesPaid[0].reference },
    { userId: 'alex', amount: 400, reference: `task-${task.id}` },
    'the payout is keyed by the task id so a retry replays instead of paying again',
  );
  await assert.rejects(() => admin.creators.adminApproveTask(task.id), (e) => e.status === 409, 'approved is terminal');
});

test('an open brief goes to the first acceptor; delivery must be the assignee\'s own video', async () => {
  const { admin } = await build();
  subscribed.add('alex').add('bola');
  const alex = creator('alex');
  const bola = creator('bola');

  const { task } = await admin.creators.adminCreateTask('admin-1', { title: 'Explainer', bounty: 100 });
  await admin.creators.acceptTask(alex, task.id);
  await assert.rejects(() => admin.creators.acceptTask(bola, task.id), (e) => e.status === 409);

  const bolaVideo = await publishOwn(admin, bola, { title: 'Not Yours' });
  await assert.rejects(
    () => admin.creators.deliverTask(alex, task.id, { videoId: bolaVideo.id }),
    (e) => e.status === 404,
    'you can only deliver your own work',
  );
});
