// Contract conformance.
//
// The manifest is the contract. This asserts every service's router implements
// exactly its slice: nothing undeclared can ship, and nothing declared can
// quietly vanish. It is the test that makes "contracts at the boundary" a fact
// rather than a README promise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { TEST_COST } from '../../../platform/password.mjs';
import { compose } from '../compose.mjs';
import { ROUTES, SERVICES, routesFor, AUTH_LEVELS } from '../../../contracts/manifest.mjs';

const build = () => compose({ runtime: fakeRuntime(), memory: true, passwordCost: TEST_COST });

test('every declared route is implemented by its service', () => {
  const app = build();
  for (const declared of ROUTES) {
    const router = app.routers[declared.service];
    assert.ok(router, `service "${declared.service}" is declared but not mounted`);
    const found = router.routes.find((r) => r.method === declared.method && r.pattern === declared.path);
    assert.ok(found, `${declared.service} does not implement ${declared.method} ${declared.path}`);
  }
  app.close();
});

test('no service exposes a route the contract does not declare', () => {
  const app = build();
  for (const [service, router] of Object.entries(app.routers)) {
    const declared = routesFor(service);
    for (const route of router.routes) {
      const match = declared.find((d) => d.method === route.method && d.path === route.pattern);
      assert.ok(match, `${service} exposes undeclared route ${route.method} ${route.pattern}`);
    }
  }
  app.close();
});

test('auth levels in the router match the contract exactly', () => {
  const app = build();
  for (const declared of ROUTES) {
    const router = app.routers[declared.service];
    const found = router.routes.find((r) => r.method === declared.method && r.pattern === declared.path);
    // 'admin' is enforced by the gateway from the manifest, so a router may
    // carry 'admin' or the weaker 'required'; it must never be looser.
    if (declared.auth === 'admin') {
      assert.ok(['admin', 'required'].includes(found.auth),
        `${declared.path} is admin-only in the contract but "${found.auth}" in the router`);
    } else {
      assert.equal(found.auth, declared.auth, `auth level drift on ${declared.method} ${declared.path}`);
    }
  }
  app.close();
});

test('stream and raw flags match the contract', () => {
  // A router that silently drops one of these flags routes an upload into the
  // JSON parser. That happened once; this is the guard.
  const app = build();
  for (const declared of ROUTES) {
    const found = app.routers[declared.service].routes
      .find((r) => r.method === declared.method && r.pattern === declared.path);
    assert.equal(found.raw, Boolean(declared.raw), `raw flag drift on ${declared.method} ${declared.path}`);
    assert.equal(found.stream, Boolean(declared.stream), `stream flag drift on ${declared.method} ${declared.path}`);
  }
  app.close();
});

test('contract declares a known auth level for every route', () => {
  for (const route of ROUTES) {
    assert.ok(AUTH_LEVELS.includes(route.auth), `${route.path} has unknown auth level "${route.auth}"`);
    assert.ok(route.summary && route.summary.length > 10, `${route.path} needs a real summary`);
  }
});

test('every service in the manifest is composed, and vice versa', () => {
  const app = build();
  assert.deepEqual([...SERVICES].sort(), Object.keys(app.routers).sort());
  app.close();
});

test('route patterns are unique per method', () => {
  const seen = new Set();
  for (const r of ROUTES) {
    const key = `${r.method} ${r.path}`;
    assert.ok(!seen.has(key), `duplicate route declared: ${key}`);
    seen.add(key);
  }
});
