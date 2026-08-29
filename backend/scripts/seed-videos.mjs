#!/usr/bin/env node
// Load the catalog's videos into the admin library.
//
//   npm run seed:videos                    # into DATABASE_URL, or SQLite
//   npm run seed:videos -- --dry-run       # print the plan, write nothing
//   npm run seed:videos -- --url postgres://localhost:5432/neutv
//   npm run seed:videos -- --force         # rewrite rows this script owns
//
// The catalog carries the network's content in four shapes - editorial media
// rows, the VOD library, creator spotlights and the central broadcast - and the
// back office was blind to all of it: an operator opened the library and read
// zero. This is the one-time bridge that gives every one of those videos a row
// in the admin store, so the CRM counts real inventory and an operator can
// publish, archive and programme what already exists.
//
// Ids are derived from the catalog id (vid_seed_v1, vid_seed_vod-1), so running
// this twice is a no-op rather than a second copy of the library. Rows created
// by an operator are never touched: this script only ever writes ids it owns.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { openServiceStore } from '../platform/db/index.mjs';
import { openAdminStore } from '../services/admin/store.mjs';
import { loadSeed } from '../services/catalog/service.mjs';
import { parseDuration } from '../services/admin/service.mjs';

const BACKEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Everything this script writes carries this prefix, so a re-run can tell its
// own rows from an operator's and leave theirs alone.
const SEED_PREFIX = 'vid_seed_';
const SEED_ACTOR = 'system:catalog-seed';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next && !next.startsWith('--')) { args[a.slice(2)] = next; i++; } else { args[a.slice(2)] = true; }
}

if (args.help) {
  console.log(`
  Give every catalog video a row in the admin library.

    npm run seed:videos
    npm run seed:videos -- --dry-run
    npm run seed:videos -- --url postgres://localhost:5432/neutv
    npm run seed:videos -- --force      rewrite rows this script owns

  Videos that carry a playable source are published; the ones that are only a
  thumbnail and a title land as drafts awaiting an upload.
`);
  process.exit(0);
}

const dryRun = Boolean(args['dry-run']);
const force = Boolean(args.force);

/** A bare YouTube id, as opposed to a full URL. */
const isYouTubeId = (value) => typeof value === 'string' && /^[A-Za-z0-9_-]{6,20}$/.test(value);

