// Broadcast segments produced in the browser.
//
// The admin page captures with MediaRecorder and posts a chunk every couple of
// seconds. Viewers fetch those chunks and append them through MediaSource. That
// is DIY segmented streaming: no media server, no encoder to install, and it
// works from any browser tab.
//
// What it costs: about 3-6 seconds of latency, because a segment cannot be sent
// until it has been recorded. Fine for a broadcast, wrong for a conversation.
// Sub-second needs an SFU, which is what the mux/cloudflare ingest drivers are
// for.
//
// Two rules make late joiners work:
//   - segment 0 is the initialisation segment (the WebM header). A player that
//     joins an hour in still needs it to decode anything, so it is never evicted.
//   - everything after it is a rolling window; old media segments are deleted
//     from disk so a six-hour broadcast does not fill the volume.

import { createWriteStream, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { join, resolve } from 'node:path';
import { badRequest, notFound, conflict } from '../../platform/errors.mjs';

export const SEGMENT_MIMES = ['video/webm', 'video/mp4', 'video/x-matroska'];
export const DEFAULT_WINDOW = 150;                 // ~5 minutes at 2s segments
export const MAX_SEGMENT_BYTES = 32 * 1024 * 1024; // one chunk, not one broadcast

export function createLiveSegments({
  runtime,
  store,
  root,
  window: windowSize = DEFAULT_WINDOW,
  maxSegmentBytes = MAX_SEGMENT_BYTES,
}) {
  mkdirSync(root, { recursive: true });

  const eventDir = (eventId) => {
    if (!/^[A-Za-z0-9_-]+$/.test(eventId)) throw badRequest('Malformed event id.');
    const dir = join(root, eventId);
    if (!resolve(dir).startsWith(resolve(root))) throw badRequest('Refusing to write outside the segment root.');
    return dir;
  };

  return {
    /**
     * Store one recorded chunk.
     * @param {boolean} init true for the header segment, which is kept forever
     */
    async append(eventId, { stream, contentType, contentLength, init = false }) {
      const mime = String(contentType || '').split(';')[0].trim().toLowerCase();
      if (!SEGMENT_MIMES.includes(mime)) {
        throw badRequest(`Unsupported segment type "${contentType}".`, { allowed: SEGMENT_MIMES });
      }
      if (contentLength !== null && contentLength !== undefined && Number(contentLength) > maxSegmentBytes) {
        throw badRequest(`Segment exceeds ${maxSegmentBytes} bytes.`);
      }

      const dir = eventDir(eventId);
      mkdirSync(dir, { recursive: true });

      const last = await store.get('SELECT MAX(seq) AS seq FROM live_segments WHERE event_id = ?', eventId);
      // Sequence 0 is reserved for the init segment so a player always knows
      // where the header is without a separate lookup.
      const seq = init ? 0 : Math.max(Number(last?.seq ?? 0), 0) + 1;
      if (init && Number(last?.seq ?? -1) >= 0) {
        const existing = await store.get('SELECT seq FROM live_segments WHERE event_id = ? AND seq = 0', eventId);
        if (existing) throw conflict('This broadcast already has an initialisation segment.');
      }

      const name = `${seq}.webm`;
      const absolute = join(dir, name);

      let bytes = 0;
      const meter = new Transform({
        transform(chunk, _enc, cb) {
          bytes += chunk.length;
          if (bytes > maxSegmentBytes) return cb(badRequest(`Segment exceeds ${maxSegmentBytes} bytes.`));
          cb(null, chunk);
        },
      });

      try {
        await pipeline(stream, meter, createWriteStream(absolute));
      } catch (err) {
        if (existsSync(absolute)) { try { rmSync(absolute); } catch { /* best effort */ } }
        throw err;
      }
      if (bytes === 0) {
        try { rmSync(absolute); } catch { /* best effort */ }
        throw badRequest('Empty segment.');
      }

      await store.run(
        `INSERT INTO live_segments (event_id, seq, path, bytes, mime, is_init, created_at)
         VALUES (?,?,?,?,?,?,?)`,
        eventId, seq, `${eventId}/${name}`, bytes, mime, init ? 1 : 0, runtime.now(),
      );

      await this.evict(eventId);
      return { seq, bytes, init };
    },

    /** Drop media segments that have fallen out of the window. Never seq 0. */
    async evict(eventId) {
      const stale = await store.all(
        `SELECT seq, path FROM live_segments
         WHERE event_id = ? AND is_init = 0
           AND seq <= (SELECT COALESCE(MAX(seq), 0) - ? FROM live_segments WHERE event_id = ?)`,
        eventId, windowSize, eventId,
      );
      for (const row of stale) {
        const absolute = join(root, row.path);
        if (existsSync(absolute)) { try { rmSync(absolute); } catch { /* best effort */ } }
        await store.run('DELETE FROM live_segments WHERE event_id = ? AND seq = ?', eventId, row.seq);
      }
      return { evicted: stale.length };
    },

    /**
     * The manifest a player polls: which segments exist right now.
     * `after` lets a player already watching ask only for what is new.
     */
    async manifest(eventId, { after = -1, limit = 60 } = {}) {
      const rows = await store.all(
        `SELECT seq, bytes, mime, is_init AS "isInit", created_at AS "createdAt"
         FROM live_segments WHERE event_id = ? AND seq > ? ORDER BY seq ASC LIMIT ?`,
        eventId, Number(after), Math.min(limit, 200),
      );
      const head = await store.get('SELECT MAX(seq) AS seq FROM live_segments WHERE event_id = ?', eventId);
      return {
        eventId,
        segments: rows.map((r) => ({ ...r, isInit: Boolean(r.isInit) })),
        head: Number(head?.seq ?? -1),
        at: runtime.now(),
      };
    },

    /** Where the bytes are, for the gateway to serve. */
    async locate(eventId, seq) {
      const row = await store.get('SELECT path, mime, bytes FROM live_segments WHERE event_id = ? AND seq = ?', eventId, Number(seq));
      if (!row) throw notFound(`No segment ${seq} for that broadcast.`);
      const absolute = join(root, row.path);
      if (!existsSync(absolute)) throw notFound('That segment has already been evicted.');
      return { absolute, mime: row.mime, bytes: statSync(absolute).size };
    },

    /** Everything for one broadcast, once it is over and nobody is watching. */
    async purge(eventId) {
      const dir = eventDir(eventId);
      if (existsSync(dir)) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ } }
      const res = await store.run('DELETE FROM live_segments WHERE event_id = ?', eventId);
      return { purged: res.changes };
    },
  };
}
