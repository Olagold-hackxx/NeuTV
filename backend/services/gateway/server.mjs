#!/usr/bin/env node
// NEU TV gateway.
//
// Owns sockets, and only sockets: it resolves the session, enforces the auth
// level the contract declares for a route, applies rate limits, and hands a
// normalized request to the right service router. No business logic lives here,
// which is why a service can be pulled out and run on its own port without a
// single change to its code.

import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Readable } from 'node:stream';

import { compose } from './compose.mjs';
import { dispatch, parseQuery, parseJsonBody } from '../../platform/http.mjs';
import { ApiError, unauthorized, forbidden, notFound, badRequest } from '../../platform/errors.mjs';
import { createLimiter } from '../../platform/ratelimit.mjs';
import { CONTRACT_VERSION, API_PREFIX } from '../../contracts/version.mjs';
import { ROUTES, SERVICES } from '../../contracts/manifest.mjs';
import { safeResolve, serveFile } from './static.mjs';

const BACKEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const REPO_ROOT = join(BACKEND_ROOT, '..');
// The gateway serves the static frontend in single-process deployments. Point
// NEUTV_FRONTEND_ROOT elsewhere (or put a CDN in front) to split them.
const FRONTEND_ROOT = process.env.NEUTV_FRONTEND_ROOT || join(REPO_ROOT, 'frontend');
const MAX_JSON_BYTES = 1024 * 1024; // 1 MB; uploads take the raw path instead

export async function createGateway(options = {}) {
  const app = await compose(options);
  const limiter = createLimiter(app.runtime);
  const uploadsRoot = options.uploadsRoot || join(BACKEND_ROOT, 'services', 'admin', 'data', 'uploads');
  const staticRoot = options.staticRoot || FRONTEND_ROOT;
  const corsOrigin = options.corsOrigin ?? '*';

  // path -> which service router owns it, derived from the contract so the
  // gateway cannot drift from the manifest. Matching is done on method AND
  // path: a path-only match would let an undeclared method inherit another
  // route's auth level, which reported 401 where it owed a 405.
  const matchPath = (route, parts) => {
    const seg = route.path.split('/').filter(Boolean);
    if (seg.length !== parts.length) return false;
    return seg.every((s, i) => s.startsWith(':') || s === parts[i]);
  };

  const ownerOf = (method, path) => {
    const parts = path.split('/').filter(Boolean);
    const onPath = ROUTES.filter((route) => matchPath(route, parts));
    if (!onPath.length) return { route: null, pathExists: false };
    const exact = onPath.find((route) => route.method === method);
    return { route: exact ?? null, pathExists: true, allowed: onPath.map((r) => r.method) };
  };

  const send = (res, status, body, headers = {}) => {
    const payload = body === null || body === undefined ? '' : JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(payload),
      'x-contract-version': CONTRACT_VERSION,
      ...headers,
    });
    res.end(payload);
  };

  const sendError = (res, err) => {
    if (err instanceof ApiError) return send(res, err.status, err.toJSON());
    // An unexpected error is a bug: log the detail, tell the caller nothing.
    console.error('[gateway] unhandled', err);
    return send(res, 500, { error: { code: 'internal', message: 'Something broke on our side.' } });
  };

  const readBody = (req) => new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_JSON_BYTES) {
        reject(badRequest(`Request body exceeds ${MAX_JSON_BYTES} bytes.`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });

  const handleRequest = async (req, res) => {
    // Outside the try below, and it has to stay inside one: this is the first
    // thing that touches attacker-controlled input, and new URL() throws on a
    // path the parser will happily deliver. A request for "//" took the whole
    // process down - one unhandled TypeError, every viewer disconnected.
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify({ error: { code: 'bad_request', message: 'Malformed request URL.' } }));
    }
    const path = url.pathname;

    res.setHeader('access-control-allow-origin', corsOrigin);
    res.setHeader('vary', 'origin');
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization,last-event-id',
        'access-control-max-age': '600',
      });
      return res.end();
    }

    try {
      if (path === '/health' || path === '/api/health') {
        return send(res, 200, {
          ok: true,
          contractVersion: CONTRACT_VERSION,
          services: SERVICES,
          catalogChecksum: app.services.catalog.checksum,
          uptimeMs: process.uptime() * 1000,
        });
      }

      // Uploaded video. Range-aware, and the only route that reads the uploads
      // directory.
      if (path.startsWith('/media/')) {
        const absolute = safeResolve(uploadsRoot, path.slice('/media'.length));
        if (serveFile(req, res, absolute, { cache: 'public, max-age=86400' })) return;
        return send(res, 404, { error: { code: 'not_found', message: 'No such media.' } });
      }

      if (path.startsWith(API_PREFIX)) return await handleApi(req, res, url, path.slice(API_PREFIX.length));

      // Everything else is the frontend.
      const rel = path === '/' ? '/index.html' : path;
      const absolute = safeResolve(staticRoot, rel);
      if (serveFile(req, res, absolute, { cache: 'no-cache' })) return;
      return send(res, 404, { error: { code: 'not_found', message: `No route for ${path}` } });
    } catch (err) {
      return sendError(res, err);
    }
  };

  async function handleApi(req, res, url, apiPath) {
    const { route, pathExists, allowed } = ownerOf(req.method, apiPath);
    if (!route) {
      // A known path with an unsupported method is a 405, and answering it
      // before touching auth keeps the two failures from being confused.
      if (pathExists) {
        throw new ApiError(405, 'method_not_allowed',
          `${req.method} is not allowed on ${apiPath}. Try: ${allowed.join(', ')}.`);
      }
      throw notFound(`No route for ${req.method} ${apiPath}`);
    }

    // --- session ---------------------------------------------------------
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : (url.searchParams.get('token') || null);
    const auth = await app.services.identity.authenticate(token);

    const level = route.auth;
    if ((level === 'required' || level === 'admin' || level === 'creator') && !auth) throw unauthorized();
    // The role gates live here, once, rather than in the handlers. Admins pass
    // the creator gate too: the back office can act on a channel's behalf.
    if (level === 'admin' && auth.role !== 'admin') throw forbidden('That is back-office only.');
    if (level === 'creator' && auth.role !== 'creator' && auth.role !== 'admin') {
      throw forbidden('That needs creator standing. Apply from the portal.');
    }

    // --- rate limit ------------------------------------------------------
    const router = app.routers[route.service];
    const hit = router.match(req.method, apiPath);
    if (hit?.route?.limit) {
      const who = auth?.userId || req.socket.remoteAddress || 'anon';
      limiter.check(`${route.service}:${route.path}:${who}`, hit.route.limit);
    }

    // --- streaming responses ---------------------------------------------
    //
    // Two shapes share the 'stream' flag and they are not interchangeable:
    //   { stream: fn }  an SSE subscription the gateway keeps open
    //   { file: {...} } a file to send, used by live broadcast segments
    // Dispatch first, then decide, so a file route never gets SSE headers.
    if (hit?.route?.stream) {
      const result = await dispatch(router, {
        method: req.method, path: apiPath, query: parseQuery(url.search),
        body: {}, auth, headers: req.headers,
      });

      if (result?.file) {
        // A live segment is immutable once written and named by sequence, so it
        // caches hard; the manifest is what changes.
        return serveFile(req, res, result.file.absolute, { cache: 'public, max-age=31536000, immutable' })
          || send(res, 404, { error: { code: 'not_found', message: 'Segment gone.' } });
      }

      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write(': connected\n\n');
      const unsubscribe = result.stream((frame) => res.write(frame));
      const beat = setInterval(() => res.write(': keepalive\n\n'), 25_000);
      req.on('close', () => { clearInterval(beat); unsubscribe(); });
      return;
    }

    // --- body ------------------------------------------------------------
    // Uploads bypass buffering entirely: the request stream goes to disk.
    const raw = hit?.route?.raw
      ? { stream: req, contentType: req.headers['content-type'], contentLength: req.headers['content-length'] ?? null }
      : null;
    const body = raw ? {} : parseJsonBody(
      ['POST', 'PUT', 'DELETE'].includes(req.method) ? await readBody(req) : '',
    );

    const result = await dispatch(router, {
      method: req.method, path: apiPath, query: parseQuery(url.search),
      body, raw, auth, headers: req.headers,
    });
    return send(res, result.status ?? 200, result.body ?? null, result.headers);
  }

  const server = createServer(handleRequest);

  return { server, app, limiter };
}

