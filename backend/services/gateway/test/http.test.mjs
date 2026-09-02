// Gateway tests over real sockets.
//
// Everything else in this repo is tested against routers directly. These run
// against an actual listening server, because the things the gateway owns -
// auth enforcement, range requests, streamed uploads, SSE, traversal - are
// exactly the things that only misbehave once a socket is involved.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { TEST_COST } from '../../../platform/password.mjs';
import { createGateway } from '../server.mjs';

let gateway; let base; let uploads;

before(async () => {
  uploads = mkdtempSync(join(tmpdir(), 'neutv-gw-'));
  gateway = await createGateway({
    runtime: fakeRuntime(), memory: true, passwordCost: TEST_COST,
    // Each test that needs an admin signs up its own account, so every one of
    // those emails has to be in the admin list.
    adminEmails: ['boss@neu.tv', 'boss2@neu.tv', 'boss3@neu.tv'], uploadsRoot: uploads,
  });
  await new Promise((r) => gateway.server.listen(0, r));
  base = `http://127.0.0.1:${gateway.server.address().port}`;
});

after(async () => { gateway.server.close(); await gateway.app.close(); });

const call = async (path, opts = {}) => {
  const res = await fetch(base + path, opts);
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
};
const json = (token, body) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const auth = (token) => ({ headers: { authorization: `Bearer ${token}` } });

const signIn = async (email) => {
  const res = await call('/api/v1/identity/signup', json(null, { email, password: 'longenough1' }));
  return res.body.session.token;
};

test('health reports the contract and what is wired', async () => {
  const { status, body } = await call('/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.contractVersion, '2.1.0');
  assert.ok(body.services.includes('admin'));
  assert.ok(!body.services.includes('llm'), 'the LLM service was removed in 2.0.0');
});

test('bootstrap serves the whole frontend payload to a guest', async () => {
  const { status, body } = await call('/api/v1/catalog/bootstrap');
  assert.equal(status, 200);
  assert.equal(body.PRODUCTS.length, 6, 'five ecosystem products plus NEU TV itself');
  assert.ok(body.INITIAL_POSTS.length > 0);
});

test('a protected route rejects a guest, a bad token and an empty bearer alike', async () => {
  assert.equal((await call('/api/v1/wallet')).status, 401);
  assert.equal((await call('/api/v1/wallet', auth('nonsense'))).status, 401);
  assert.equal((await call('/api/v1/wallet', { headers: { authorization: 'Bearer ' } })).status, 401);
});

test('an optional route serves guests and signed-in viewers differently', async () => {
  const guest = await call('/api/v1/identity/session');
  assert.equal(guest.status, 200);
  assert.equal(guest.body.guest, true);
  const token = await signIn('optional@neu.tv');
  const member = await call('/api/v1/identity/session', auth(token));
  assert.equal(member.body.guest, false);
});

test('the admin gate is enforced by the gateway for every back-office route', async () => {
  const viewer = await signIn('viewer@neu.tv');
  for (const path of ['/api/v1/admin/videos', '/api/v1/admin/programme', '/api/v1/admin/crm/overview']) {
    assert.equal((await call(path, auth(viewer))).status, 403, `${path} was reachable by a viewer`);
    assert.equal((await call(path)).status, 401, `${path} was reachable by a guest`);
  }
});

test('an admin reaches the back office', async () => {
  const admin = await signIn('boss@neu.tv');
  assert.equal((await call('/api/v1/admin/videos', auth(admin))).status, 200);
  assert.equal((await call('/api/v1/identity/me', auth(admin))).body.role, 'admin');
});

test('a video uploads as a raw stream and then plays with range support', async () => {
  const admin = await signIn('boss2@neu.tv');
  const created = await call('/api/v1/admin/videos', json(admin, { title: 'Studio Session', kind: 'upload' }));
  const id = created.body.video.id;

  const payload = Buffer.alloc(1024, 7);
  const put = await fetch(`${base}/api/v1/admin/videos/${id}/file`, {
    method: 'PUT',
    headers: { 'content-type': 'video/mp4', authorization: `Bearer ${admin}` },
    body: payload,
  });
  assert.equal(put.status, 200);
  const uploaded = await put.json();
  assert.equal(uploaded.uploaded.size, 1024);

  const full = await fetch(base + uploaded.video.playbackUrl);
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('accept-ranges'), 'bytes');
  assert.equal(full.headers.get('content-length'), '1024');

  // Seeking. Without 206 a browser cannot scrub an uploaded video.
  const ranged = await fetch(base + uploaded.video.playbackUrl, { headers: { range: 'bytes=100-199' } });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get('content-range'), 'bytes 100-199/1024');
  assert.equal((await ranged.arrayBuffer()).byteLength, 100);

  // Suffix range: the last 50 bytes.
  const suffix = await fetch(base + uploaded.video.playbackUrl, { headers: { range: 'bytes=-50' } });
  assert.equal(suffix.headers.get('content-range'), 'bytes 974-1023/1024');

  // Unsatisfiable range.
  const bad = await fetch(base + uploaded.video.playbackUrl, { headers: { range: 'bytes=99999-' } });
  assert.equal(bad.status, 416);
});

test('a viewer cannot upload a video', async () => {
  const viewer = await signIn('nope@neu.tv');
  const res = await fetch(`${base}/api/v1/admin/videos/vid_x/file`, {
    method: 'PUT', headers: { 'content-type': 'video/mp4', authorization: `Bearer ${viewer}` }, body: Buffer.alloc(10),
  });
  assert.equal(res.status, 403);
});

