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
  // Live events: an admin going on air. Separate from videos because the
  // lifecycle is different - an event is scheduled, goes live, and ends - and
  // because it carries ingest credentials a video never has.
  '002_live_events': `
    CREATE TABLE live_events (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      product_id    TEXT NOT NULL,
      status        TEXT NOT NULL,            -- 'scheduled' | 'live' | 'ended' | 'cancelled'
      driver        TEXT NOT NULL,            -- which ingest provider minted it
      ingest_url    TEXT,
      stream_key    TEXT,                     -- a bearer credential; admin-only
      playback_url  TEXT,                     -- HLS manifest, or null when using youtube_id
      youtube_id    TEXT,
      poster_url    TEXT,
      provider_ref  TEXT,                     -- the provider's own id, for teardown
      scheduled_for INTEGER,
      started_at    INTEGER,
      ended_at      INTEGER,
      peak_viewers  INTEGER NOT NULL DEFAULT 0,
      created_by    TEXT NOT NULL,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );
    CREATE INDEX idx_live_events_status ON live_events(status, created_at DESC);
  `,
  // Segments produced by broadcasting from the admin page.
  //
  // Only the index lives here; the bytes are on disk. A rolling window is kept
  // so a long broadcast does not grow without bound, and the init segment (the
  // WebM header, seq 0) is never evicted because a player joining late cannot
  // decode anything without it.
  '003_live_segments': `
    CREATE TABLE live_segments (
      event_id   TEXT NOT NULL,
      seq        INTEGER NOT NULL,
      path       TEXT NOT NULL,
      bytes      INTEGER NOT NULL,
      mime       TEXT NOT NULL,
      is_init    INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (event_id, seq)
    );
    CREATE INDEX idx_live_segments_event ON live_segments(event_id, seq DESC);
  `,
  // How the event is fed. 'external' plays a URL the admin supplies; 'browser'
  // is recorded in the admin tab and arrives as segments. They have different
  // readiness rules, and inferring which is which from "is playbackUrl empty"
  // was ambiguous enough to let a browser broadcast fail to go on air.
  '004_event_source': `
    ALTER TABLE live_events ADD COLUMN source TEXT NOT NULL DEFAULT 'external';
  `,
};

export const openAdminStore = (target, options) => openStore(target, MIGRATIONS, options);
