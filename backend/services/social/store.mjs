import { openStore } from '../../platform/db/index.mjs';

const MIGRATIONS = {
  '001_social': `
    CREATE TABLE posts (
      id            TEXT PRIMARY KEY,
      author_id     TEXT,                       -- null for seeded official posts
      author        TEXT NOT NULL,
      handle        TEXT NOT NULL,
      avatar        TEXT,
      verified      INTEGER NOT NULL DEFAULT 0,
      product_id    TEXT NOT NULL,
      product_name  TEXT NOT NULL DEFAULT '',
      category_tag  TEXT NOT NULL DEFAULT '',
      role          TEXT NOT NULL DEFAULT '',
      bio           TEXT NOT NULL DEFAULT '',
      followers     TEXT NOT NULL DEFAULT '',
      content       TEXT NOT NULL,
      video_title   TEXT,
      duration      TEXT,
      views         TEXT,
      youtube_id    TEXT,
      video_mp4     TEXT,
      media_url     TEXT,
      shares        INTEGER NOT NULL DEFAULT 0,
      seed_upvotes  INTEGER NOT NULL DEFAULT 0, -- content shipped with the seed
      flagged       INTEGER NOT NULL DEFAULT 0,
      created_at    INTEGER NOT NULL
    );
    CREATE INDEX idx_posts_time ON posts(created_at DESC);
    CREATE INDEX idx_posts_product ON posts(product_id, created_at DESC);

    CREATE TABLE comments (
      id         TEXT PRIMARY KEY,
      post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id  TEXT,
      author     TEXT NOT NULL,
      handle     TEXT NOT NULL,
      avatar     TEXT,
      text       TEXT NOT NULL,
      likes      INTEGER NOT NULL DEFAULT 0,
      flagged    INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX idx_comments_post ON comments(post_id, created_at ASC);

    -- One row per viewer per post. A toggle is an insert or a delete, so a
    -- double-tap cannot inflate a counter.
    CREATE TABLE upvotes (
      user_id    TEXT NOT NULL,
      post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );
    CREATE TABLE saves (
      user_id    TEXT NOT NULL,
      post_id    TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, post_id)
    );
    CREATE TABLE follows (
      user_id    TEXT NOT NULL,
      handle     TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, handle)
    );
  `,
};

export const openSocialStore = (target, options) => openStore(target, MIGRATIONS, options);
