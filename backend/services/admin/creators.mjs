// The creator surface: phase 1 of the creator network plan.
//
// Creators publish videos and go live into their OWN spotlight channel - the
// same tables the network library uses, scoped by owner_id, so the upload
// pipeline, the segment ingest and the WHIP studio are reused rather than
// rebuilt. Two rules hold everywhere here:
//
//   1. The main view is untouched. A creator live event carries scope
//      'creator' and is invisible to the stage machine's current() query.
//   2. The role is the approval; the subscription is the gate. An approved
//      creator who lets their subscription lapse keeps their content but
//      cannot publish more until they renew.
//
// Tasks are commissioned work: the network posts a brief with a KashCoin
// bounty, a creator accepts and delivers a video, and approval pays out
// through the wallet ledger - idempotently, keyed by the task id.

import { validate } from '../../platform/validate.mjs';
import { notFound, badRequest, conflict, forbidden } from '../../platform/errors.mjs';
import { parseDuration } from './service.mjs';

export const TASK_STATUSES = ['open', 'accepted', 'delivered', 'approved', 'rejected'];

const publicTask = (row) => ({
  id: row.id,
  title: row.title,
  brief: row.brief,
  productId: row.product_id,
  bounty: row.bounty,
  deadline: row.deadline,
  status: row.status,
  assigneeId: row.assignee_id,
  deliveryVideoId: row.delivery_video_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createCreatorSurface({
  runtime,
  store,
  catalog,
  files,
  serializeVideo,             // the admin service's publicVideo, injected
  liveEvents,
  liveSegments,
  wallet = {},                // { subscriptionActive, payBounty } - injected ports
  identity = {},              // { profile } - injected port
}) {
  const knownProduct = (productId) =>
    catalog.products().products.some((p) => p.id === productId);

  // The subscription gate. Admins pass so the back office can act on a
  // creator's behalf without buying a plan for the test account.
  const requireSubscription = async (auth) => {
    if (auth.role === 'admin') return;
    const active = await wallet.subscriptionActive?.(auth.userId, 'creator');
    if (!active) {
      throw forbidden('Publishing needs an active creator subscription. Subscribe from the portal to continue.');
    }
  };

  const ownRow = async (auth, videoId) => {
    const row = await store.get('SELECT * FROM videos WHERE id = ?', videoId);
    // A 404, not a 403: whether a video exists at all is not this caller's
    // business unless it is theirs.
    if (!row || row.owner_id !== auth.userId) throw notFound(`No video "${videoId}" on your channel.`);
    return row;
  };

  const ownEventRow = async (auth, eventId) => {
    const row = await store.get('SELECT * FROM live_events WHERE id = ?', eventId);
    if (!row || row.owner_id !== auth.userId || (row.scope ?? 'network') !== 'creator') {
      throw notFound(`No live session "${eventId}" on your channel.`);
    }
    return row;
  };

  const taskRow = async (taskId) => {
    const row = await store.get('SELECT * FROM tasks WHERE id = ?', taskId);
    if (!row) throw notFound(`No task "${taskId}".`);
    return row;
  };

  return {
    // --- creator videos ---------------------------------------------------

    async listOwn(auth, { limit = 50 } = {}) {
      const rows = await store.all(
        'SELECT * FROM videos WHERE owner_id = ? ORDER BY created_at DESC LIMIT ?',
        auth.userId, Math.min(limit, 200),
      );
      return { videos: rows.map(serializeVideo), total: rows.length };
    },

    async createOwn(auth, input) {
      await requireSubscription(auth);
      const v = validate(input, {
        title: { type: 'string', required: true, min: 2, max: 160 },
        description: { type: 'string', required: false, default: '', max: 2_000 },
        productId: { type: 'string', required: false, default: 'neutv', max: 40 },
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
      await store.run(
        `INSERT INTO videos (id, title, description, product_id, kind, status, source_url, youtube_id,
                             duration_secs, poster_url, owner_id, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, v.title, v.description, v.productId, v.kind,
        v.kind === 'external' ? 'ready' : 'draft',
        v.sourceUrl ?? null, v.youtubeId ?? null,
        v.durationSeconds ?? parseDuration(v.duration), v.posterUrl ?? null,
        auth.userId, auth.userId, now, now,
      );
      const row = await store.get('SELECT * FROM videos WHERE id = ?', id);
      return {
        video: serializeVideo(row),
        upload: v.kind === 'upload'
          ? { method: 'PUT', url: `/api/v1/creator/videos/${id}/file`, note: 'Send the raw file bytes with a video Content-Type.' }
          : null,
      };
    },

    async updateOwn(auth, videoId, input) {
      const row = await ownRow(auth, videoId);
      const v = validate(input, {
        title: { type: 'string', required: false, min: 2, max: 160 },
        description: { type: 'string', required: false, max: 2_000 },
        posterUrl: { type: 'string', required: false, max: 600 },
        sourceUrl: { type: 'string', required: false, max: 600 },
        youtubeId: { type: 'string', required: false, max: 40 },
        status: { type: 'string', required: false, enum: ['draft', 'ready', 'published', 'archived'] },
        duration: { type: 'string', required: false, max: 20 },
        durationSeconds: { type: 'int', required: false, min: 0, max: 86_400 },
      });
      // Publishing is the one transition that needs the gate: it is what puts
      // the video on the spotlight.
      if (v.status === 'published' && row.status !== 'published') await requireSubscription(auth);

      const source = { source_url: row.source_url, youtube_id: row.youtube_id };
      if (v.youtubeId) { source.youtube_id = v.youtubeId; source.source_url = null; }
      else if (v.sourceUrl) { source.source_url = v.sourceUrl; source.youtube_id = null; }

      const playable = Boolean(row.file_path || source.source_url || source.youtube_id);
      if (v.status === 'published' && !playable) {
        throw conflict('Cannot publish a video with no file and no source URL.');
      }
      await store.run(
        `UPDATE videos SET title=?, description=?, poster_url=?, source_url=?, youtube_id=?,
                           status=?, duration_secs=?, updated_at=? WHERE id=?`,
        v.title ?? row.title, v.description ?? row.description, v.posterUrl ?? row.poster_url,
        source.source_url, source.youtube_id,
        v.status ?? row.status,
        v.durationSeconds ?? (v.duration ? parseDuration(v.duration) : row.duration_secs),
        runtime.now(), videoId,
      );
      return { video: serializeVideo(await store.get('SELECT * FROM videos WHERE id = ?', videoId)) };
    },

    async uploadSignatureOwn(auth, videoId) {
      const row = await ownRow(auth, videoId);
      await requireSubscription(auth);
      if (row.kind !== 'upload') throw conflict('That video is external; it has no file to upload.');
      if (typeof files.signUpload !== 'function') {
        throw conflict(`The ${files.driver} storage driver cannot accept a direct upload. Use PUT .../file instead.`);
      }
      return { videoId, ...files.signUpload(videoId) };
    },

    async completeUploadOwn(auth, videoId, input) {
      const row = await ownRow(auth, videoId);
      if (row.kind !== 'upload') throw conflict('That video is external; it has no file to upload.');
      const v = validate(input, {
        path: { type: 'string', required: true, max: 400 },
        bytes: { type: 'int', required: false, min: 0 },
        contentType: { type: 'string', required: false, max: 80 },
        durationSeconds: { type: 'int', required: false, min: 0, max: 86_400 },
      });
      await store.run(
        `UPDATE videos SET file_path = ?, file_size = ?, content_type = ?, duration_secs = ?,
                           status = ?, updated_at = ? WHERE id = ?`,
        v.path, v.bytes ?? null, v.contentType ?? 'video/mp4',
        v.durationSeconds ?? row.duration_secs,
        row.status === 'draft' ? 'ready' : row.status, runtime.now(), videoId,
      );
      return { video: serializeVideo(await store.get('SELECT * FROM videos WHERE id = ?', videoId)) };
    },

    async uploadFileOwn(auth, videoId, { stream, contentType, contentLength }) {
      const row = await ownRow(auth, videoId);
      await requireSubscription(auth);
      if (row.kind !== 'upload') throw conflict('That video is external; it has no file to upload.');
      const saved = await files.save(videoId, contentType, stream, { declaredLength: contentLength });
      await store.run(
        `UPDATE videos SET file_path = ?, file_size = ?, content_type = ?, status = ?, updated_at = ?
         WHERE id = ?`,
        saved.path, saved.size, saved.contentType, row.status === 'draft' ? 'ready' : row.status,
        runtime.now(), videoId,
      );
      return { video: serializeVideo(await store.get('SELECT * FROM videos WHERE id = ?', videoId)) };
    },

    // Public: one published creator video. This is what lets a spotlight card
    // take a personal stage takeover - the live service resolves the id here.
    async publishedOwn(videoId) {
      const row = await store.get('SELECT * FROM videos WHERE id = ?', videoId);
      if (!row || !row.owner_id || row.status !== 'published') {
        throw notFound(`No published creator video "${videoId}".`);
      }
      return { video: { ...serializeVideo(row), ownerId: row.owner_id } };
    },

    // --- creator live -----------------------------------------------------

    async createLive(auth, input) {
      await requireSubscription(auth);
      const created = await liveEvents.create(auth.userId, {
        ...input,
        source: input?.source ?? 'browser',
      }, { scope: 'creator', ownerId: auth.userId });
      return created;
    },

    async listLive(auth, { limit = 20 } = {}) {
      return liveEvents.list({ ownerId: auth.userId, limit });
    },

    async startLive(auth, eventId, input = {}) {
      await requireSubscription(auth);
      await ownEventRow(auth, eventId);
      return liveEvents.start(eventId, input);
    },

    async stopLive(auth, eventId, input = {}) {
      await ownEventRow(auth, eventId);
      return liveEvents.stop(eventId, input);
    },

    async appendSegmentOwn(auth, eventId, raw) {
      await ownEventRow(auth, eventId);
      return liveSegments.append(eventId, raw);
    },

    // --- the spotlight ----------------------------------------------------

    /**
     * Public. One card per creator with something to show: their live session
     * when one is on, otherwise their latest published video. Merged by the
     * viewer app after the seeded editorial spotlights - the rail lights up
     * with real creators without the catalog changing shape.
     */
    async spotlights({ limit = 24 } = {}) {
      const [liveRows, videoRows] = await Promise.all([
        store.all("SELECT * FROM live_events WHERE scope = 'creator' AND status = 'live' ORDER BY started_at DESC"),
        store.all(
          "SELECT * FROM videos WHERE owner_id IS NOT NULL AND status = 'published' ORDER BY created_at DESC LIMIT 120",
        ),
      ]);

      const byOwner = new Map();
      for (const event of liveRows) {
        if (!byOwner.has(event.owner_id)) byOwner.set(event.owner_id, { live: event, video: null });
      }
      for (const row of videoRows) {
        const entry = byOwner.get(row.owner_id) ?? { live: null, video: null };
        if (!entry.video) entry.video = row;
        byOwner.set(row.owner_id, entry);
      }

      const cards = [];
      for (const [ownerId, { live, video }] of byOwner) {
        if (cards.length >= Math.min(limit, 50)) break;
        const profile = (await identity.profile?.(ownerId)) ?? null;
        if (!profile) continue; // an orphaned row is not a card
        const productId = live?.product_id ?? video?.product_id ?? profile.productId;
        const product = catalog.products().products.find((p) => p.id === productId);
        const played = video ? serializeVideo(video) : null;
        cards.push({
          // A live channel promotes by its video (takeover) or plays the live
          // session directly; the id is what the viewer sends to /live/stage.
          id: video?.id ?? `live-${live.id}`,
          name: profile.name,
          handle: profile.handle?.startsWith('@') ? profile.handle : `@${profile.handle}`,
          avatar: profile.avatar,
          product: product?.name ?? productId,
          productId,
          tag: 'Creator',
          title: live?.title ?? video?.title ?? '',
          thumbnail: live?.poster_url ?? video?.poster_url ?? null,
          videoMp4: played?.youtubeId ? null : (played?.playbackUrl ?? null),
          videoUrl: played?.youtubeId ?? null,   // seed convention: a bare YouTube id
          duration: null,
          isLive: Boolean(live),
          liveEventId: live?.id ?? null,
          liveTransport: live?.transport ?? null,
          livePlaybackUrl: live?.playback_url ?? null,
          creator: true,
        });
      }
      return { spotlights: cards };
    },

    // --- tasks ------------------------------------------------------------

    async adminListTasks({ status = null, limit = 50 } = {}) {
      const rows = status
        ? await store.all('SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?', status, Math.min(limit, 200))
        : await store.all('SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?', Math.min(limit, 200));
      return { tasks: rows.map(publicTask) };
    },

    async adminCreateTask(actorId, input) {
      const v = validate(input, {
        title: { type: 'string', required: true, min: 2, max: 160 },
        brief: { type: 'string', required: false, default: '', max: 4_000 },
        productId: { type: 'string', required: false, default: 'neutv', max: 40 },
        bounty: { type: 'int', required: true, min: 1, max: 1_000_000 },
        deadline: { type: 'int', required: false, min: 0 },
      });
      if (!knownProduct(v.productId)) throw badRequest(`"${v.productId}" is not an ecosystem product.`);
      const id = `task_${runtime.uuid()}`;
      const now = runtime.now();
      await store.run(
        `INSERT INTO tasks (id, title, brief, product_id, bounty, deadline, status, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id, v.title, v.brief, v.productId, v.bounty, v.deadline ?? null, 'open', actorId, now, now,
      );
      return { task: publicTask(await taskRow(id)) };
    },

    /**
     * Approval is what pays. The bounty credit is keyed by the task id, so a
     * double-click or a retried request cannot pay twice - the ledger replays
     * the original transaction.
     */
    async adminApproveTask(taskId) {
      const row = await taskRow(taskId);
      if (row.status !== 'delivered') throw conflict(`Only a delivered task can be approved; this one is "${row.status}".`);
      await store.run("UPDATE tasks SET status = 'approved', updated_at = ? WHERE id = ?", runtime.now(), taskId);
      // Publish the delivery so it reaches the spotlight, if it can play.
      const video = row.delivery_video_id
        ? await store.get('SELECT * FROM videos WHERE id = ?', row.delivery_video_id)
        : null;
      if (video && video.status !== 'published' && (video.file_path || video.source_url || video.youtube_id)) {
        await store.run("UPDATE videos SET status = 'published', updated_at = ? WHERE id = ?", runtime.now(), video.id);
      }
      const paid = await wallet.payBounty?.(row.assignee_id, row.bounty, `task-${taskId}`, `Bounty: ${row.title}`);
      return { task: publicTask(await taskRow(taskId)), paid: paid ?? null };
    },

    async adminRejectTask(taskId) {
      const row = await taskRow(taskId);
      if (row.status !== 'delivered') throw conflict(`Only a delivered task can be rejected; this one is "${row.status}".`);
      await store.run("UPDATE tasks SET status = 'rejected', updated_at = ? WHERE id = ?", runtime.now(), taskId);
      return { task: publicTask(await taskRow(taskId)) };
    },

    /** Open briefs plus this creator's own, whatever their state. */
    async creatorListTasks(auth, { limit = 50 } = {}) {
      const rows = await store.all(
        `SELECT * FROM tasks WHERE status = 'open' OR assignee_id = ? ORDER BY created_at DESC LIMIT ?`,
        auth.userId, Math.min(limit, 200),
      );
      return { tasks: rows.map(publicTask) };
    },

    async acceptTask(auth, taskId) {
      await requireSubscription(auth);
      const row = await taskRow(taskId);
      if (row.status !== 'open') throw conflict('That brief has already been taken.');
      await store.run(
        "UPDATE tasks SET status = 'accepted', assignee_id = ?, updated_at = ? WHERE id = ? AND status = 'open'",
        auth.userId, runtime.now(), taskId,
      );
      const after = await taskRow(taskId);
      if (after.assignee_id !== auth.userId) throw conflict('That brief has already been taken.');
      return { task: publicTask(after) };
    },

    async deliverTask(auth, taskId, input) {
      const { videoId } = validate(input, {
        videoId: { type: 'string', required: true, max: 80 },
      });
      const row = await taskRow(taskId);
      if (row.assignee_id !== auth.userId) throw notFound(`No task "${taskId}" assigned to you.`);
      if (row.status !== 'accepted') throw conflict(`Only an accepted task can be delivered; this one is "${row.status}".`);
      const video = await ownRow(auth, videoId);
      if (!video.file_path && !video.source_url && !video.youtube_id) {
        throw conflict('That video has nothing to play yet. Upload the file first.');
      }
      await store.run(
        "UPDATE tasks SET status = 'delivered', delivery_video_id = ?, updated_at = ? WHERE id = ?",
        videoId, runtime.now(), taskId,
      );
      return { task: publicTask(await taskRow(taskId)) };
    },
  };
}
