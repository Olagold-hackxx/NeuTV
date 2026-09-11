import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { quarterOf, quarterWindow } from '../../../platform/quarters.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createAdminService } from '../service.mjs';
import { openAdminStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { DECODER_PRICE, DECODER_FLOOR, PRIZE_SHARE_PCT } from '../network.mjs';

// Decoder channels and the viewers choice. The invariants: one number per
// creator and one creator per number; Vision is always channel 1; one vote
// per viewer per quarter; a quarter settles once and pays once.

const charges = [];
const prizes = [];
let revenueTotal = 0;
const accounts = new Map();

const build = async (over = {}) => {
  charges.length = 0;
  prizes.length = 0;
  revenueTotal = 0;
  accounts.clear();
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const root = mkdtempSync(join(tmpdir(), 'neutv-network-'));
  const admin = createAdminService({
    runtime, catalog, uploadsRoot: root,
    store: await testStore(openAdminStore),
    ports: {
      wallet: {
        subscriptionActive: async () => true,
        charge: async (userId, amount, reference, memo) => {
          const prior = charges.find((c) => c.reference === reference);
          if (prior) return { ...prior.result, replayed: true };
          const result = { charged: amount, transactionId: `txn_${charges.length + 1}` };
          charges.push({ userId, amount, reference, memo, result });
          return { ...result, replayed: false };
        },
        payPrize: async (userId, amount, reference, memo) => {
          const prior = prizes.find((p) => p.reference === reference);
          if (prior) return { credited: amount, replayed: true };
          prizes.push({ userId, amount, reference, memo });
          return { credited: amount, replayed: false };
        },
        revenueBetween: async (from, to) => ({ total: revenueTotal, from, to }),
      },
      identity: {
        profile: async (userId) => accounts.get(userId) ?? null,
        accountByHandle: async (handle) => {
          const h = String(handle).replace(/^@/, '').toLowerCase();
          return [...accounts.values()].find((a) => a.handle === h) ?? null;
        },
      },
    },
    ...over,
  });
  return { runtime, admin };
};

const account = (id, role = 'creator') => {
  accounts.set(id, { id, name: `@${id}`, handle: id, avatar: 'https://a/x.png', productId: 'worldstreet', role });
  return { userId: id, role, scopes: [], user: { id, name: `@${id}` } };
};

test('Vision is channel 1 and shows what the main stage shows', async () => {
  const { admin } = await build();
  const { event } = await admin.liveEvents.create('admin-1', { title: 'Network Special', source: 'browser' });
  await admin.liveEvents.start(event.id);

  const { channels, price } = await admin.network.channelsArea();
  assert.equal(channels[0].number, 1);
  assert.equal(channels[0].name, 'NEU Vision');
  assert.equal(channels[0].network, true);
  assert.equal(channels[0].isLive, true);
  assert.equal(channels[0].title, 'Network Special');
  assert.equal(price, DECODER_PRICE);
});

test('a creator buys one decoder number, and the charge replays on a retry', async () => {
  const { admin } = await build();
  const alex = account('alex');

  const first = await admin.network.buyChannel(alex, { number: 101, name: 'Alex Signals' });
  assert.equal(first.channel.number, 101);
  assert.equal(charges.length, 1);
  assert.deepEqual(
    { userId: charges[0].userId, amount: charges[0].amount, reference: charges[0].reference },
    { userId: 'alex', amount: DECODER_PRICE, reference: 'channel-alex' },
    'the sale is a wallet charge keyed by the buyer',
  );

  await assert.rejects(() => admin.network.buyChannel(alex, { number: 102 }), (e) => e.status === 409, 'one channel per creator');
  assert.equal(charges.length, 1, 'and the refused second buy charged nothing');

  const { channels } = await admin.network.channelsArea();
  assert.equal(channels.length, 2, 'Vision plus the one sold channel');
  assert.equal(channels[1].number, 101);
  assert.equal(channels[1].name, 'Alex Signals');
  assert.equal(channels[1].card, null, 'nothing published yet, so no card - but the listing stands');
});

test('a taken number is refused, and the next free one is offered', async () => {
  const { admin } = await build();
  await admin.network.buyChannel(account('alex'), { number: DECODER_FLOOR });
  await assert.rejects(
    () => admin.network.buyChannel(account('bola'), { number: DECODER_FLOOR }),
    (e) => e.status === 409 && e.details.nextFree === DECODER_FLOOR + 1,
  );
  const auto = await admin.network.buyChannel(account('bola'), {});
  assert.equal(auto.channel.number, DECODER_FLOOR + 1, 'no number asked for: the next free one');

  const mine = await admin.network.myChannel(account('bola'));
  assert.equal(mine.channel.number, DECODER_FLOOR + 1);
  assert.deepEqual(mine.taken, [DECODER_FLOOR, DECODER_FLOOR + 1]);
});

test('the channels area carries the creator card once they publish', async () => {
  const { admin } = await build();
  const alex = account('alex');
  await admin.network.buyChannel(alex, { number: 150 });
  const { video } = await admin.creators.createOwn(alex, { title: 'On My Channel', kind: 'external', sourceUrl: 'https://x/y.mp4' });
  await admin.creators.updateOwn(alex, video.id, { status: 'published' });

  const { channels } = await admin.network.channelsArea();
  assert.equal(channels[1].title, 'On My Channel');
  assert.equal(channels[1].card.handle, '@alex');
  assert.equal(channels[1].card.creator, true);
});

test('one vote per viewer per quarter, movable; only creators can be voted for', async () => {
  const { admin } = await build();
  account('alex'); account('bola'); account('viewer-x', 'viewer');
  const v1 = { userId: 'v1', role: 'viewer', scopes: [], user: { id: 'v1' } };
  const v2 = { userId: 'v2', role: 'viewer', scopes: [], user: { id: 'v2' } };

  await admin.network.vote(v1, '@alex');
  await admin.network.vote(v2, 'alex');
  let board = await admin.network.leaderboard(v1);
  assert.equal(board.standings[0].handle, '@alex');
  assert.equal(board.standings[0].votes, 2);
  assert.equal(board.myVote, 'alex');
  assert.equal(board.sharePct, PRIZE_SHARE_PCT);

  const moved = await admin.network.vote(v2, '@bola');
  assert.equal(moved.moved, true);
  board = await admin.network.leaderboard(null);
  assert.deepEqual(board.standings.map((s) => [s.handle, s.votes]), [['@alex', 1], ['@bola', 1]]);
  assert.equal(board.totalVotes, 2, 'moving a vote does not mint one');
  assert.equal(board.myVote, null, 'signed out, no vote to report');

  await assert.rejects(() => admin.network.vote(v1, '@viewer-x'), (e) => e.status === 404, 'a viewer is not a candidate');
  await assert.rejects(() => admin.network.vote(account('alex'), '@alex'), (e) => e.status === 400, 'no voting for yourself');
});

test('the prize is the share of the quarter revenue, paid once when the quarter is settled', async () => {
  const { runtime, admin } = await build();
  account('alex'); account('bola');
  const v1 = { userId: 'v1', role: 'viewer', scopes: [], user: { id: 'v1' } };
  const v2 = { userId: 'v2', role: 'viewer', scopes: [], user: { id: 'v2' } };
  const v3 = { userId: 'v3', role: 'viewer', scopes: [], user: { id: 'v3' } };
  await admin.network.vote(v1, '@alex');
  await admin.network.vote(v2, '@alex');
  await admin.network.vote(v3, '@bola');
  revenueTotal = 10_000;

  const quarter = quarterOf(runtime.now());
  const board = await admin.network.leaderboard(null);
  assert.equal(board.quarter, quarter);
  assert.equal(board.prize, 2_000, `${PRIZE_SHARE_PCT}% of the quarter's revenue`);

  await assert.rejects(() => admin.network.adminSettle('admin-1', { quarter }), (e) => e.status === 409, 'not while it is running');

  runtime.advance(quarterWindow(quarter).endsAt - runtime.now() + 1);
  const settled = await admin.network.adminSettle('admin-1', { quarter });
  assert.equal(settled.award.winnerId, 'alex');
  assert.equal(settled.award.prize, 2_000);
  assert.equal(prizes.length, 1);
  assert.deepEqual(
    { userId: prizes[0].userId, amount: prizes[0].amount, reference: prizes[0].reference },
    { userId: 'alex', amount: 2_000, reference: `prize-${quarter}` },
  );

  const again = await admin.network.adminSettle('admin-1', { quarter });
  assert.equal(again.replayed, true);
  assert.equal(prizes.length, 1, 'settling twice pays once');

  const awards = await admin.network.adminAwards();
  assert.equal(awards.awards[0].quarter, quarter);
  assert.equal(awards.awards[0].winner.handle, 'alex');

  // The new quarter starts clean, and remembers the last winner.
  const fresh = await admin.network.leaderboard(null);
  assert.notEqual(fresh.quarter, quarter);
  assert.equal(fresh.standings.length, 0);
  assert.equal(fresh.lastAward.quarter, quarter);
});

test('a quarter with no votes settles with no winner and pays nothing', async () => {
  const { runtime, admin } = await build();
  revenueTotal = 500;
  const quarter = quarterOf(runtime.now());
  runtime.advance(quarterWindow(quarter).endsAt - runtime.now() + 1);
  const settled = await admin.network.adminSettle('admin-1', { quarter });
  assert.equal(settled.award.winnerId, null);
  assert.equal(settled.award.prize, 0);
  assert.equal(prizes.length, 0);
});

test('press events list the network schedule in public shape, never a stream key', async () => {
  const { admin } = await build();
  await admin.liveEvents.create('admin-1', { title: 'Later', source: 'browser', scheduledFor: 2 });
  const { event } = await admin.liveEvents.create('admin-1', { title: 'Now', source: 'browser' });
  await admin.liveEvents.start(event.id);
  // A creator session is not a network event.
  await admin.creators.createLive(account('alex'), { title: 'Alex Live' });

  const { events } = await admin.pressEvents();
  assert.deepEqual(events.map((e) => e.title), ['Now', 'Later'], 'on air first, then the schedule');
  assert.equal(events[0].access, 'press');
  assert.ok(!('streamKey' in events[0]) && !('ingestUrl' in events[0]));
});
