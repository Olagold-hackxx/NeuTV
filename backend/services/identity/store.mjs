import { openStore } from '../../platform/store.mjs';

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
    ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer';  -- 'viewer' | 'creator' | 'admin'
    CREATE INDEX idx_users_role ON users(role);
  `,
};

export const openIdentityStore = (file) => openStore(file, MIGRATIONS);
