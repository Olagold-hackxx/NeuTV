import { openStore } from '../../platform/store.mjs';

const MIGRATIONS = {
  '001_moderation': `
    CREATE TABLE decisions (
      id          TEXT PRIMARY KEY,
      surface     TEXT NOT NULL,          -- 'post' | 'comment' | 'live_comment' | 'chat'
      user_id     TEXT,
      verdict     TEXT NOT NULL,          -- 'allow' | 'flag' | 'block'
      score       INTEGER NOT NULL,
      escalated   INTEGER NOT NULL DEFAULT 0,
      rule_ids    TEXT NOT NULL,          -- JSON array
      excerpt     TEXT NOT NULL,          -- first 280 chars, for the audit trail
      ruleset     TEXT NOT NULL,
      decided_at  INTEGER NOT NULL
    );
    CREATE INDEX idx_decisions_time ON decisions(decided_at);
    CREATE INDEX idx_decisions_verdict ON decisions(verdict);
  `,
};

export const openModerationStore = (file) => openStore(file, MIGRATIONS);
