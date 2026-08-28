// Service-to-service client.
//
// Services never import each other's internals. They call this, addressing a
// peer by contract path. Two transports, one call signature:
//   - loopback: single-process deployment, dispatches straight into the peer's
//     router. Same request/response shape as the wire, so behaviour is identical.
//   - http:     each service running as its own deploy unit on its own port.
//
// Swapping transports is a config change, never a code change in a handler.

import { dispatch } from '../platform/http.mjs';
import { ApiError, unavailable, notFound } from '../platform/errors.mjs';
import { API_PREFIX } from './version.mjs';
import { ROUTES } from './manifest.mjs';

const matchesPattern = (pattern, parts) => {
  const segments = pattern.split('/').filter(Boolean);
  if (segments.length !== parts.length) return false;
  return segments.every((s, i) => s.startsWith(':') || s === parts[i]);
};

// A call to an undeclared path is a contract violation and fails here, at the
// caller, rather than as a confusing 404 from the peer.
const assertDeclared = (method, path) => {
  const parts = path.split('/').filter(Boolean);
  const hit = ROUTES.find((r) => r.method === method && matchesPattern(r.path, parts));
  if (!hit) throw notFound(`${method} ${path} is not in the contract.`);
  return hit;
};

export function loopbackClient(registry) {
  return {
    transport: 'loopback',
    async call(service, method, path, { body = null, query = {}, auth = null, headers = {} } = {}) {
      assertDeclared(method, path);
      const router = registry[service];
      if (!router) throw unavailable(`Service "${service}" is not mounted.`);
      try {
        const res = await dispatch(router, { method, path, query, body, auth, headers });
        return { status: res.status ?? 200, body: res.body ?? null };
      } catch (err) {
        // Peer failures cross the boundary as data, exactly as they would over
        // HTTP, so a caller cannot accidentally catch a peer's stack trace.
        if (err instanceof ApiError) return { status: err.status, body: err.toJSON() };
        throw err;
      }
    },
  };
}

export function httpClient(baseUrls, { fetchImpl = globalThis.fetch, timeoutMs = 5000 } = {}) {
  return {
    transport: 'http',
    async call(service, method, path, { body = null, query = {}, auth = null, headers = {} } = {}) {
      assertDeclared(method, path);
      const base = baseUrls[service];
      if (!base) throw unavailable(`No base URL configured for "${service}".`);
      const url = new URL(base.replace(/\/$/, '') + API_PREFIX + path);
      for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, {
          method,
          signal: ac.signal,
          headers: {
            'content-type': 'application/json',
            ...(auth?.token ? { authorization: `Bearer ${auth.token}` } : {}),
            ...headers,
          },
          body: body === null ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        return { status: res.status, body: text ? JSON.parse(text) : null };
      } catch (err) {
        throw unavailable(`Call to ${service} failed: ${err.message}`);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
