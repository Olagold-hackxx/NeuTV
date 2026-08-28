import { openStore } from '../../platform/db/index.mjs';

const MIGRATIONS = {
  '001_admin': `
    CREATE TABLE videos (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      product_id    TEXT NOT NULL,
      kind          TEXT NOT NULL,            -- 'upload' | 'external'
      status        TEXT NOT NULL,            -- 'draft' | 'ready' | 'published' | 'archived'
      source_url    TEXT,                     -- external MP4 / HLS URL
      youtube_id    TEXT,                     -- nocookie embed fallback
      file_path     TEXT,                     -- relative to the uploads root
      file_size     INTEGER,
      content_type  TEXT,
      duration_secs INTEGER NOT NULL DEFAULT 0,
      poster_url    TEXT,
      created_by    TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
    CREATE INDEX idx_videos_status ON videos(status, created_at DESC);
    CREATE INDEX idx_videos_product ON videos(product_id);

    -- Exactly one row, id = 1. The main broadcast: the video that owns the main
    -- page and the one every stage takeover returns to.
    CREATE TABLE programme (
      id       INTEGER PRIMARY KEY CHECK (id = 1),
      video_id TEXT NOT NULL REFERENCES videos(id),
      set_by   TEXT NOT NULL,
      set_at   INTEGER NOT NULL,
      note     TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE programme_history (
      id         TEXT PRIMARY KEY,
      video_id   TEXT NOT NULL,
      set_by     TEXT NOT NULL,
      set_at     INTEGER NOT NULL,
      note       TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX idx_prog_history_time ON programme_history(set_at DESC);
  `,
};

export const openAdminStore = (target, options) => openStore(target, MIGRATIONS, options);
