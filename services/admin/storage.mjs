// Video file storage.
//
// Raw binary PUT, deliberately not multipart. Hand-rolling a multipart parser
// for multi-gigabyte video is a bug farm, and a raw stream to disk is both
// simpler and better behaved for large files. The client sends the bytes with a
// Content-Type; the server never trusts a client-supplied filename.

import { createWriteStream, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { join, resolve } from 'node:path';
import { badRequest } from '../../platform/errors.mjs';

export const ALLOWED_TYPES = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-matroska': 'mkv',
};

export const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export function createStorage({ root, maxBytes = DEFAULT_MAX_BYTES }) {
  mkdirSync(root, { recursive: true });

  return {
    root,

    // The stored name is derived entirely from the video id and the verified
    // content type, so a hostile filename has nothing to poison. There is no
    // path segment a caller controls.
    async save(videoId, contentType, source, { declaredLength = null } = {}) {
      const ext = ALLOWED_TYPES[String(contentType || '').split(';')[0].trim().toLowerCase()];
      if (!ext) {
        throw badRequest(`Unsupported video type "${contentType}".`, {
          allowed: Object.keys(ALLOWED_TYPES),
        });
      }
      if (declaredLength !== null && Number(declaredLength) > maxBytes) {
        throw badRequest(`Video exceeds the ${maxBytes} byte limit.`, { maxBytes, declaredLength: Number(declaredLength) });
      }
      if (!/^[A-Za-z0-9_-]+$/.test(videoId)) throw badRequest('Malformed video id.');

      const relative = `${videoId}.${ext}`;
      const absolute = join(root, relative);
      // Belt and braces: the resolved path must still sit under the root.
      if (!resolve(absolute).startsWith(resolve(root))) throw badRequest('Refusing to write outside the uploads root.');

      let bytes = 0;
      const meter = new Transform({
        transform(chunk, _enc, cb) {
          bytes += chunk.length;
          // Enforce on the actual stream, not just the declared header: a
          // Content-Length can lie, a stream cannot.
          if (bytes > maxBytes) return cb(badRequest(`Video exceeds the ${maxBytes} byte limit.`, { maxBytes }));
          cb(null, chunk);
        },
      });

      try {
        await pipeline(source, meter, createWriteStream(absolute));
      } catch (err) {
        // A partial file from a rejected upload must not linger and be served.
        if (existsSync(absolute)) { try { unlinkSync(absolute); } catch { /* best effort */ } }
        throw err;
      }
      if (bytes === 0) {
        try { unlinkSync(absolute); } catch { /* best effort */ }
        throw badRequest('Uploaded video was empty.');
      }
      return { path: relative, absolute, size: bytes, contentType, ext };
    },

    stat(relative) {
      const absolute = join(root, relative);
      if (!existsSync(absolute)) return null;
      const s = statSync(absolute);
      return { absolute, size: s.size, mtime: s.mtimeMs };
    },

    exists: (relative) => existsSync(join(root, relative)),
  };
}
