import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createWalletService } from '../service.mjs';
import { giftById } from '../gifts.mjs';

const build = (over = {}) => createWalletService({ runtime: fakeRuntime(), ...over });
const CREATOR = { type: 'creator', id: '@david_trades' };

test('a new viewer opens at exactly zero: no sign-in bonus anywhere', () => {
  assert.equal(build().balance('brand-new-user').balance, 0);
});

test('a gift you cannot afford is refused with what is missing', () => {
  const wallet = build();
  try {
    wallet.tip('u1', { giftId: 'crown', target: CREATOR });
    assert.fail('should have refused');
  } catch (err) {
    assert.equal(err.status, 402);
    assert.deepEqual(err.details, { balance: 0, required: 500, shortfall: 500, giftId: 'crown' });
  }
  assert.equal(wallet.balance('u1').balance, 0, 'a refused gift moves nothing');
});

test('the client never sets the price: cost comes from the gift catalog', () => {
  const wallet = build();
  wallet.credit('u1', { amount: 1000 });
  // A hostile client sends its own cost. It is ignored.
  wallet.tip('u1', { giftId: 'applause', target: CREATOR, cost: 0, amount: 0 });
  assert.equal(wallet.balance('u1').balance, 1000 - giftById('applause').cost);
});

test('the ledger balances to zero after every kind of movement', () => {
  const wallet = build();
  wallet.credit('u1', { amount: 5000 });
  wallet.credit('u2', { amount: 250, kind: 'reward' });
  wallet.tip('u1', { giftId: 'giftbox', target: CREATOR });
  wallet.tip('u1', { giftId: 'rocket', target: { type: 'stream', id: 'tv-live-1' } });
  wallet.tip('u2', { giftId: 'applause', target: { type: 'post', id: 'post-neu-1' } });
  assert.equal(wallet.ledgerIsBalanced(), true, 'double entry must sum to zero');
});

test('a retried tip charges once', () => {
  const wallet = build();
  wallet.credit('u1', { amount: 1000 });
  const first = wallet.tip('u1', { giftId: 'crown', target: CREATOR, reference: 'client-abc' });
  const retry = wallet.tip('u1', { giftId: 'crown', target: CREATOR, reference: 'client-abc' });
  assert.equal(first.replayed, false);
  assert.equal(retry.replayed, true);
  assert.equal(retry.transactionId, first.transactionId, 'the original transaction is replayed');
  assert.equal(wallet.balance('u1').balance, 500, 'charged exactly once');
});

test('a retried credit credits once', () => {
  const wallet = build();
  wallet.credit('u1', { amount: 300, reference: 'topup-9' });
  wallet.credit('u1', { amount: 300, reference: 'topup-9' });
  assert.equal(wallet.balance('u1').balance, 300);
});

test('a gift emits exactly one live alert, and a replay emits none', () => {
  const seen = [];
  const wallet = build({ events: { emit: (t, p) => seen.push([t, p.gift.id]) } });
  wallet.credit('u1', { amount: 1000 });
  wallet.tip('u1', { giftId: 'crown', target: CREATOR, reference: 'once' });
  wallet.tip('u1', { giftId: 'crown', target: CREATOR, reference: 'once' });
  assert.deepEqual(seen, [['gift', 'crown']], 'the banner must not double-fire on a retry');
});

test('coins land on the creator, not into thin air', () => {
  const wallet = build();
  wallet.credit('u1', { amount: 1000 });
  wallet.tip('u1', { giftId: 'crown', target: CREATOR });
  const leaders = wallet.topGifters(CREATOR);
  assert.deepEqual(leaders, [{ userId: 'u1', coins: 500, gifts: 1 }]);
});

test('the leaderboard ranks by coins, ties broken deterministically', () => {
  const wallet = build();
  for (const u of ['u1', 'u2', 'u3']) wallet.credit(u, { amount: 2000 });
  wallet.tip('u1', { giftId: 'giftbox', target: CREATOR });   // 1000
  wallet.tip('u2', { giftId: 'crown', target: CREATOR });     // 500
  wallet.tip('u3', { giftId: 'crown', target: CREATOR });     // 500
  assert.deepEqual(wallet.topGifters(CREATOR).map((l) => l.userId), ['u1', 'u2', 'u3']);
});

test('an unknown gift or target type is refused', () => {
  const wallet = build();
  wallet.credit('u1', { amount: 1000 });
  assert.throws(() => wallet.tip('u1', { giftId: 'unicorn', target: CREATOR }), (e) => e.status === 404);
  assert.throws(() => wallet.tip('u1', { giftId: 'crown', target: { type: 'bank', id: 'x' } }), (e) => e.status === 400);
});

test('credit rejects nonsense amounts', () => {
  const wallet = build();
  assert.throws(() => wallet.credit('u1', { amount: 0 }), (e) => e.status === 400);
  assert.throws(() => wallet.credit('u1', { amount: -500 }), (e) => e.status === 400);
  assert.throws(() => wallet.credit('u1', { amount: 1.5 }), (e) => e.status === 400);
  assert.equal(wallet.ledgerIsBalanced(), true);
});

test('the ledger reads back what happened, newest first', () => {
  const runtime = fakeRuntime();
  const wallet = createWalletService({ runtime });
  wallet.credit('u1', { amount: 1000 });
  runtime.tick();
  wallet.tip('u1', { giftId: 'crown', target: CREATOR });
  const { entries, balance } = wallet.ledger('u1');
  assert.equal(balance, 500);
  assert.deepEqual(entries.map((e) => e.amount), [-500, 1000]);
});