const httpUrl = (value) => (typeof value === 'string' && /^https?:\/\//.test(value) ? value : null);

/**
 * Pull a YouTube id out of whatever shape the catalog used for it: an explicit
 * youtubeId, a bare id in videoUrl (that is how spotlights carry it), or an
 * embed URL.
 */
function youTubeIdOf(item) {
  if (isYouTubeId(item.youtubeId)) return item.youtubeId;
  if (isYouTubeId(item.videoUrl)) return item.videoUrl;
  const url = httpUrl(item.videoUrl);
  const match = url && url.match(/(?:embed\/|[?&]v=)([A-Za-z0-9_-]{6,20})/);
  return match ? match[1] : null;
}

/**
 * One catalog item -> one library row.
 *
 * A video that has something to play is external and published, because it is
 * already on the site and the back office should reflect that. One that is only
 * a card - the editorial rows are thumbnails and titles, with no media behind
 * them - becomes an upload-kind draft, which is exactly what it is: a title
 * waiting for a file.
 */
function toVideo(item, { origin, productId, description = '' }) {
  const sourceUrl = httpUrl(item.videoMp4) || httpUrl(item.videoUrl);
  const youtubeId = youTubeIdOf(item);
  const playable = Boolean(sourceUrl || youtubeId);

  return {
    id: `${SEED_PREFIX}${item.id}`,
    title: item.title || item.name || item.id,
    description: description || item.description || '',
    product_id: productId,
    kind: playable ? 'external' : 'upload',
    status: playable ? 'published' : 'draft',
    source_url: sourceUrl,
    youtube_id: youtubeId,
    duration_secs: parseDuration(item.duration),
    poster_url: item.posterUrl || item.thumbnail || item.banner || null,
    origin,
  };
}

/** Every video the catalog knows about, in the order an operator would expect. */
export function collectVideos(content, productIds) {
  const found = [];

  const central = content.INITIAL_CENTRAL_TV;
  if (central && central.id) {
    found.push(toVideo(central, { origin: 'central broadcast', productId: central.productId }));
  }

  for (const row of content.INITIAL_MEDIA_ROWS || []) {
    for (const item of row.items || []) {
      found.push(toVideo(item, {
        origin: `media row ${row.id}`,
        productId: item.productId,
        description: item.influencer ? `${item.title} — ${item.influencer}.` : '',
      }));
    }
  }

  for (const item of content.VOD_LIBRARY || []) {
    found.push(toVideo(item, { origin: 'vod library', productId: item.platformId || item.productId }));
  }

  for (const item of content.CREATOR_SPOTLIGHTS || []) {
    found.push(toVideo(item, {
      origin: 'creator spotlight',
      productId: item.productId,
      description: item.name ? `${item.title} — ${item.name} (${item.handle}).` : '',
    }));
  }

  // A row whose product is not an ecosystem product would be rejected by the
  // API on the first edit, so it is corrected here rather than stored broken.
  const fallback = productIds[0];
  for (const video of found) {
    if (!productIds.includes(video.product_id)) video.product_id = fallback;
  }

  // Two shapes can describe the same video; the first one wins.
  const seen = new Set();
  return found.filter((v) => (seen.has(v.id) ? false : seen.add(v.id)));
}

const seed = loadSeed();
const content = seed.content;
const productIds = (content.PRODUCTS || []).map((p) => p.id);
if (!productIds.length) {
  console.error('\n  The catalog seed has no PRODUCTS; nothing can be attributed.\n');
  process.exit(1);
}

const videos = collectVideos(content, productIds);
const published = videos.filter((v) => v.status === 'published');

const databaseUrl = args.url || process.env.DATABASE_URL;
const store = await openServiceStore(openAdminStore, 'admin', { databaseUrl, dataDir: join(BACKEND_ROOT, 'services') });

console.log(`\n  Catalog ${seed.checksum} -> ${databaseUrl ? databaseUrl.replace(/\/\/[^@]*@/, '//***@') : 'SQLite'}`);
console.log(`  ${videos.length} videos: ${published.length} playable, ${videos.length - published.length} awaiting a file\n`);

const now = Date.now();
let inserted = 0;
let updated = 0;
let skipped = 0;

for (const video of videos) {
  const existing = await store.get('SELECT id FROM videos WHERE id = ?', video.id);

  if (existing && !force) {
    skipped++;
    continue;
  }

  const label = `${video.status.padEnd(9)} ${video.title.slice(0, 58)}`;
  if (dryRun) {
    console.log(`  ${existing ? 'would rewrite' : 'would insert '} ${label}`);
    existing ? updated++ : inserted++;
    continue;
  }

  if (existing) {
    await store.run(
      `UPDATE videos SET title=?, description=?, product_id=?, kind=?, status=?, source_url=?,
                         youtube_id=?, duration_secs=?, poster_url=?, updated_at=? WHERE id=?`,
      video.title, video.description, video.product_id, video.kind, video.status,
      video.source_url, video.youtube_id, video.duration_secs, video.poster_url, now, video.id,
    );
    updated++;
    console.log(`  rewrote  ${label}`);
  } else {
    await store.run(
      `INSERT INTO videos (id, title, description, product_id, kind, status, source_url, youtube_id,
                           duration_secs, poster_url, created_by, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      video.id, video.title, video.description, video.product_id, video.kind, video.status,
      video.source_url, video.youtube_id, video.duration_secs, video.poster_url,
      SEED_ACTOR, now, now,
    );
    inserted++;
    console.log(`  inserted ${label}`);
  }
}

// The main broadcast: without one the stage falls back to the seeded Central TV
// object and the back office reads "unset". The central broadcast is the video
// that has always owned the main page, so it is the honest default.
const centralId = content.INITIAL_CENTRAL_TV?.id ? `${SEED_PREFIX}${content.INITIAL_CENTRAL_TV.id}` : null;
const centralRow = centralId ? videos.find((v) => v.id === centralId && v.status === 'published') : null;
let programmed = null;

if (centralRow) {
  const current = await store.get('SELECT video_id FROM programme WHERE id = 1');
  if (current) {
    programmed = `already set to ${current.video_id}`;
  } else if (dryRun) {
    programmed = `would put "${centralRow.title}" on air`;
  } else {
    await store.tx(async (t) => {
      await t.run(
        'INSERT INTO programme (id, video_id, set_by, set_at, note) VALUES (1,?,?,?,?)',
        centralRow.id, SEED_ACTOR, now, 'Seeded from the catalog central broadcast.',
      );
      await t.run(
        'INSERT INTO programme_history (id, video_id, set_by, set_at, note) VALUES (?,?,?,?,?)',
        `ph_seed_${now}`, centralRow.id, SEED_ACTOR, now, 'Seeded from the catalog central broadcast.',
      );
    });
    programmed = `on air: ${centralRow.title}`;
  }
}

const total = await store.get('SELECT COUNT(*) AS total FROM videos');
await store.close();

console.log(`\n  ${dryRun ? 'Would insert' : 'Inserted'} ${inserted}, ${dryRun ? 'rewrite' : 'rewrote'} ${updated}, left ${skipped} untouched.`);
if (programmed) console.log(`  Programme: ${programmed}`);
if (!dryRun) console.log(`  Library now holds ${total.total} videos.`);
if (skipped && !force) console.log('  Re-run with --force to rewrite the rows this script owns.');
console.log('');