// --- standalone entrypoint ------------------------------------------------
const isMain = process.argv[1] && process.argv[1].endsWith('server.mjs');
if (isMain) {
  const port = Number(process.env.PORT || 4173);
  // Top-level await: the process must not listen until every migration has run.
  const { server, app } = await createGateway({
    adminEmails: (process.env.NEUTV_ADMIN_EMAILS || '').split(',').map((s) => s.trim()).filter(Boolean),
    // Where anything that has to survive a restart is written: live broadcast
    // segments, and uploaded video when the media driver is local. In a
    // container that is a mounted volume, because the image's own filesystem
    // goes away with the container and takes the broadcast with it.
    ...(process.env.NEUTV_DATA_DIR ? { dataDir: process.env.NEUTV_DATA_DIR } : {}),
  });

  // Sessions expire by timestamp, so this sweep is housekeeping, not
  // correctness: an unswept row is already treated as expired on read.
  const sweep = setInterval(() => app.services.identity.purgeExpiredSessions(), 60 * 60 * 1000);
  sweep.unref();

  server.listen(port, () => {
    console.log(`NEU TV gateway on http://localhost:${port}`);
    console.log(`  contract   ${CONTRACT_VERSION}  |  catalog ${app.services.catalog.checksum}`);
    console.log(`  services   ${SERVICES.join(', ')}`);
    console.log(`  database   ${process.env.DATABASE_URL ? 'postgres' : 'sqlite (per service)'}`);
    console.log(`  media      ${(process.env.NEUTV_MEDIA_DRIVER || 'local')}${process.env.NEUTV_MEDIA_BASE_URL ? ` -> ${process.env.NEUTV_MEDIA_BASE_URL}` : ''}`);
    console.log(`  frontend   ${FRONTEND_ROOT}`);
    console.log(`  admins     ${process.env.NEUTV_ADMIN_EMAILS || '(none set - export NEUTV_ADMIN_EMAILS to enable the back office)'}`);
  });

  const shutdown = async () => { server.close(); await app.close(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
