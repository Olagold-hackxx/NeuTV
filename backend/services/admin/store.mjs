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
  // Where the studio publishes a WebRTC peer connection. Separate from
  // ingest_url, which is the RTMP endpoint an encoder like OBS uses: an event
  // can offer both, and the studio picks WHIP because it is the one that gets
  // under a second.
  '005_whip_url': `
    ALTER TABLE live_events ADD COLUMN whip_url TEXT;
  `,
  // How the video is actually reaching viewers, as opposed to who is sending
  // it. 'source' answers who - browser or encoder - and the viewer used to
  // infer the transport from it: source 'browser' meant HTTP segments, because
  // when that was written it always did. WHIP made a browser broadcast arrive
  // as WebRTC and play back as HLS, so the inference started sending viewers to
  // the segment player for a broadcast that had no segments, and every one of
  // them got "No segment 0 for that broadcast". The studio knows which path it
  // took; this is where it says so.
  '006_event_transport': `
    ALTER TABLE live_events ADD COLUMN transport TEXT;
  `,
  // Who a video belongs to. Null is the network's own library - everything
  // that existed before creators did - so no backfill is needed and every
  // existing query that now filters on "owner_id IS NULL" keeps returning
  // exactly what it returned before this column existed.
  '007_video_owner': `
    ALTER TABLE videos ADD COLUMN owner_id TEXT;
    CREATE INDEX idx_videos_owner ON videos(owner_id, created_at DESC);
  `,
  // Creator live channels. scope 'network' is the main stage - the singleton
  // the stage machine resolves; scope 'creator' is a spotlight channel that
  // must never take the main view. Owner is the creator's user id.
  '008_event_scope': `
    ALTER TABLE live_events ADD COLUMN scope TEXT NOT NULL DEFAULT 'network';
    ALTER TABLE live_events ADD COLUMN owner_id TEXT;
    CREATE INDEX idx_live_events_scope ON live_events(scope, status);
  `,
  // Commissioned work. The network posts a brief with a KashCoin bounty;
  // a creator accepts it, delivers a video, and approval pays out.
  '009_tasks': `
    CREATE TABLE tasks (
      id                TEXT PRIMARY KEY,
      title             TEXT NOT NULL,
      brief             TEXT NOT NULL DEFAULT '',
      product_id        TEXT NOT NULL,
      bounty            INTEGER NOT NULL,
      deadline          INTEGER,
      status            TEXT NOT NULL,   -- 'open' | 'accepted' | 'delivered' | 'approved' | 'rejected'
      assignee_id       TEXT,
      delivery_video_id TEXT,
      created_by        TEXT NOT NULL,
      created_at        INTEGER NOT NULL,
      updated_at        INTEGER NOT NULL
    );
    CREATE INDEX idx_tasks_status ON tasks(status, created_at DESC);
    CREATE INDEX idx_tasks_assignee ON tasks(assignee_id, status);
  `,
};

export const openAdminStore = (target, options) => openStore(target, MIGRATIONS, options);
