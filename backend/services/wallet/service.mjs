// Wallet service: KashCoin balances, the ledger behind them, and gifting.
//
// Balances are derived from the ledger with SUM(), never cached in a column. A
// cached balance is a second source of truth that drifts the first time a write
// path is wrong, and at this volume the sum costs nothing.

import { validate } from '../../platform/validate.mjs';
import { notFound, paymentRequired, badRequest } from '../../platform/errors.mjs';
import { giftCatalog, giftById } from './gifts.mjs';

const TREASURY = 'system:treasury';
const userAccount = (userId) => `user:${userId}`;

// The creator gift split: a gift on creator content pays the creator this
// share of it, credited to their spendable balance; the remainder stays on the
// creator's tally account as the network's share. Whole coins, floor'd, so the
// books always balance in integers.
export const CREATOR_GIFT_SHARE = 0.7;

// KashCoin subscriptions - the gate, not the incentive (see
// docs/creator-network-plan.md §4). The viewer plan includes an allowance
// that is credited straight back, so subscription money circulates through
// creators rather than around them.
export const SUBSCRIPTION_PLANS = {
  viewer: { cost: 500, allowance: 250 },
  creator: { cost: 250, allowance: 0 },
};
export const SUBSCRIPTION_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

const targetAccount = (target) => {
  if (target.type === 'creator') return `creator:${String(target.id).replace(/^@/, '').toLowerCase()}`;
  if (target.type === 'stream') return `stream:${target.id}`;
  if (target.type === 'post') return `post:${target.id}`;
  throw badRequest('Tip target type must be creator, stream or post.');
};