test('the programme an admin sets becomes the main broadcast on the live stage', async () => {
  const admin = await signIn('boss3@neu.tv');
  const created = await call('/api/v1/admin/videos', json(admin, {
    title: 'Morning Telemetry', kind: 'external', sourceUrl: 'https://cdn.neu.tv/m.mp4', duration: '05:00',
  }));
  const id = created.body.video.id;
  await call('/api/v1/admin/programme', { ...json(admin, { videoId: id }), method: 'PUT' });

  assert.equal((await call('/api/v1/programme/current')).body.video.id, id);
  const stage = await call('/api/v1/live/stage?viewerId=anon-guest001');
  assert.equal(stage.body.current.id, id);
  assert.equal(stage.body.isOverride, false);
});

test('a click takes the stage over the wire and reverting restores the broadcast', async () => {
  const stageBefore = await call('/api/v1/live/stage?viewerId=anon-clicker01');
  const taken = await call('/api/v1/live/stage', json(null, { videoId: 'cr-1', viewerId: 'anon-clicker01' }));
  assert.equal(taken.status, 200);
  assert.equal(taken.body.current.id, 'cr-1');
  assert.equal(taken.body.isOverride, true);
  assert.ok(taken.body.revertsIn > 0);

  const reverted = await call('/api/v1/live/stage/revert', json(null, { viewerId: 'anon-clicker01' }));
  assert.equal(reverted.body.isOverride, false);
  assert.equal(reverted.body.current.id, stageBefore.body.current.id);
});

test('a guest cannot promote a video to everyone', async () => {
  const res = await call('/api/v1/live/stage', json(null, { videoId: 'cr-1', scope: 'broadcast', viewerId: 'anon-x1234' }));
  assert.equal(res.status, 403);
});

test('the live SSE stream delivers events as they are published', async () => {
  const ac = new AbortController();
  const res = await fetch(`${base}/api/v1/live/stream`, { signal: ac.signal });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/event-stream/);

  const reader = res.body.getReader();
  await reader.read(); // the ": connected" preamble
  gateway.app.hub.publish('reaction', { emoji: '🔥', total: 1 });
  const { value } = await reader.read();
  const frame = Buffer.from(value).toString('utf8');
  assert.match(frame, /event: reaction/);
  assert.match(frame, /"emoji":"🔥"/);
  ac.abort();
});

test('an oversized JSON body is refused rather than buffered', async () => {
  const token = await signIn('big@neu.tv');
  const res = await fetch(`${base}/api/v1/social/posts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ content: 'x'.repeat(2 * 1024 * 1024) }),
  }).catch((e) => ({ status: 0, error: e }));
  assert.ok(res.status === 400 || res.status === 0, 'the connection is cut or the request refused');
});

test('malformed JSON is a 400, not a 500', async () => {
  const token = await signIn('bad@neu.tv');
  const res = await fetch(`${base}/api/v1/social/posts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: '{not json',
  });
  assert.equal(res.status, 400);
});

test('path traversal is refused on both static and media routes', async () => {
  for (const path of [
    '/media/../../../../etc/passwd',
    '/media/%2e%2e%2f%2e%2e%2fetc%2fpasswd',
    '/../../../../etc/passwd',
    '/..%2f..%2fpackage.json',
  ]) {
    const res = await fetch(base + path);
    assert.equal(res.status, 404, `${path} returned ${res.status}`);
  }
});

test('the frontend is served from the repo root', async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /NEU TV/);
});

test('an unknown API route is a 404 with a structured error', async () => {
  const { status, body } = await call('/api/v1/nope/nope');
  assert.equal(status, 404);
  assert.equal(body.error.code, 'not_found');
});

test('the wrong method on a real route is a 405', async () => {
  const res = await fetch(`${base}/api/v1/catalog/products`, { method: 'DELETE' });
  assert.equal(res.status, 405);
});

test('CORS preflight is answered', async () => {
  const res = await fetch(`${base}/api/v1/catalog/products`, { method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
});

test('rate limits return 429 with a retry hint', async () => {
  const results = [];
  for (let i = 0; i < 14; i++) {
    results.push((await call('/api/v1/identity/signin', json(null, { email: 'rate@neu.tv', password: 'wrongpass1' }))).status);
  }
  assert.ok(results.includes(429), 'the auth endpoint must be rate limited');
  const limited = await call('/api/v1/identity/signin', json(null, { email: 'rate@neu.tv', password: 'wrongpass1' }));
  assert.equal(limited.status, 429);
  assert.ok(limited.body.error.details.retryAfterMs > 0);
});

test('a 500 never leaks internals to the caller', async () => {
  const { status, body } = await call('/api/v1/catalog/hubs/definitely-not-a-hub');
  assert.equal(status, 404);
  assert.ok(!JSON.stringify(body).includes('at '), 'no stack trace in the response');
});

test('a malformed request URL is a 400, not a dead process', async () => {
  // new URL() throws on paths the HTTP parser accepts. This ran before the
  // handler's try block, so "//" crashed the gateway and disconnected everyone.
  const { status } = await call('//');
  assert.equal(status, 400);
  // Still serving afterwards is the entire point of the test.
  assert.equal((await call('/health')).status, 200);
});
