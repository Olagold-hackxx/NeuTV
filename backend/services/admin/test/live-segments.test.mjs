import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { openAdminStore } from '../store.mjs';
import { createLiveSegments } from '../live-segments.mjs';

const EVENT = 'evt_broadcast1';
const bytes = (n, fill = 7) => Readable.from([Buffer.alloc(n, fill)]);

// Segments are only accepted for a browser event that is on air, so every
// harness needs a row to broadcast into.
const putEvent = (store, { id = EVENT, status = 'live', source = 'browser' } = {}) => store.run(
  `INSERT INTO live_events (id, title, description, product_id, status, source, driver,
                            stream_key, created_by, created_at, updated_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  id, 'Broadcast', '', 'worldstreet', status, source, 'manual', 'key', 'admin-1', 0, 0,
);

const build = async (over = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'neutv-segments-'));
  const store = await testStore(openAdminStore);
  await putEvent(store);
  const segments = createLiveSegments({
    runtime: fakeRuntime(), store, root, ...over,
  });
  return { segments, root, store };
};

test('the first chunk is the init segment and gets sequence 0', async () => {
  const { segments } = await build();
  const res = await segments.append(EVENT, { stream: bytes(512), contentType: 'video/webm', contentLength: 512, init: true });
  assert.equal(res.seq, 0);
  assert.equal(res.init, true);
  assert.equal(res.bytes, 512);
});

test('media segments follow in order', async () => {
  const { segments } = await build();
  await segments.append(EVENT, { stream: bytes(64), contentType: 'video/webm', init: true });
  assert.equal((await segments.append(EVENT, { stream: bytes(64), contentType: 'video/webm' })).seq, 1);
  assert.equal((await segments.append(EVENT, { stream: bytes(64), contentType: 'video/webm' })).seq, 2);
  const manifest = await segments.manifest(EVENT);
  assert.deepEqual(manifest.segments.map((s) => s.seq), [0, 1, 2]);
  assert.equal(manifest.head, 2);
});

test('a broadcast cannot have two init segments', async () => {
  const { segments } = await build();
  await segments.append(EVENT, { stream: bytes(64), contentType: 'video/webm', init: true });
  await assert.rejects(
    () => segments.append(EVENT, { stream: bytes(64), contentType: 'video/webm', init: true }),
    (e) => e.status === 409,
  );
});

test('a player already watching asks only for what is new', async () => {
  const { segments } = await build();
  await segments.append(EVENT, { stream: bytes(32), contentType: 'video/webm', init: true });
  for (let i = 0; i < 4; i++) await segments.append(EVENT, { stream: bytes(32), contentType: 'video/webm' });
  const fresh = await segments.manifest(EVENT, { after: 2 });
  assert.deepEqual(fresh.segments.map((s) => s.seq), [3, 4]);
});

test('the window rolls, and the init segment is never evicted', async () => {
  // A player joining an hour into a broadcast still needs the header to decode
  // anything, so seq 0 has to survive every eviction pass.
  const { segments, root } = await build({ window: 3 });
  await segments.append(EVENT, { stream: bytes(16), contentType: 'video/webm', init: true });
  for (let i = 0; i < 8; i++) await segments.append(EVENT, { stream: bytes(16), contentType: 'video/webm' });

  const manifest = await segments.manifest(EVENT);
  const seqs = manifest.segments.map((s) => s.seq);
  assert.ok(seqs.includes(0), 'the init segment survived');
  assert.ok(seqs.length <= 5, `window held: ${seqs.join(',')}`);
  assert.equal(manifest.head, 8);
  assert.ok(existsSync(join(root, EVENT, '0.webm')), 'and its file is still on disk');
  assert.ok(!existsSync(join(root, EVENT, '1.webm')), 'while an evicted one is gone');
});

test('an evicted segment reports gone rather than serving nothing', async () => {
  const { segments } = await build({ window: 2 });
  await segments.append(EVENT, { stream: bytes(16), contentType: 'video/webm', init: true });
  for (let i = 0; i < 6; i++) await segments.append(EVENT, { stream: bytes(16), contentType: 'video/webm' });
  await assert.rejects(() => segments.locate(EVENT, 1), (e) => e.status === 404);
  const live = await segments.locate(EVENT, 6);
  assert.ok(live.absolute.endsWith('6.webm'));
});

test('only recordable video types are accepted', async () => {
  const { segments } = await build();
  await assert.rejects(
    () => segments.append(EVENT, { stream: bytes(16), contentType: 'application/zip' }),
    (e) => e.status === 400,
  );
});

test('an oversized or empty chunk is refused and leaves nothing behind', async () => {
  const { segments, root } = await build({ maxSegmentBytes: 100 });
  await assert.rejects(
    () => segments.append(EVENT, { stream: bytes(500), contentType: 'video/webm' }),
    (e) => e.status === 400,
  );
  await assert.rejects(
    () => segments.append(EVENT, { stream: Readable.from([]), contentType: 'video/webm' }),
    (e) => e.status === 400,
  );
  assert.ok(!existsSync(join(root, EVENT, '1.webm')), 'no partial file survives a refusal');
});

test('a lying Content-Length does not get past the byte meter', async () => {
  const { segments } = await build({ maxSegmentBytes: 100 });
  await assert.rejects(
    () => segments.append(EVENT, { stream: bytes(500), contentType: 'video/webm', contentLength: '10' }),
    (e) => e.status === 400,
  );
});

test('an event id cannot escape the segment root', async () => {
  const { segments } = await build();
  await assert.rejects(
    () => segments.append('../../etc', { stream: bytes(16), contentType: 'video/webm' }),
    (e) => e.status === 400,
  );
});

test('two broadcasts do not see each other', async () => {
  const { segments, store } = await build();
  await putEvent(store, { id: 'evt_a' });
  await putEvent(store, { id: 'evt_b' });
  await segments.append('evt_a', { stream: bytes(16), contentType: 'video/webm', init: true });
  await segments.append('evt_b', { stream: bytes(16), contentType: 'video/webm', init: true });
  await segments.append('evt_a', { stream: bytes(16), contentType: 'video/webm' });
  assert.equal((await segments.manifest('evt_a')).head, 1);
  assert.equal((await segments.manifest('evt_b')).head, 0);
});

test('purging a finished broadcast removes the index and the files', async () => {
  const { segments, root } = await build();
  await segments.append(EVENT, { stream: bytes(16), contentType: 'video/webm', init: true });
  await segments.append(EVENT, { stream: bytes(16), contentType: 'video/webm' });
  const res = await segments.purge(EVENT);
  assert.equal(res.purged, 2);
  assert.equal((await segments.manifest(EVENT)).segments.length, 0);
  assert.ok(!existsSync(join(root, EVENT)));
});


// --- who may broadcast into an event ---------------------------------------

test('an event that is not on air refuses segments', async () => {
  const { segments, store } = await build();
  await store.run("UPDATE live_events SET status = 'scheduled' WHERE id = ?", EVENT);
  // The studio used to record happily into a scheduled event: megabytes of a
  // broadcast nobody could watch, and no error anywhere to say so.
  await assert.rejects(
    () => segments.append(EVENT, { stream: bytes(512), contentType: 'video/webm', contentLength: 512, init: true }),
    (e) => e.status === 409,
  );
});

test('an externally fed event refuses browser segments', async () => {
  const { segments, store } = await build();
  await store.run("UPDATE live_events SET source = 'external' WHERE id = ?", EVENT);
  await assert.rejects(
    () => segments.append(EVENT, { stream: bytes(512), contentType: 'video/webm', contentLength: 512, init: true }),
    (e) => e.status === 409,
  );
});

test('an unknown event is a 404, not a new directory on disk', async () => {
  const { segments } = await build();
  await assert.rejects(
    () => segments.append('evt_nosuchthing', { stream: bytes(512), contentType: 'video/webm', contentLength: 512, init: true }),
    (e) => e.status === 404,
  );
});
