// Admin / CRM service: the back office behind the network.
//
// Owns the video library and the programme - the main broadcast that occupies
// the main page and that every stage takeover returns to. The live service
// reads the programme from here through the contract; it does not keep its own
// copy, so there is exactly one answer to "what is the main broadcast".
//
// CRM rollups aggregate across services. Admin cannot open another service's
// database, so the reads it needs arrive as injected ports (see ports.mjs),
// wired at the composition root the same way the wallet's event sink is.

import { validate } from '../../platform/validate.mjs';
import { notFound, badRequest, conflict } from '../../platform/errors.mjs';
import { createStorage } from './storage/local.mjs';
import { createIngestProvider } from './ingest/index.mjs';
import { createLiveEvents } from './live-events.mjs';
import { createLiveSegments } from './live-segments.mjs';

const STATUSES = ['draft', 'ready', 'published', 'archived'];

// "04:12" or "1:02:33" -> seconds. Catalog content carries duration as display
// strings; the stage needs a number to know when a takeover ends.
export function parseDuration(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const parts = String(value ?? '').trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((total, n) => total * 60 + n, 0);
}

const publicVideo = (row, mediaBase) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  productId: row.product_id,
  kind: row.kind,
  status: row.status,
  durationSeconds: row.duration_secs,
  posterUrl: row.poster_url,
  youtubeId: row.youtube_id,
  // An uploaded file is addressed by the media route, never by its disk path.
  playbackUrl: row.file_path ? `${mediaBase}/${row.file_path}` : row.source_url,
  fileSize: row.file_size,
  contentType: row.content_type,
  hasFile: Boolean(row.file_path),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createAdminService({
  runtime,
  store,
  storage = null,
  uploadsRoot = null,
  mediaBase = '/media',
  catalog,                    // for product id validation, through the contract
  ports = {},                 // { viewers, spend, moderation, engagement }
  events = { emit: () => {} },
  ingest = null,
  segmentsRoot = null,
}) {
  const files = storage || createStorage({ root: uploadsRoot || './services/admin/data/uploads' });
  const liveEvents = createLiveEvents({
    runtime, store, catalog, events,
    ingest: ingest || createIngestProvider(),
  });
  const liveSegments = createLiveSegments({
    runtime, store,
    root: segmentsRoot || `${uploadsRoot || './services/admin/data'}/../live-segments`,
  });

  const getRow = async (videoId) => {
    const row = await store.get('SELECT * FROM videos WHERE id = ?', videoId);
    if (!row) throw notFound(`No video "${videoId}".`);
    return row;
  };

  const knownProduct = (productId) =>
    catalog.products().products.some((p) => p.id === productId);

  return {
    async listVideos({ status = null, productId = null, limit = 50 } = {}) {
      const rows = status
        ? await store.all('SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC LIMIT ?', status, Math.min(limit, 200))
        : await store.all('SELECT * FROM videos ORDER BY created_at DESC LIMIT ?', Math.min(limit, 200));
      const filtered = productId ? rows.filter((r) => r.product_id === productId) : rows;
      return { videos: filtered.map((r) => publicVideo(r, mediaBase)), total: filtered.length };
    },

    async getVideo(videoId) { return { video: publicVideo(await getRow(videoId), mediaBase) }; },

    // Public read. Only published videos, so a draft cannot be played by
    // guessing its id, and archived content stops being reachable.
    async publishedVideo(videoId) {
      const row = await getRow(videoId);
      if (row.status !== 'published') throw notFound(`No published video "${videoId}".`);
      return { video: publicVideo(row, mediaBase) };
    },

    // Public read of the whole published library. This is what the viewer app
    // renders its on-demand shelves from: the back office decides what the
    // network carries, and the site shows exactly that. Drafts and archived
    // videos are invisible here, so an unfinished upload cannot leak onto the
    // page by being listed.
    async publishedVideos({ productId = null, limit = 60 } = {}) {
      const rows = await store.all(
        'SELECT * FROM videos WHERE status = ? ORDER BY created_at DESC LIMIT ?',
        'published', Math.min(Math.max(Number(limit) || 60, 1), 200),
      );
      const filtered = productId ? rows.filter((r) => r.product_id === productId) : rows;
      return { videos: filtered.map((r) => publicVideo(r, mediaBase)), total: filtered.length };
    },

    async createVideo(actorId, input) {
      const v = validate(input, {
        title: { type: 'string', required: true, min: 2, max: 160 },
        description: { type: 'string', required: false, default: '', max: 2_000 },
        productId: { type: 'string', required: false, default: 'worldstreet', max: 40 },
        kind: { type: 'string', required: false, default: 'upload', enum: ['upload', 'external'] },
        sourceUrl: { type: 'string', required: false, max: 600 },
        youtubeId: { type: 'string', required: false, max: 40 },
        posterUrl: { type: 'string', required: false, max: 600 },
        duration: { type: 'string', required: false, max: 20 },
        durationSeconds: { type: 'int', required: false, min: 0, max: 86_400 },
      });
      if (!knownProduct(v.productId)) throw badRequest(`"${v.productId}" is not an ecosystem product.`);
      if (v.kind === 'external' && !v.sourceUrl && !v.youtubeId) {
        throw badRequest('An external video needs a sourceUrl or a youtubeId.');
      }

      const id = `vid_${runtime.uuid()}`;
      const now = runtime.now();
      const seconds = v.durationSeconds ?? parseDuration(v.duration);
      await store.run(
        `INSERT INTO videos (id, title, description, product_id, kind, status, source_url, youtube_id,
                             duration_secs, poster_url, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, v.title, v.description, v.productId, v.kind,
        // An upload has no bytes yet, so it starts as a draft. An external
        // video is playable the moment it is registered.
        v.kind === 'external' ? 'ready' : 'draft',
        v.sourceUrl ?? null, v.youtubeId ?? null, seconds, v.posterUrl ?? null,
        actorId, now, now,
      );
      const video = publicVideo(await getRow(id), mediaBase);
      return {
        video,
        upload: v.kind === 'upload'
          ? { method: 'PUT', url: `/api/v1/admin/videos/${id}/file`, note: 'Send the raw file bytes with a video Content-Type.' }
          : null,
      };
    },

    async uploadFile(videoId, { stream, contentType, contentLength }) {
      const row = await getRow(videoId);
      if (row.kind !== 'upload') throw conflict('That video is external; it has no file to upload.');
      const saved = await files.save(videoId, contentType, stream, { declaredLength: contentLength });
      await store.run(
        `UPDATE videos SET file_path = ?, file_size = ?, content_type = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        saved.path, saved.size, saved.contentType, row.status === 'draft' ? 'ready' : row.status, runtime.now(), videoId,
      );
      return { video: publicVideo(await getRow(videoId), mediaBase), uploaded: { size: saved.size, path: saved.path } };
    },

    async updateVideo(videoId, input) {
      const row = await getRow(videoId);
      const v = validate(input, {
        title: { type: 'string', required: false, min: 2, max: 160 },
        description: { type: 'string', required: false, max: 2_000 },
        productId: { type: 'string', required: false, max: 40 },
        kind: { type: 'string', required: false, enum: ['upload', 'external'] },
        status: { type: 'string', required: false, enum: STATUSES },
        sourceUrl: { type: 'string', required: false, max: 600 },
        youtubeId: { type: 'string', required: false, max: 40 },
        posterUrl: { type: 'string', required: false, max: 600 },
        duration: { type: 'string', required: false, max: 20 },
        durationSeconds: { type: 'int', required: false, min: 0, max: 86_400 },
      });
      if (v.productId && !knownProduct(v.productId)) throw badRequest(`"${v.productId}" is not an ecosystem product.`);

      // A video plays from exactly one place: an uploaded file, an external URL,
      // or a YouTube id. Editing the source therefore replaces it rather than
      // adding to it - leaving the old one behind is how a video ends up
      // playing the URL an operator thought they had just swapped out. The
      // player prefers a youtubeId over a source URL, so a stale one wins
      // silently, which is the worst version of that bug.
      const wantsSourceChange = ['kind', 'sourceUrl', 'youtubeId'].some((k) => k in input);
      const kind = v.kind ?? row.kind;
      const source = {
        file_path: row.file_path,
        file_size: row.file_size,
        content_type: row.content_type,
        source_url: row.source_url,
        youtube_id: row.youtube_id,
      };
      // The file's own columns travel with file_path, so a video that no longer
      // plays from disk cannot still report a size for it.
      const dropFile = () => Object.assign(source, { file_path: null, file_size: null, content_type: null });

      if (wantsSourceChange) {
        if (kind === 'upload') {
          // Back to a file. The bytes already uploaded, if any, stay the source;
          // the external addresses stop being how this video is reached.
          source.source_url = null;
          source.youtube_id = null;
        } else if (v.youtubeId) {
          source.youtube_id = v.youtubeId;
          source.source_url = null;
          dropFile();
        } else if (v.sourceUrl) {
          source.source_url = v.sourceUrl;
          source.youtube_id = null;
          dropFile();
        } else if (v.kind === 'external') {
          throw badRequest('An external video needs a sourceUrl or a youtubeId.');
        }
      }

      const playable = Boolean(source.file_path || source.source_url || source.youtube_id);

      // Whatever is on air has to keep playing. Switching the main broadcast to
      // a file that has not been uploaded yet would leave the main page with a
      // dead player, so it is refused the same way archiving it is.
      if (!playable) {
        const current = await store.get('SELECT video_id FROM programme WHERE id = 1');
        if (current && current.video_id === videoId) {
          throw conflict('That video is the main broadcast. Set another programme before leaving it with nothing to play.');
        }
      }

      // Publishing something with nothing to play is the mistake this catches.
      const status = v.status ?? row.status;
      if (status === 'published' && !playable) {
        if (v.status === 'published') throw conflict('Cannot publish a video with no file and no source URL.');
        // Not asked for: the edit itself removed what was playing. Demote rather
        // than leave a published video that 404s for every viewer.
      }

      const next = {
        title: v.title ?? row.title,
        description: v.description ?? row.description,
        product_id: v.productId ?? row.product_id,
        kind,
        status: playable ? status : 'draft',
        duration_secs: v.durationSeconds ?? (v.duration ? parseDuration(v.duration) : row.duration_secs),
        poster_url: v.posterUrl ?? row.poster_url,
        ...source,
      };
      await store.run(
        `UPDATE videos SET title=?, description=?, product_id=?, kind=?, status=?, source_url=?, youtube_id=?,
                           file_path=?, file_size=?, content_type=?, poster_url=?, duration_secs=?,
                           updated_at=? WHERE id=?`,
        next.title, next.description, next.product_id, next.kind, next.status, next.source_url,
        next.youtube_id, next.file_path, next.file_size, next.content_type,
        next.poster_url, next.duration_secs, runtime.now(), videoId,
      );
      return { video: publicVideo(await getRow(videoId), mediaBase) };
    },

    async archiveVideo(videoId) {
      const row = await getRow(videoId);
      const current = await store.get('SELECT video_id FROM programme WHERE id = 1');
      // Archiving what is currently on air would leave the main page with
      // nothing to show.
      if (current && current.video_id === videoId) {
        throw conflict('That video is the main broadcast. Set another programme before archiving it.');
      }
      await store.run('UPDATE videos SET status = ?, updated_at = ? WHERE id = ?', 'archived', runtime.now(), videoId);
      return { video: publicVideo(await getRow(videoId), mediaBase), archived: true, fileRetained: Boolean(row.file_path) };
    },

    // --- programming ------------------------------------------------------

    async setProgramme(actorId, input) {
      const { videoId, note } = validate(input, {
        videoId: { type: 'string', required: true, max: 80 },
        note: { type: 'string', required: false, default: '', max: 200 },
      });
      const row = await getRow(videoId);
      if (row.status === 'archived') throw conflict('Cannot broadcast an archived video.');
      if (!row.file_path && !row.source_url && !row.youtube_id) {
        throw conflict('That video has nothing to play yet.');
      }

      const now = runtime.now();
      await store.tx(async (t) => {
        await t.run(
          `INSERT INTO programme (id, video_id, set_by, set_at, note) VALUES (1,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET video_id=excluded.video_id, set_by=excluded.set_by,
                                         set_at=excluded.set_at, note=excluded.note`,
          videoId, actorId, now, note,
        );
        await t.run(
          'INSERT INTO programme_history (id, video_id, set_by, set_at, note) VALUES (?,?,?,?,?)',
          `ph_${runtime.uuid()}`, videoId, actorId, now, note,
        );
        // Putting a video on air publishes it.
        if (row.status !== 'published') {
          await t.run('UPDATE videos SET status = ?, updated_at = ? WHERE id = ?', 'published', now, videoId);
        }
      });

      const programme = await this.currentProgramme();
      events.emit('programme', programme);
      return programme;
    },

    // The main broadcast. Null only before an admin has ever set one, in which
    // case the live service falls back to the seeded Central TV programme.
    async currentProgramme() {
      const row = await store.get('SELECT * FROM programme WHERE id = 1');
      if (!row) return { programme: null, video: null, source: 'unset' };
      const video = await store.get('SELECT * FROM videos WHERE id = ?', row.video_id);
      if (!video) return { programme: null, video: null, source: 'unset' };
      return {
        programme: { videoId: row.video_id, setBy: row.set_by, setAt: row.set_at, note: row.note },
        video: publicVideo(video, mediaBase),
        source: 'admin',
      };
    },

    async programmeWithHistory(limit = 20) {
      return {
        ...(await this.currentProgramme()),
        history: await store.all(
          'SELECT id, video_id AS "videoId", set_by AS "setBy", set_at AS "setAt", note FROM programme_history ORDER BY set_at DESC LIMIT ?',
          Math.min(limit, 100),
        ),
      };
    },

    // --- CRM --------------------------------------------------------------

    async crmOverview() {
      const videos = await store.get(
        // CASE rather than SUM(status = '...'): SQLite treats a comparison as
        // 1/0 and sums it happily, Postgres yields a boolean and refuses to.
        // CASE is correct on both.
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts,
                SUM(CASE WHEN status = 'archived' THEN 1 ELSE 0 END) AS archived,
                COALESCE(SUM(file_size), 0) AS "storedBytes"
         FROM videos`,
      );
      const [viewers, spend, moderation, engagement] = await Promise.all([
        ports.viewers?.summary?.() ?? null,
        ports.spend?.summary?.() ?? null,
        ports.moderation?.summary?.() ?? null,
        ports.engagement?.summary?.() ?? null,
      ]);
      return {
        generatedAt: runtime.now(),
        library: {
          total: videos.total, published: videos.published ?? 0,
          drafts: videos.drafts ?? 0, archived: videos.archived ?? 0,
          storedBytes: videos.storedBytes,
        },
        programme: await this.currentProgramme(),
        viewers, spend, moderation, engagement,
      };
    },

    async crmViewers({ limit = 50 } = {}) {
      const roster = (await ports.viewers?.list?.({ limit })) ?? [];
      const spendByUser = (await ports.spend?.byUser?.()) ?? {};
      return {
        viewers: roster.map((v) => ({ ...v, coinsSpent: spendByUser[v.id]?.spent ?? 0, gifts: spendByUser[v.id]?.gifts ?? 0 })),
      };
    },

    async crmModeration({ limit = 50 } = {}) {
      return { queue: (await ports.moderation?.queue?.({ limit })) ?? [] };
    },

    // --- live events ------------------------------------------------------
    liveEvents,
    liveSegments,

    close: () => store.close(),
  };
}
