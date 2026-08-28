// Platform glue: the pieces every service depends on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../../../platform/validate.mjs';
import { createRouter, dispatch, parseJsonBody, parseQuery } from '../../../platform/http.mjs';
import { createLimiter } from '../../../platform/ratelimit.mjs';
import { createHub } from '../../../platform/sse.mjs';
import { openStore } from '../../../platform/store.mjs';
import { fakeRuntime } from '../../../platform/runtime.mjs';

test('the validator trims, defaults, and reports every problem at once', () => {
  assert.deepEqual(validate({ a: '  hi  ' }, { a: { type: 'string', required: true } }), { a: 'hi' });
  assert.deepEqual(validate({}, { a: { type: 'string', default: 'fallback' } }), { a: 'fallback' });
  try {
    validate({ b: 'x' }, { a: { type: 'string', required: true }, b: { type: 'int', required: true } });
    assert.fail('should have thrown');
  } catch (err) {
    assert.equal(err.status, 400);
    assert.equal(err.details.length, 2, 'both problems reported, not just the first');
  }
});

test('the validator drops fields the spec does not declare', () => {
  const out = validate({ a: 'keep', isAdmin: true, role: 'admin' }, { a: { type: 'string' } });
  assert.deepEqual(out, { a: 'keep' }, 'mass assignment is impossible by construction');
});

test('the validator enforces enums, bounds and patterns', () => {
  assert.throws(() => validate({ a: 'nope' }, { a: { type: 'string', enum: ['x'] } }), (e) => e.status === 400);
  assert.throws(() => validate({ a: 5 }, { a: { type: 'int', max: 3 } }), (e) => e.status === 400);
  assert.throws(() => validate({ a: 1.5 }, { a: { type: 'int' } }), (e) => e.status === 400);
  assert.throws(() => validate({ a: 'ab' }, { a: { type: 'string', min: 3 } }), (e) => e.status === 400);
  assert.throws(() => validate({ a: 'x' }, { a: { type: 'string', pattern: /^\d+$/ } }), (e) => e.status === 400);
  assert.throws(() => validate(null, { a: { type: 'string' } }), (e) => e.status === 400);
  assert.throws(() => validate([], { a: { type: 'string' } }), (e) => e.status === 400);
});

test('the router matches params and separates a bad method from a bad path', async () => {
  const r = createRouter('t');
  r.get('/a/:id/b', (req) => ({ status: 200, body: { id: req.params.id } }));
  assert.deepEqual((await dispatch(r, { method: 'GET', path: '/a/42/b' })).body, { id: '42' });
  await assert.rejects(() => dispatch(r, { method: 'POST', path: '/a/42/b' }), (e) => e.status === 405);
  await assert.rejects(() => dispatch(r, { method: 'GET', path: '/nope' }), (e) => e.status === 404);
});

test('the router decodes path params', async () => {
  const r = createRouter('t');
  r.get('/f/:handle', (req) => ({ status: 200, body: { h: req.params.handle } }));
  assert.deepEqual((await dispatch(r, { method: 'GET', path: '/f/%40neutv' })).body, { h: '@neutv' });
});

test('body parsing rejects anything that is not a JSON object', () => {
  assert.deepEqual(parseJsonBody(''), {});
  assert.deepEqual(parseJsonBody('{"a":1}'), { a: 1 });
  assert.throws(() => parseJsonBody('[1,2]'), (e) => e.status === 400);
  assert.throws(() => parseJsonBody('"str"'), (e) => e.status === 400);
  assert.throws(() => parseJsonBody('{broken'), (e) => e.status === 400);
  assert.deepEqual(parseQuery('?a=1&b=two'), { a: '1', b: 'two' });
});

test('the rate limiter is exact at its boundary and resets on the clock', () => {
  const runtime = fakeRuntime();
  const limiter = createLimiter(runtime);
  const budget = { tokens: 3, windowMs: 60_000 };
  for (let i = 0; i < 3; i++) limiter.check('k', budget);
  assert.throws(() => limiter.check('k', budget), (e) => e.status === 429);
  runtime.advance(59_999);
  assert.throws(() => limiter.check('k', budget), (e) => e.status === 429, 'still inside the window');
  runtime.advance(2);
  assert.doesNotThrow(() => limiter.check('k', budget), 'window rolled over');
});

test('rate limit buckets do not bleed between callers', () => {
  const limiter = createLimiter(fakeRuntime());
  const budget = { tokens: 1, windowMs: 1000 };
  limiter.check('user-a', budget);
  assert.doesNotThrow(() => limiter.check('user-b', budget));
});

test('the SSE hub fans out, filters by topic, and drops dead clients', () => {
  const hub = createHub(fakeRuntime());
  const a = []; const b = [];
  hub.subscribe((f) => a.push(f));
  hub.subscribe((f) => b.push(f), { topics: ['gift'] });
  hub.publish('comment', { text: 'hi' });
  hub.publish('gift', { gift: 'crown' });
  assert.equal(a.length, 2, 'the wildcard subscriber sees everything');
  assert.equal(b.length, 1, 'the filtered subscriber only sees its topic');
  assert.ok(b[0].includes('event: gift'));

  hub.subscribe(() => { throw new Error('socket died'); });
  assert.equal(hub.clientCount(), 3);
  hub.publish('comment', { text: 'again' });
  assert.equal(hub.clientCount(), 2, 'a broken socket is dropped, not retried forever');
});

test('the SSE hub replays what a reconnecting client missed', () => {
  const hub = createHub(fakeRuntime());
  const first = hub.publish('comment', { n: 1 });
  hub.publish('comment', { n: 2 });
  hub.publish('comment', { n: 3 });
  const replayed = [];
  hub.subscribe((f) => replayed.push(f), { lastEventId: first.id });
  assert.equal(replayed.length, 2, 'events 2 and 3, not 1 again');
});

test('an unsubscribe actually stops delivery', () => {
  const hub = createHub(fakeRuntime());
  const seen = [];
  const off = hub.subscribe((f) => seen.push(f));
  hub.publish('x', {});
  off();
  hub.publish('x', {});
  assert.equal(seen.length, 1);
});

test('migrations run once and roll back as a unit on failure', () => {
  const store = openStore(':memory:', { '001': 'CREATE TABLE t (id TEXT PRIMARY KEY)' });
  store.run('INSERT INTO t VALUES (?)', 'a');
  assert.equal(store.all('SELECT * FROM t').length, 1);
  assert.throws(() => openStore(':memory:', { '001': 'CREATE TABLE ok (a)', '002': 'THIS IS NOT SQL' }), /Migration 002 failed/);
});

test('a failed transaction leaves nothing behind', () => {
  const store = openStore(':memory:', { '001': 'CREATE TABLE t (id TEXT PRIMARY KEY)' });
  assert.throws(() => store.tx(() => {
    store.run('INSERT INTO t VALUES (?)', 'a');
    throw new Error('boom');
  }));
  assert.equal(store.all('SELECT * FROM t').length, 0);
});
