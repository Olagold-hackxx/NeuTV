import { openStore } from '../../platform/db/index.mjs';

const MIGRATIONS = {
  '001_wallet': `
    -- Double entry. Every movement writes two rows that sum to zero, so
    -- "SELECT SUM(amount) FROM entries" must always be 0. That invariant is a
    -- gate test, and it is what makes a balance bug impossible to hide.
    CREATE TABLE entries (
      id         TEXT PRIMARY KEY,
      txn_id     TEXT NOT NULL,
      account    TEXT NOT NULL,      -- 'user:<id>' | 'creator:<handle>' | 'stream:<id>' | 'system:treasury'
      amount     INTEGER NOT NULL,   -- positive credit, negative debit, whole coins
      kind       TEXT NOT NULL,      -- 'tip' | 'topup' | 'reward'
      memo       TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_entries_account ON entries(account, created_at);
    CREATE INDEX idx_entries_txn ON entries(txn_id);

    -- Idempotency: a retried request with the same reference replays the
    -- original transaction instead of charging a viewer twice.
    CREATE TABLE transactions (
      id         TEXT PRIMARY KEY,
      reference  TEXT UNIQUE,
      kind       TEXT NOT NULL,
      actor      TEXT NOT NULL,
      payload    TEXT NOT NULL,      -- JSON snapshot of the response
      created_at INTEGER NOT NULL
    );
  `,
};

export const openWalletStore = (target, options) => openStore(target, MIGRATIONS, options);
