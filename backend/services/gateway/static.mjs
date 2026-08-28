// Static + media serving.
//
// Video is served with byte-range support. Without it a browser cannot seek an
// uploaded file and Safari refuses to play it at all, so this is not an
// optimisation - a 200-only video route is a broken video route.

import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

export const contentType = (path) => TYPES[extname(path).toLowerCase()] || 'application/octet-stream';

// Resolve a URL path inside a root, refusing anything that escapes it.
//
// Traversal is rejected outright rather than normalised away. Silently
// rewriting "/../../etc/passwd" into a lookup inside the root still ends in a
// 404, but a refusal says what happened, and a log of refusals is worth having.
// Two guards, because either alone has been enough to defeat before: reject
// ".." segments after decoding, then verify the resolved path is still under
// the root.
export function safeResolve(root, urlPath) {
  const decoded = (() => { try { return decodeURIComponent(urlPath); } catch { return null; } })();
  if (decoded === null || decoded.includes('\0')) return null;

  const segments = decoded.split(/[/\\]+/).filter((s) => s !== '' && s !== '.');
  if (segments.some((s) => s === '..')) return null;

  const absolute = resolve(join(root, normalize(segments.join('/'))));
  const base = resolve(root);
  if (absolute !== base && !absolute.startsWith(base + '/')) return null;
  return absolute;
}

export function serveFile(req, res, absolute, { cache = 'public, max-age=300' } = {}) {
  if (!absolute || !existsSync(absolute)) return false;
  const stat = statSync(absolute);
  if (stat.isDirectory()) return false;

  const type = contentType(absolute);
  const range = req.headers.range;

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (m) {
      let start = m[1] === '' ? null : Number(m[1]);
      let end = m[2] === '' ? null : Number(m[2]);
      // "bytes=-500" means the last 500 bytes, not "from 0 to 500".
      if (start === null && end !== null) { start = Math.max(stat.size - end, 0); end = stat.size - 1; }
      else if (start !== null && end === null) { end = stat.size - 1; }

      if (start === null || start >= stat.size || start > end) {
        res.writeHead(416, { 'content-range': `bytes */${stat.size}`, 'accept-ranges': 'bytes' });
        res.end();
        return true;
      }
      end = Math.min(end, stat.size - 1);
      res.writeHead(206, {
        'content-type': type,
        'content-length': end - start + 1,
        'content-range': `bytes ${start}-${end}/${stat.size}`,
        'accept-ranges': 'bytes',
        'cache-control': cache,
      });
      if (req.method === 'HEAD') { res.end(); return true; }
      createReadStream(absolute, { start, end }).pipe(res);
      return true;
    }
  }

  res.writeHead(200, {
    'content-type': type,
    'content-length': stat.size,
    'accept-ranges': 'bytes',
    'cache-control': cache,
    'last-modified': new Date(stat.mtimeMs).toUTCString(),
  });
  if (req.method === 'HEAD') { res.end(); return true; }
  createReadStream(absolute).pipe(res);
  return true;
}
