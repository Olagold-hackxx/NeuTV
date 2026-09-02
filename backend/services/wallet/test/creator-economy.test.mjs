import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createWalletService, SUBSCRIPTION_PLANS, SUBSCRIPTION_PERIOD_MS } from '../service.mjs';
import { openWalletStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';

// The creator economy on the ledger: the 70/30 gift split and KashCoin
// subscriptions. Every case here ends with the books balancing - that is the
// invariant that makes a payout bug impossible to hide.

const build = async (over = {}) => createWalletService({
  runtime: fakeRuntime(),
  store: await testStore(openWalletStore),
  identity: { userIdByHandle: async (h) => (h === 'alex' || h === '@alex' ? 'user-alex' : null) },
  ...over,
});

test('a gift on creator content pays the creator 70% into their spendable balance', async () => {
  const wallet = await build();
  await wallet.credit('viewer-1', { amount: 1000 });
  await wallet.tip('viewer-1', { giftId: 'crown', target: { type: 'creator', id: '@alex' } }); // 500

  assert.equal((await wallet.balance('viewer-1')).balance, 500, 'the viewer paid the full cost');
  assert.equal((await wallet.balance('user-alex')).balance, 350, 'the creator got 70%, spendable');
  assert.equal(await wallet.ledgerIsBalanced(), true, 'and the books still balance');

  const ledger = await wallet.ledger('user-alex');
  assert.equal(ledger.entries[0].kind, 'payout');
  assert.match(ledger.entries[0].memo, /Royal Crown/);
});

test('a replayed tip pays the creator exactly once', async () => {
  const wallet = await build();
  await wallet.credit('viewer-1', { amount: 1000 });
  const target = { type: 'creator', id: '@alex' };
  await wallet.tip('viewer-1', { giftId: 'crown', target, reference: 'gift-once' });
  await wallet.tip('viewer-1', { giftId: 'crown', target, reference: 'gift-once' });
  assert.equal((await wallet.balance('user-alex')).balance, 350, 'one payout, not two');
  assert.equal((await wallet.balance('viewer-1')).balance, 500, 'one charge, not two');
});

test('a handle with no account behind it accrues on the tally account, and the books hold', async () => {
  const wallet = await build();
  await wallet.credit('viewer-1', { amount: 500 });
  await wallet.tip('viewer-1', { giftId: 'diamond', target: { type: 'creator', id: '@david_trades' } });
  assert.equal(await wallet.ledgerIsBalanced(), true);
  // Nothing reached any user account but the viewer's own debit.
  assert.equal((await wallet.balance('viewer-1')).balance, 250);
});

test('the leaderboard still counts the full gift after the split', async () => {
  const wallet = await build();
  await wallet.credit('viewer-1', { amount: 1000 });
  await wallet.tip('viewer-1', { giftId: 'crown', target: { type: 'creator', id: '@alex' } });
  const top = await wallet.topGifters({ type: 'creator', id: '@alex' });
  assert.equal(top.length, 1);
  assert.equal(top[0].coins, 500, 'the gift, not the post-split remainder');
});

test('subscribing charges the plan price and opens a 30-day window', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 1000 });
  const res = await wallet.subscribe('u1', { plan: 'creator' });
  assert.equal(res.cost, SUBSCRIPTION_PLANS.creator.cost);
  assert.equal(await wallet.subscriptionActive('u1', 'creator'), true);
  assert.equal(await wallet.subscriptionActive('u1', 'viewer'), false);
  assert.equal((await wallet.balance('u1')).balance, 1000 - SUBSCRIPTION_PLANS.creator.cost);
  assert.equal(await wallet.ledgerIsBalanced(), true);
});

test('a subscription lapses when the clock passes its window', async () => {
  const runtime = fakeRuntime();
  const wallet = createWalletService({ runtime, store: await testStore(openWalletStore), identity: {} });
  await wallet.credit('u1', { amount: 500 });
  await wallet.subscribe('u1', { plan: 'creator' });
  assert.equal(await wallet.subscriptionActive('u1', 'creator'), true);
  runtime.advance(SUBSCRIPTION_PERIOD_MS + 1);
  assert.equal(await wallet.subscriptionActive('u1', 'creator'), false, 'the gate closes on expiry');
});

test('renewing early stacks: the new month starts where the old one ends', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 1000 });
  const first = await wallet.subscribe('u1', { plan: 'creator' });
  const second = await wallet.subscribe('u1', { plan: 'creator' });
  assert.equal(second.expiresAt, first.expiresAt + SUBSCRIPTION_PERIOD_MS, 'no days lost to renewing early');
});

test('the viewer plan credits its allowance back, once, so it can be gifted onward', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 1000 });
  const res = await wallet.subscribe('u1', { plan: 'viewer', reference: 'sub-1' });
  const expected = 1000 - SUBSCRIPTION_PLANS.viewer.cost + SUBSCRIPTION_PLANS.viewer.allowance;
  assert.equal(res.balance, expected);
  assert.equal((await wallet.balance('u1')).balance, expected);

  const retry = await wallet.subscribe('u1', { plan: 'viewer', reference: 'sub-1' });
  assert.equal(retry.replayed, true);
  assert.equal((await wallet.balance('u1')).balance, expected, 'a replay neither charges nor mints again');
  assert.equal(await wallet.ledgerIsBalanced(), true);
});

test('subscribing beyond your balance is refused with the shortfall', async () => {
  const wallet = await build();
  await wallet.credit('u1', { amount: 100 });
  await assert.rejects(
    () => wallet.subscribe('u1', { plan: 'viewer' }),
    (e) => e.status === 402 && e.details.shortfall === SUBSCRIPTION_PLANS.viewer.cost - 100,
  );
});

test('a task bounty is idempotent by reference', async () => {
  const wallet = await build();
  await wallet.payBounty('user-alex', 400, 'task-t1', 'Bounty: Cover the keynote');
  const retry = await wallet.payBounty('user-alex', 400, 'task-t1', 'Bounty: Cover the keynote');
  assert.equal(retry.replayed, true);
  assert.equal((await wallet.balance('user-alex')).balance, 400, 'paid once');
  assert.equal(await wallet.ledgerIsBalanced(), true);
});