export function createWalletService({
  runtime,
  store,
  events = { emit: () => {} },   // injected at the composition root, never an import
  identity = {},                 // { userIdByHandle } - resolves a creator's spendable account
  maxTopUp = 1_000_000,
}) {
  const balanceOf = async (account) =>
    (await store.get('SELECT COALESCE(SUM(amount), 0) AS balance FROM entries WHERE account = ?', account)).balance;

  const post = async ({ kind, reference, actor, memo, legs, response }) => {
    if (reference) {
      const prior = await store.get('SELECT payload FROM transactions WHERE reference = ?', reference);
      if (prior) return { ...JSON.parse(prior.payload), replayed: true };
    }
    return store.tx(async (t) => {
      // Re-check inside the transaction: two concurrent retries of the same
      // reference must not both pass the check above.
      if (reference) {
        const prior = await t.get('SELECT payload FROM transactions WHERE reference = ?', reference);
        if (prior) return { ...JSON.parse(prior.payload), replayed: true };
      }
      const txnId = `txn_${runtime.uuid()}`;
      const now = runtime.now();
      for (const leg of legs) {
        await t.run(
          'INSERT INTO entries (id, txn_id, account, amount, kind, memo, created_at) VALUES (?,?,?,?,?,?,?)',
          `ent_${runtime.uuid()}`, txnId, leg.account, leg.amount, kind, memo, now,
        );
      }
      const payload = { ...(await response(txnId, now, t)), transactionId: txnId, at: now };
      await t.run(
        'INSERT INTO transactions (id, reference, kind, actor, payload, created_at) VALUES (?,?,?,?,?,?)',
        txnId, reference ?? null, kind, actor, JSON.stringify(payload), now,
      );
      return { ...payload, replayed: false };
    });
  };

  return {
    // PRD 4.4: a new viewer opens at exactly 0. No synthetic sign-in bonus, so
    // there is no code path here that credits an account on account creation.
    async balance(userId) {
      return { balance: await balanceOf(userAccount(userId)), currency: 'KASH', userId };
    },

    gifts: () => ({ gifts: giftCatalog() }),

    async ledger(userId, { limit = 50 } = {}) {
      const account = userAccount(userId);
      return {
        balance: await balanceOf(account),
        currency: 'KASH',
        entries: await store.all(
          `SELECT id, txn_id AS "transactionId", amount, kind, memo, created_at AS "createdAt"
           FROM entries WHERE account = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
          account, Math.min(limit, 200),
        ),
      };
    },

    async tip(userId, input) {
      const { giftId, target, reference, message } = validate(input, {
        giftId: { type: 'string', required: true, max: 40 },
        target: { type: 'object', required: true },
        reference: { type: 'string', required: false, max: 80 },
        message: { type: 'string', required: false, max: 200 },
      });

      const gift = giftById(giftId);
      if (!gift) throw notFound(`No gift "${giftId}".`);
      const { type, id } = validate(target, {
        type: { type: 'string', required: true, enum: ['creator', 'stream', 'post'] },
        id: { type: 'string', required: true, max: 80 },
      });

      const from = userAccount(userId);
      const balance = await balanceOf(from);
      if (balance < gift.cost) {
        // The frontend renders this as "Insufficient balance! You need N Coins".
        throw paymentRequired(`Insufficient balance. ${gift.name} costs ${gift.cost} Coins.`, {
          balance, required: gift.cost, shortfall: gift.cost - balance, giftId,
        });
      }

      const to = targetAccount({ type, id });
      const result = await post({
        kind: 'tip',
        reference,
        actor: userId,
        memo: `${gift.name} to ${to}`,
        legs: [
          { account: from, amount: -gift.cost },
          { account: to, amount: gift.cost },
        ],
        response: () => ({
          gift,
          target: { type, id },
          spent: gift.cost,
          balance: balance - gift.cost,
          message: message ?? null,
        }),
      });

      if (!result.replayed) {
        // The creator split. The tip itself stays two legs - the leaderboard
        // and the spend rollups key on that shape - and the payout is its own
        // transaction: the tally account passes the creator's share on to
        // their spendable balance, keyed by the tip's transaction id so a
        // replayed tip can never pay twice. A handle with no account behind it
        // (the seeded editorial spotlights) accrues on the tally account until
        // one exists.
        if (type === 'creator') {
          const share = Math.floor(gift.cost * CREATOR_GIFT_SHARE);
          const creatorUserId = share > 0 ? await identity.userIdByHandle?.(id) : null;
          if (creatorUserId) {
            await post({
              kind: 'payout',
              reference: `${result.transactionId}-payout`,
              actor: userId,
              memo: `Creator share of ${gift.name}`,
              legs: [
                { account: to, amount: -share },
                { account: userAccount(creatorUserId), amount: share },
              ],
              response: () => ({ paid: share, creatorUserId }),
            });
          }
        }

        // The live stage renders the bouncing gift banner from this event. The
        // wallet does not know the live service exists; the gateway wires it.
        events.emit('gift', {
          transactionId: result.transactionId,
          userId,
          gift: { id: gift.id, name: gift.name, emoji: gift.emoji, cost: gift.cost },
          target: { type, id },
          message: message ?? null,
          at: result.at,
        });
      }
      return result;
    },

    // --- subscriptions ----------------------------------------------------

    /**
     * Charge a plan and extend the entitlement window. Renewing before expiry
     * stacks: the new month starts where the old one ends, so renewing early
     * never costs days. The row update rides inside the charge's transaction -
     * a subscription that charged but did not extend cannot exist.
     */
    async subscribe(userId, input) {
      const { plan, reference } = validate(input, {
        plan: { type: 'string', required: true, enum: Object.keys(SUBSCRIPTION_PLANS) },
        reference: { type: 'string', required: false, max: 80 },
      });
      const price = SUBSCRIPTION_PLANS[plan];
      const account = userAccount(userId);
      const balance = await balanceOf(account);
      if (balance < price.cost) {
        throw paymentRequired(`Insufficient balance. The ${plan} plan costs ${price.cost} Coins.`, {
          balance, required: price.cost, shortfall: price.cost - balance, plan,
        });
      }

      const result = await post({
        kind: 'subscription',
        reference,
        actor: userId,
        memo: `${plan} subscription`,
        legs: [
          { account, amount: -price.cost },
          { account: TREASURY, amount: price.cost },
        ],
        response: async (txnId, now, t) => {
          const current = await t.get(
            'SELECT expires_at FROM subscriptions WHERE user_id = ? AND plan = ? ORDER BY expires_at DESC LIMIT 1',
            userId, plan,
          );
          const startsFrom = Math.max(now, current?.expires_at ?? 0);
          const expiresAt = startsFrom + SUBSCRIPTION_PERIOD_MS;
          await t.run(
            'INSERT INTO subscriptions (id, user_id, plan, started_at, expires_at, cost, txn_id, created_at) VALUES (?,?,?,?,?,?,?,?)',
            `sub_${runtime.uuid()}`, userId, plan, now, expiresAt, price.cost, txnId, now,
          );
          return { plan, expiresAt, cost: price.cost, balance: balance - price.cost };
        },
      });

      // The viewer plan's included allowance, credited straight back so it can
      // be gifted onward. Its own transaction, keyed off the charge, so a
      // replayed subscribe cannot mint the allowance twice.
      if (!result.replayed && price.allowance > 0) {
        await post({
          kind: 'reward',
          reference: `${result.transactionId}-allowance`,
          actor: userId,
          memo: `${plan} subscription allowance`,
          legs: [
            { account, amount: price.allowance },
            { account: TREASURY, amount: -price.allowance },
          ],
          response: () => ({ credited: price.allowance }),
        });
      }
      return { ...result, allowance: price.allowance, balance: result.balance + (result.replayed ? 0 : price.allowance) };
    },

    async subscriptionStatus(userId) {
      const now = runtime.now();
      const rows = await store.all(
        `SELECT plan, MAX(expires_at) AS "expiresAt" FROM subscriptions WHERE user_id = ? GROUP BY plan`,
        userId,
      );
      const plans = {};
      for (const plan of Object.keys(SUBSCRIPTION_PLANS)) {
        const row = rows.find((r) => r.plan === plan);
        plans[plan] = row
          ? { active: row.expiresAt > now, expiresAt: row.expiresAt, cost: SUBSCRIPTION_PLANS[plan].cost }
          : { active: false, expiresAt: null, cost: SUBSCRIPTION_PLANS[plan].cost };
      }
      return { plans, at: now };
    },

    /** Port for the creator surface's publish gate. */
    async subscriptionActive(userId, plan) {
      const row = await store.get(
        'SELECT MAX(expires_at) AS latest FROM subscriptions WHERE user_id = ? AND plan = ?',
        userId, plan,
      );
      return Boolean(row?.latest && row.latest > runtime.now());
    },

    /** Port for the task bounty: approval pays, idempotently by reference. */
    async payBounty(userId, amount, reference, memo) {
      if (!userId) throw badRequest('That task has no assignee to pay.');
      const account = userAccount(userId);
      const opening = await balanceOf(account);
      return post({
        kind: 'reward',
        reference,
        actor: 'system:tasks',
        memo: memo ?? 'Task bounty',
        legs: [
          { account, amount },
          { account: TREASURY, amount: -amount },
        ],
        response: () => ({ credited: amount, balance: opening + amount }),
      });
    },

    async credit(userId, input) {
      const { amount, kind, reference, memo } = validate(input, {
        amount: { type: 'int', required: true, min: 1, max: maxTopUp },
        kind: { type: 'string', required: false, default: 'topup', enum: ['topup', 'reward'] },
        reference: { type: 'string', required: false, max: 80 },
        memo: { type: 'string', required: false, default: 'KashCoin credit', max: 200 },
      });
      const account = userAccount(userId);
      const opening = await balanceOf(account);
      return post({
        kind,
        reference,
        actor: userId,
        memo,
        legs: [
          { account, amount },
          { account: TREASURY, amount: -amount },  // treasury funds it, books stay balanced
        ],
        response: () => ({ credited: amount, balance: opening + amount, kind }),
      });
    },

    // Top gifters on a target. Powers the live leaderboard.
    async topGifters(target, { limit = 10 } = {}) {
      const account = targetAccount(target);
      return (await store.all(
        `SELECT e2.account AS account, -SUM(e2.amount) AS coins, COUNT(*) AS gifts
         FROM entries e1 JOIN entries e2 ON e2.txn_id = e1.txn_id AND e2.amount < 0
         WHERE e1.account = ? AND e1.amount > 0 AND e1.kind = 'tip'
         GROUP BY e2.account ORDER BY coins DESC, account ASC LIMIT ?`,
        account, Math.min(limit, 50),
      )).map((r) => ({ userId: r.account.replace(/^user:/, ''), coins: r.coins, gifts: r.gifts }));
    },

    // --- read ports for the admin CRM (see services/admin/ports.mjs) ------

    async spendSummary() {
      const tips = await store.get(
        `SELECT COUNT(DISTINCT txn_id) AS gifts, COALESCE(SUM(amount), 0) AS coins
         FROM entries WHERE kind = 'tip' AND amount > 0`,
      );
      const treasury = await store.get("SELECT COALESCE(-SUM(amount), 0) AS issued FROM entries WHERE account = 'system:treasury'");
      return {
        coinsSpent: tips.coins,
        gifts: tips.gifts,
        coinsIssued: treasury.issued,
        // The books must balance. Surfacing it in the CRM means a drift shows
        // up on a dashboard instead of in a support ticket.
        ledgerBalanced: (await store.get('SELECT COALESCE(SUM(amount), 0) AS total FROM entries')).total === 0,
      };
    },

    async spendByUser() {
      const rows = await store.all(
        `SELECT account, -COALESCE(SUM(amount), 0) AS spent, COUNT(DISTINCT txn_id) AS gifts
         FROM entries WHERE kind = 'tip' AND amount < 0 GROUP BY account`,
      );
      return Object.fromEntries(rows.map((r) => [r.account.replace(/^user:/, ''), { spent: r.spent, gifts: r.gifts }]));
    },

    // The invariant that makes a balance bug impossible to hide.
    ledgerIsBalanced: async () =>
      (await store.get('SELECT COALESCE(SUM(amount), 0) AS total FROM entries')).total === 0,

    close: () => store.close(),
  };
}
