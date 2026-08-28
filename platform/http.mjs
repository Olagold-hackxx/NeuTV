// Transport-neutral router.
//
// A service handler takes a normalized request and returns a normalized
// response. It never touches a socket. That is what lets the gateway mount a
// service in-process AND lets another service call it over the loopback client
// with identical semantics, and it lets gate tests run with no ports open.

import { ApiError, notFound, badRequest } from './errors.mjs';

export function createRouter(name) {
  const routes = [];

  const add = (method, pattern, handler, opts = {}) => {
    const segments = pattern.split('/').filter(Boolean);
    routes.push({
      method,
      pattern,
      segments,
      handler,
      auth: opts.auth ?? 'optional', // 'required' | 'optional' | 'none' | 'admin'
      stream: opts.stream ?? false,  // SSE: the gateway owns the socket
      raw: opts.raw ?? false,        // body is a stream (uploads), not JSON
      limit: opts.limit ?? null,     // { tokens, windowMs }
    });
  };

  return {
    name,
    routes,
    get: (p, h, o) => add('GET', p, h, o),
    post: (p, h, o) => add('POST', p, h, o),
    put: (p, h, o) => add('PUT', p, h, o),
    del: (p, h, o) => add('DELETE', p, h, o),
    match(method, path) {
      const parts = path.split('/').filter(Boolean);
      let pathMatched = false;
      for (const route of routes) {
        if (route.segments.length !== parts.length) continue;
        const params = {};
        let ok = true;
        for (let i = 0; i < parts.length; i++) {
          const seg = route.segments[i];
          if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]);
          else if (seg !== parts[i]) { ok = false; break; }
        }
        if (!ok) continue;
        pathMatched = true;
        if (route.method !== method) continue;
        return { route, params };
      }
      return pathMatched ? { methodMismatch: true } : null;
    },
  };
}

export const ok = (body, headers) => ({ status: 200, body, headers });
export const created = (body, headers) => ({ status: 201, body, headers });
export const noContent = () => ({ status: 204, body: null });

// Runs one normalized request against a router. Shared by the gateway (real
// sockets), the loopback client (service to service), and every gate test.
export async function dispatch(router, req) {
  const hit = router.match(req.method, req.path);
  if (!hit) throw notFound(`No route for ${req.method} ${req.path}`);
  if (hit.methodMismatch) throw new ApiError(405, 'method_not_allowed', `${req.method} not allowed on ${req.path}`);
  const result = await hit.route.handler({ ...req, params: hit.params });
  return result ?? noContent();
}

export function parseQuery(search) {
  const out = {};
  for (const [k, v] of new URLSearchParams(search || '')) out[k] = v;
  return out;
}

export function parseJsonBody(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw badRequest('Request body must be a JSON object.');
    }
    return parsed;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw badRequest('Request body is not valid JSON.');
  }
}
