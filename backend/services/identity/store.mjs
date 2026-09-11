import { openStore } from '../../platform/db/index.mjs';

const MIGRATIONS = {
  '001_identity': `
    CREATE TABLE users (
      id            TEXT PRIMARY KEY,
      handle        TEXT NOT NULL UNIQUE,     -- lowercase, no leading @
      display_name  TEXT NOT NULL,            -- "@alex_trader" as shown
      email         TEXT UNIQUE,              -- null for pure-SSO viewers
      password_hash TEXT,                     -- null for pure-SSO viewers
      avatar        TEXT NOT NULL,
      badge         TEXT NOT NULL,
      product_id    TEXT NOT NULL,
      auth_method   TEXT NOT NULL,            -- 'sso' | 'password'
      verified      INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL
    );
    CREATE TABLE sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      scopes     TEXT NOT NULL,               -- JSON array
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);
    CREATE INDEX idx_sessions_expiry ON sessions(expires_at);
  `,
  // Contract 1.1.0: the admin/CRM service needs a role claim on the session.
  // Additive and defaulted, so existing rows and sessions stay valid.
  '002_roles': `
    ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer';  -- 'viewer' | 'creator' | 'press' | 'admin'
    CREATE INDEX idx_users_role ON users(role);
  `,
  // The press desk. One application per account; verification mints the
  // e-card (card_id, issued_at, expires_at) and grants the 'press' role. The
  // application row outlives a revocation so the history is kept.
  '003_press': `
    CREATE TABLE press_applications (
      user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      outlet      TEXT NOT NULL,
      title       TEXT NOT NULL,            -- the applicant's job title
      beat        TEXT NOT NULL DEFAULT '',
      website     TEXT,
      note        TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL,            -- 'pending' | 'verified' | 'rejected' | 'revoked'
      card_id     TEXT UNIQUE,              -- 'NEU-PRESS-000001', minted on verification
      issued_at   INTEGER,
      expires_at  INTEGER,
      reviewed_by TEXT,
      reviewed_at INTEGER,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL
    );
    CREATE INDEX idx_press_status ON press_applications(status, created_at DESC);
  `,
};

export const openIdentityStore = (target, options) => openStore(target, MIGRATIONS, options);
