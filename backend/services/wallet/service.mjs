// Wallet service: KashCoin balances, the ledger behind them, and gifting.
//
// Balances are derived from the ledger with SUM(), never cached in a column. A
// cached balance is a second source of truth that drifts the first time a write
// path is wrong, and at this volume the sum costs nothing.

import { validate } from '../../platform/validate.mjs';
import { notFound, paymentRequired, badRequest } from '../../platform/errors.mjs';
import { openWalletStore } from './store.mjs';
import { giftCatalog, giftById } from './gifts.mjs';

const TREASURY = 'system:treasury';
const userAccount = (userId) => `user:${userId}`;

const targetAccount = (target) => {
  if (target.type === 'creator') return `creator:${String(target.id).replace(/^@/, '').toLowerCase()}`;
  if (target.type === 'stream') return `stream:${target.id}`;
  if (target.type === 'post') return `post:${target.id}`;
  throw badRequest('Tip target type must be creator, stream or post.');
};

export function createWalletService({
  runtime,
  store = openWalletStore(':memory:'),
  events = { emit: () => {} },   // injected at the composition root, never an import
  maxTopUp = 1_000_000,
}) {
  const balanceOf = (account) =>
    store.get('SELECT COALESCE(SUM(amount), 0) AS balance FROM entries WHERE account = ?', account).balance;

  const post = ({ kind, reference, actor, memo, legs, response }) => {
    if (reference) {
      const prior = store.get('SELECT payload FROM transactions WHERE reference = ?', reference);
      if (prior) return { ...JSON.parse(prior.payload), replayed: true };
    }
    return store.tx(() => {
      // Re-check inside the transaction: two concurrent retries of the same
      // reference must not both pass the check above.
      if (reference) {
        const prior = store.get('SELECT payload FROM transactions WHERE reference = ?', reference);
        if (prior) return { ...JSON.parse(prior.payload), replayed: true };
      }
      const txnId = `txn_${runtime.uuid()}`;
      const now = runtime.now();
      for (const leg of legs) {
        store.run(
          'INSERT INTO entries (id, txn_id, account, amount, kind, memo, created_at) VALUES (?,?,?,?,?,?,?)',
          `ent_${runtime.uuid()}`, txnId, leg.account, leg.amount, kind, memo, now,
        );
      }
      const payload = { ...response(txnId, now), transactionId: txnId, at: now };
      store.run(
        'INSERT INTO transactions (id, reference, kind, actor, payload, created_at) VALUES (?,?,?,?,?,?)',
        txnId, reference ?? null, kind, actor, JSON.stringify(payload), now,
      );
      return { ...payload, replayed: false };
    });
  };

  return {
    // PRD 4.4: a new viewer opens at exactly 0. No synthetic sign-in bonus, so
    // there is no code path here that credits an account on account creation.
    balance(userId) {
      return { balance: balanceOf(userAccount(userId)), currency: 'KASH', userId };
    },

    gifts: () => ({ gifts: giftCatalog() }),

    ledger(userId, { limit = 50 } = {}) {
      const account = userAccount(userId);
      return {
        balance: balanceOf(account),
        currency: 'KASH',
        entries: store.all(
          `SELECT id, txn_id AS transactionId, amount, kind, memo, created_at AS createdAt
           FROM entries WHERE account = ? ORDER BY created_at DESC, id DESC LIMIT ?`,
          account, Math.min(limit, 200),
        ),
      };
    },

    tip(userId, input) {
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
      const balance = balanceOf(from);
      if (balance < gift.cost) {
        // The frontend renders this as "Insufficient balance! You need N Coins".
        throw paymentRequired(`Insufficient balance. ${gift.name} costs ${gift.cost} Coins.`, {
          balance, required: gift.cost, shortfall: gift.cost - balance, giftId,
        });
      }

      const to = targetAccount({ type, id });
      const result = post({
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

    credit(userId, input) {
      const { amount, kind, reference, memo } = validate(input, {
        amount: { type: 'int', required: true, min: 1, max: maxTopUp },
        kind: { type: 'string', required: false, default: 'topup', enum: ['topup', 'reward'] },
        reference: { type: 'string', required: false, max: 80 },
        memo: { type: 'string', required: false, default: 'KashCoin credit', max: 200 },
      });
      const account = userAccount(userId);
      return post({
        kind,
        reference,
        actor: userId,
        memo,
        legs: [
          { account, amount },
          { account: TREASURY, amount: -amount },  // treasury funds it, books stay balanced
        ],
        response: () => ({ credited: amount, balance: balanceOf(account) + amount, kind }),
      });
    },

    // Top gifters on a target. Powers the live leaderboard.
    topGifters(target, { limit = 10 } = {}) {
      const account = targetAccount(target);
      return store.all(
        `SELECT e2.account AS account, -SUM(e2.amount) AS coins, COUNT(*) AS gifts
         FROM entries e1 JOIN entries e2 ON e2.txn_id = e1.txn_id AND e2.amount < 0
         WHERE e1.account = ? AND e1.amount > 0 AND e1.kind = 'tip'
         GROUP BY e2.account ORDER BY coins DESC, account ASC LIMIT ?`,
        account, Math.min(limit, 50),
      ).map((r) => ({ userId: r.account.replace(/^user:/, ''), coins: r.coins, gifts: r.gifts }));
    },

    // --- read ports for the admin CRM (see services/admin/ports.mjs) ------

    spendSummary() {
      const tips = store.get(
        `SELECT COUNT(DISTINCT txn_id) AS gifts, COALESCE(SUM(amount), 0) AS coins
         FROM entries WHERE kind = 'tip' AND amount > 0`,
      );
      const treasury = store.get("SELECT COALESCE(-SUM(amount), 0) AS issued FROM entries WHERE account = 'system:treasury'");
      return {
        coinsSpent: tips.coins,
        gifts: tips.gifts,
        coinsIssued: treasury.issued,
        // The books must balance. Surfacing it in the CRM means a drift shows
        // up on a dashboard instead of in a support ticket.
        ledgerBalanced: store.get('SELECT COALESCE(SUM(amount), 0) AS total FROM entries').total === 0,
      };
    },

    spendByUser() {
      const rows = store.all(
        `SELECT account, -COALESCE(SUM(amount), 0) AS spent, COUNT(DISTINCT txn_id) AS gifts
         FROM entries WHERE kind = 'tip' AND amount < 0 GROUP BY account`,
      );
      return Object.fromEntries(rows.map((r) => [r.account.replace(/^user:/, ''), { spent: r.spent, gifts: r.gifts }]));
    },

    // The invariant that makes a balance bug impossible to hide.
    ledgerIsBalanced: () =>
      store.get('SELECT COALESCE(SUM(amount), 0) AS total FROM entries').total === 0,

    close: () => store.close(),
  };
}
