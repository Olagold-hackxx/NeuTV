// Live event lifecycle.
//
//   scheduled -> live -> ended
//   scheduled -> cancelled
//
// Exactly one event may be live at a time: the network has one main stage, and
// two things claiming it is not a state the stage machine can resolve. Going on
// air supersedes the programmed video; ending falls back to it.
//
// The stream key never leaves the admin surface. publicEvent() is what the
// viewer app and the live service see, and it has no key in it at all.

import { validate } from '../../platform/validate.mjs';
import { notFound, conflict, badRequest } from '../../platform/errors.mjs';
import { mintStreamKey, validatePlayback } from './ingest/index.mjs';

export const STATUSES = ['scheduled', 'live', 'ended', 'cancelled'];

/** Everything an admin may see, including ingest credentials. */
export const adminEvent = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  productId: row.product_id,
  status: row.status,
  source: row.source ?? 'external',
  driver: row.driver,
  ingestUrl: row.ingest_url,
  whipUrl: row.whip_url,
  streamKey: row.stream_key,
  playbackUrl: row.playback_url,
  youtubeId: row.youtube_id,
  posterUrl: row.poster_url,
  scheduledFor: row.scheduled_for,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  transport: row.transport ?? null,
  peakViewers: row.peak_viewers,
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  isLive: row.status === 'live',
});

/**
 * What everyone else sees. Deliberately built by naming each field rather than
 * deleting from adminEvent: a field added to the admin shape later cannot leak
 * here by accident, and the stream key is the field that must never leak.
 */
export const publicEvent = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  productId: row.product_id,
  status: row.status,
  source: row.source ?? 'external',
  // Which player the viewer should open. Reported, never guessed.
  transport: row.transport ?? null,
  playbackUrl: row.playback_url,
  youtubeId: row.youtube_id,
  posterUrl: row.poster_url,
  startedAt: row.started_at,
  isLive: row.status === 'live',
});

