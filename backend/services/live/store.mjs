import { openStore } from '../../platform/db/index.mjs';

const MIGRATIONS = {
  '001_live': `
    -- Presence heartbeats. The viewer count is a COUNT over a time window, not
    -- a counter that increments and decrements: a counter drifts every time a
    -- browser tab dies without saying goodbye.
    CREATE TABLE presence (
      viewer_key TEXT PRIMARY KEY,
      user_id    TEXT,
      last_seen  INTEGER NOT NULL
    );
    CREATE INDEX idx_presence_seen ON presence(last_seen);

    CREATE TABLE comments (
      id         TEXT PRIMARY KEY,
      user_id    TEXT,
      author     TEXT NOT NULL,
      handle     TEXT,
      avatar     TEXT,
      badge      TEXT,
      text       TEXT NOT NULL,
      flagged    INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_comments_time ON comments(created_at DESC);

    CREATE TABLE reactions (
      emoji  TEXT PRIMARY KEY,
      total  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE chat_messages (
      id         TEXT PRIMARY KEY,
      server_id  TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id    TEXT,
      author     TEXT NOT NULL,
      avatar     TEXT,
      text       TEXT NOT NULL,
      flagged    INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_chat_channel ON chat_messages(server_id, channel_id, created_at DESC);

    -- One row per user per programme, so a like is idempotent and a toggle is
    -- an insert or a delete rather than a number that can run away.
    CREATE TABLE tv_likes (
      user_id    TEXT NOT NULL,
      video_id   TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, video_id)
    );

    -- key: 'broadcast' for a global promote, 'viewer:<viewerKey>' for a click.
    CREATE TABLE stage_overrides (
      key          TEXT PRIMARY KEY,
      scope        TEXT NOT NULL,
      video_id     TEXT NOT NULL,
      video_json   TEXT NOT NULL,
      started_at   INTEGER NOT NULL,
      expires_at   INTEGER NOT NULL,
      requested_by TEXT
    );
    CREATE INDEX idx_overrides_expiry ON stage_overrides(expires_at);
  `,
};

export const openLiveStore = (target, options) => openStore(target, MIGRATIONS, options);
