import { openStore } from '../../platform/db/index.mjs';

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
  // Contract 2.0.0 removed the LLM escalation, so this column could only ever
  // hold 0. Dropped by migration rather than by editing 001, so a database
  // created before the change ends up in the same shape as a fresh one.
  '002_drop_escalation': `
    ALTER TABLE decisions DROP COLUMN escalated;
  `,
};

export const openModerationStore = (target, options) => openStore(target, MIGRATIONS, options);