export function createLiveEvents({ runtime, store, catalog, ingest, events }) {
  /**
   * Re-derive a MediaMTX event's endpoints from where the server is NOW.
   *
   * The stored URLs are whatever hostname the deployment had when the event
   * was created. That was fine until the domain moved: every older event kept
   * serving `https://<old-domain>/hls/...` to viewers, and the player failed
   * against a hostname that no longer answered. The path (the stream key) is
   * the event's identity and never changes; the hostname is deployment
   * configuration and must never be trusted from storage.
   *
   * Only URLs the provider itself minted are rewritten - recognised by their
   * `/<path>/...` suffix - so a playback URL an admin pasted by hand survives.
   * A null whip_url is filled in too, which retroactively enables WHIP for
   * events created before it was configured.
   */
  const located = (row) => {
    if (!row || row.driver !== 'mediamtx' || typeof ingest.endpoints !== 'function') return row;
    const path = row.provider_ref ?? row.stream_key;
    if (!path) return row;
    const now = ingest.endpoints(path);
    const mintedHere = (url, suffix) => url == null || (typeof url === 'string' && url.endsWith(suffix));
    return {
      ...row,
      ingest_url: now.ingestUrl,
      whip_url: mintedHere(row.whip_url, `/${path}/whip`) ? now.whipUrl : row.whip_url,
      playback_url: mintedHere(row.playback_url, `/${path}/index.m3u8`) ? now.playbackUrl : row.playback_url,
    };
  };

  const getRow = async (eventId) => {
    const row = await store.get('SELECT * FROM live_events WHERE id = ?', eventId);
    if (!row) throw notFound(`No live event "${eventId}".`);
    return located(row);
  };

  const knownProduct = (productId) =>
    catalog.products().products.some((p) => p.id === productId);

  return {
    async list({ status = null, limit = 50 } = {}) {
      const rows = status
        ? await store.all('SELECT * FROM live_events WHERE status = ? ORDER BY created_at DESC LIMIT ?', status, Math.min(limit, 200))
        : await store.all('SELECT * FROM live_events ORDER BY created_at DESC LIMIT ?', Math.min(limit, 200));
      return { events: rows.map((r) => adminEvent(located(r))) };
    },

    async get(eventId) {
      return { event: adminEvent(await getRow(eventId)) };
    },

    /** The event on air, if any. Used by the live service and the viewer app. */
    async current() {
      const row = await store.get("SELECT * FROM live_events WHERE status = 'live' ORDER BY started_at DESC LIMIT 1");
      return { event: row ? publicEvent(located(row)) : null };
    },

    async create(actorId, input) {
      const v = validate(input, {
        title: { type: 'string', required: true, min: 2, max: 160 },
        description: { type: 'string', required: false, default: '', max: 2_000 },
        productId: { type: 'string', required: false, default: 'worldstreet', max: 40 },
        playbackUrl: { type: 'string', required: false, max: 600 },
        posterUrl: { type: 'string', required: false, max: 600 },
        scheduledFor: { type: 'int', required: false, min: 0 },
        source: { type: 'string', required: false, default: 'external', enum: ['external', 'browser'] },
      });
      if (!knownProduct(v.productId)) throw badRequest(`"${v.productId}" is not an ecosystem product.`);
      if (v.source === 'external' && !v.playbackUrl) {
        // Not fatal - it can be added before going on air - but a browser
        // broadcast never needs one and should not be nagged for it.
      }

      // The provider decides what ingest looks like. With the manual driver
      // that is "nothing", and the admin supplies the playback URL instead.
      const provisioned = await ingest.provision({ title: v.title, playbackUrl: v.playbackUrl });
      const playback = validatePlayback(provisioned.playbackUrl ?? v.playbackUrl);

      const id = `evt_${runtime.uuid()}`;
      const now = runtime.now();
      await store.run(
        `INSERT INTO live_events (id, title, description, product_id, status, source, driver, ingest_url,
                                  whip_url, stream_key, playback_url, youtube_id, poster_url, provider_ref,
                                  scheduled_for, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, v.title, v.description, v.productId, 'scheduled', v.source, ingest.driver,
        provisioned.ingestUrl ?? null,
        provisioned.whipUrl ?? null,
        // Even the manual driver gets a key: it is what a future self-hosted
        // RTMP endpoint authenticates, and minting it now avoids a migration.
        provisioned.streamKey ?? mintStreamKey(),
        playback?.playbackUrl ?? null, playback?.youtubeId ?? null,
        v.posterUrl ?? null, provisioned.providerRef ?? null,
        v.scheduledFor ?? null, actorId, now, now,
      );
      return { event: adminEvent(await getRow(id)), instructions: provisioned.instructions };
    },

    async update(eventId, input) {
      const row = await getRow(eventId);
      if (row.status === 'live') throw conflict('That event is on air. Stop it before editing.');
      if (row.status === 'ended') throw conflict('That event has already ended.');

      const v = validate(input, {
        title: { type: 'string', required: false, min: 2, max: 160 },
        description: { type: 'string', required: false, max: 2_000 },
        productId: { type: 'string', required: false, max: 40 },
        source: { type: 'string', required: false, enum: ['external', 'browser'] },
        playbackUrl: { type: 'string', required: false, max: 600 },
        posterUrl: { type: 'string', required: false, max: 600 },
        scheduledFor: { type: 'int', required: false, min: 0 },
      });
      if (v.productId && !knownProduct(v.productId)) throw badRequest(`"${v.productId}" is not an ecosystem product.`);
      const playback = v.playbackUrl ? validatePlayback(v.playbackUrl) : null;

      // How an event is fed is editable, and it has to be.
      //
      // An event scheduled as "external" with no playback URL could not start -
      // start() refuses it - and could not be converted to a browser broadcast
      // either, because source was fixed at creation. The only way out was to
      // cancel it and start again, which is not a thing an operator should have
      // to work out from a 409.
      const source = v.source ?? row.source ?? 'external';
      // A browser broadcast is fed by the studio, so it needs no URL. An
      // external one is nothing without somewhere to point viewers.
      const nextPlayback = playback ? playback.playbackUrl : row.playback_url;
      const nextYouTube = playback ? playback.youtubeId : row.youtube_id;
      if (source === 'external' && !nextPlayback && !nextYouTube) {
        throw badRequest(
          'An external event needs a playback URL or a YouTube id. '
          + 'Switch it to a browser broadcast if you want to stream from the studio instead.',
        );
      }

      await store.run(
        `UPDATE live_events SET title=?, description=?, product_id=?, source=?, playback_url=?, youtube_id=?,
                                poster_url=?, scheduled_for=?, updated_at=? WHERE id=?`,
        v.title ?? row.title,
        v.description ?? row.description,
        v.productId ?? row.product_id,
        source,
        nextPlayback,
        nextYouTube,
        v.posterUrl ?? row.poster_url,
        v.scheduledFor ?? row.scheduled_for,
        runtime.now(), eventId,
      );
      return { event: adminEvent(await getRow(eventId)) };
    },

    /**
     * @param {{transport?: 'segments'|'whip'}} [input] how the studio is
     *   actually sending video. Absent for an encoder event, whose transport is
     *   whatever its playback URL says.
     */
    async start(eventId, input = {}) {
      const row = await getRow(eventId);
      if (row.status === 'live') throw conflict('That event is already on air.');
      if (row.status !== 'scheduled') throw conflict(`Cannot go on air from "${row.status}".`);
      // Nothing to show is not a broadcast - but what "something to show" means
      // depends on how the event is fed. A browser broadcast has no URL by
      // design: its video arrives as segments once the studio starts recording.
      if (row.source !== 'browser' && !row.playback_url && !row.youtube_id) {
        throw conflict('That event has no playback URL yet, so viewers would see nothing.');
      }

      const already = await store.get("SELECT id, title FROM live_events WHERE status = 'live' LIMIT 1");
      if (already) {
        throw conflict(`"${already.title}" is already on air. Stop it first.`, { liveEventId: already.id });
      }

      const v = validate(input, {
        transport: { type: 'string', required: false, enum: ['segments', 'whip'] },
      });

      const now = runtime.now();
      await store.run(
        "UPDATE live_events SET status = 'live', started_at = ?, updated_at = ?, transport = ? WHERE id = ?",
        // Null means "nobody has said yet", which the viewer infers from the
        // playback URL. Guessing 'segments' here for a browser event would be
        // wrong for exactly the case this whole column exists to fix: an event
        // started from the panel and then broadcast over WHIP.
        now, now, v.transport ?? null, eventId,
      );
      const event = publicEvent(await getRow(eventId));
      // Viewers switch without reloading.
      events.emit('live-event', { status: 'started', event });
      return { event: adminEvent(await getRow(eventId)) };
    },

    async stop(eventId, { peakViewers = 0 } = {}) {
      const row = await getRow(eventId);
      if (row.status !== 'live') throw conflict('That event is not on air.');

      const now = runtime.now();
      await store.run(
        "UPDATE live_events SET status = 'ended', ended_at = ?, updated_at = ?, peak_viewers = ? WHERE id = ?",
        now, now, Math.max(peakViewers, row.peak_viewers), eventId,
      );
      // Release whatever the provider allocated. A failure here must not stop
      // the broadcast ending - the row is already 'ended' and viewers have
      // moved on; a dangling live input is a billing problem, not an outage.
      try { await ingest.teardown(row.provider_ref); } catch { /* logged by the provider */ }

      events.emit('live-event', { status: 'ended', event: publicEvent(await getRow(eventId)) });
      return { event: adminEvent(await getRow(eventId)) };
    },

    /** Mint a new key. The old one stops working immediately. */
    async rotateKey(eventId) {
      const row = await getRow(eventId);
      if (row.status === 'ended' || row.status === 'cancelled') {
        throw conflict('That event is over; rotating its key achieves nothing.');
      }
      const key = mintStreamKey();
      await store.run('UPDATE live_events SET stream_key = ?, updated_at = ? WHERE id = ?', key, runtime.now(), eventId);
      return { event: adminEvent(await getRow(eventId)) };
    },

    async cancel(eventId) {
      const row = await getRow(eventId);
      if (row.status === 'live') throw conflict('That event is on air. Stop it before cancelling.');
      await store.run("UPDATE live_events SET status = 'cancelled', updated_at = ? WHERE id = ?", runtime.now(), eventId);
      try { await ingest.teardown(row.provider_ref); } catch { /* best effort */ }
      return { event: adminEvent(await getRow(eventId)) };
    },

    /** Recorded on the event so a finished broadcast keeps its own high water mark. */
    async recordViewers(count) {
      await store.run(
        "UPDATE live_events SET peak_viewers = ? WHERE status = 'live' AND peak_viewers < ?",
        count, count,
      );
    },
  };
}
