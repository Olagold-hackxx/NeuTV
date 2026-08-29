import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createWalletService } from '../service.mjs';
import { openWalletStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { giftById } from '../gifts.mjs';

const build = async (over = {}) => createWalletService({ runtime: fakeRuntime(), store: await testStore(openWalletStore), ...over });
const CREATOR = { type: 'creator', id: '@david_trades' };

test('a new viewer opens at exactly zero: no sign-in bonus anywhere', async () => {
  assert.equal((await (await build()).balance('brand-new-user')).balance, 0);
});

test('a gift you cannot afford is refused with what is missing', async () => {
  const wallet = await build();
  try {
    await wallet.tip('u1', { giftId: 'crown', target: CREATOR });
    assert.fail('should have refused');
  } catch (err) {
    assert.equal(err.status, 402);
    assert.deepEqual(err.details, { balance: 0, required: 500, shortfall: 500, giftId: 'crown' });
  }
  assert.equal((await wallet.balance('u1')).balance, 0, 'a refused gift moves nothing');
});

test('the client never sets the price: cost comes from the gift catalog', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 1000 });
  // A hostile client sends its own cost. It is ignored.
  await wallet.tip('u1', { giftId: 'applause', target: CREATOR, cost: 0, amount: 0 });
  assert.equal((await wallet.balance('u1')).balance, 1000 - giftById('applause').cost);
});

test('the ledger balances to zero after every kind of movement', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 5000 });
  await wallet.credit('u2', { amount: 250, kind: 'reward' });
  await wallet.tip('u1', { giftId: 'giftbox', target: CREATOR });
  await wallet.tip('u1', { giftId: 'rocket', target: { type: 'stream', id: 'tv-live-1' } });
  await wallet.tip('u2', { giftId: 'applause', target: { type: 'post', id: 'post-neu-1' } });
  assert.equal(await wallet.ledgerIsBalanced(), true, 'double entry must sum to zero');
});

test('a retried tip charges once', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 1000 });
  const first = await wallet.tip('u1', { giftId: 'crown', target: CREATOR, reference: 'client-abc' });
  const retry = await wallet.tip('u1', { giftId: 'crown', target: CREATOR, reference: 'client-abc' });
  assert.equal(first.replayed, false);
  assert.equal(retry.replayed, true);
  assert.equal(retry.transactionId, first.transactionId, 'the original transaction is replayed');
  assert.equal((await wallet.balance('u1')).balance, 500, 'charged exactly once');
});

test('a retried credit credits once', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 300, reference: 'topup-9' });
  await wallet.credit('u1', { amount: 300, reference: 'topup-9' });
  assert.equal((await wallet.balance('u1')).balance, 300);
});

test('a gift emits exactly one live alert, and a replay emits none', async () => {
  const seen = [];
  const wallet = await build({ events: { emit: (t, p) => seen.push([t, p.gift.id]) } });
  await wallet.credit('u1', { amount: 1000 });
  await wallet.tip('u1', { giftId: 'crown', target: CREATOR, reference: 'once' });
  await wallet.tip('u1', { giftId: 'crown', target: CREATOR, reference: 'once' });
  assert.deepEqual(seen, [['gift', 'crown']], 'the banner must not double-fire on a retry');
});

test('coins land on the creator, not into thin air', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 1000 });
  await wallet.tip('u1', { giftId: 'crown', target: CREATOR });
  const leaders = await wallet.topGifters(CREATOR);
  assert.deepEqual(leaders, [{ userId: 'u1', coins: 500, gifts: 1 }]);
});

test('the leaderboard ranks by coins, ties broken deterministically', async () => {
  const wallet = await build();
  for (const u of ['u1', 'u2', 'u3']) await wallet.credit(u, { amount: 2000 });
  await wallet.tip('u1', { giftId: 'giftbox', target: CREATOR });   // 1000
  await wallet.tip('u2', { giftId: 'crown', target: CREATOR });     // 500
  await wallet.tip('u3', { giftId: 'crown', target: CREATOR });     // 500
  assert.deepEqual((await wallet.topGifters(CREATOR)).map((l) => l.userId), ['u1', 'u2', 'u3']);
});

test('an unknown gift or target type is refused', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 1000 });
  await assert.rejects(() => wallet.tip('u1', { giftId: 'unicorn', target: CREATOR }), (e) => e.status === 404);
  await assert.rejects(() => wallet.tip('u1', { giftId: 'crown', target: { type: 'bank', id: 'x' } }), (e) => e.status === 400);
});

test('credit rejects nonsense amounts', async () => {
  const wallet = await build();
  await assert.rejects(() => wallet.credit('u1', { amount: 0 }), (e) => e.status === 400);
  await assert.rejects(() => wallet.credit('u1', { amount: -500 }), (e) => e.status === 400);
  await assert.rejects(() => wallet.credit('u1', { amount: 1.5 }), (e) => e.status === 400);
  assert.equal(await wallet.ledgerIsBalanced(), true);
});

test('the ledger reads back what happened, newest first', async () => {
  const runtime = fakeRuntime();
  const wallet = createWalletService({ runtime, store: await testStore(openWalletStore) });
  await wallet.credit('u1', { amount: 1000 });
  runtime.tick();
  await wallet.tip('u1', { giftId: 'crown', target: CREATOR });
  const { entries, balance } = await wallet.ledger('u1');
  assert.equal(balance, 500);
  assert.deepEqual(entries.map((e) => e.amount), [-500, 1000]);
});
