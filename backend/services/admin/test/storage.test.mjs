import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createS3Storage } from '../storage/s3.mjs';
import { createMediaStorage, mediaBaseFor } from '../storage/index.mjs';

const s3For = (capture, over = {}) => createS3Storage({
  endpoint: 'https://acct.r2.cloudflarestorage.com',
  bucket: 'neutv',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secretexample',
  clock: () => new Date('2026-08-28T12:00:00Z'),
  fetchImpl: async (url, init) => {
    capture.url = url.toString(); capture.init = init;
    return { ok: true, status: 200, headers: new Map(), text: async () => '' };
  },
  ...over,
});

test('an upload is signed with SigV4 and addressed by video id', async () => {
  const capture = {};
  const res = await s3For(capture).save('vid_abc123', 'video/mp4', 'BYTES', { declaredLength: 1024 });
  assert.equal(res.path, 'videos/vid_abc123.mp4');
  assert.equal(capture.url, 'https://acct.r2.cloudflarestorage.com/neutv/videos/vid_abc123.mp4');
  assert.match(capture.init.headers.authorization, /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20260828\/auto\/s3\/aws4_request/);
  assert.equal(capture.init.headers['x-amz-content-sha256'], 'UNSIGNED-PAYLOAD');
  assert.equal(capture.init.headers['content-type'], 'video/mp4');
});

test('the signature is deterministic and covers the request', async () => {
  const a = {}; const b = {}; const c = {};
  await s3For(a).save('vid_abc123', 'video/mp4', 'X', { declaredLength: 1024 });
  await s3For(b).save('vid_abc123', 'video/mp4', 'X', { declaredLength: 1024 });
  await s3For(c).save('vid_different', 'video/mp4', 'X', { declaredLength: 1024 });
  assert.equal(a.init.headers.authorization, b.init.headers.authorization, 'same request, same signature');
  assert.notEqual(a.init.headers.authorization, c.init.headers.authorization, 'a different key must re-sign');
});

test('object storage needs a length rather than buffering the video to find one', async () => {
  await assert.rejects(
    () => s3For({}).save('vid_abc', 'video/mp4', 'X'),
    (e) => e.status === 400 && /Content-Length/.test(e.message),
  );
});

test('the type allowlist and size cap apply to the CDN driver too', async () => {
  await assert.rejects(() => s3For({}).save('vid_abc', 'application/zip', 'X', { declaredLength: 10 }), (e) => e.status === 400);
  await assert.rejects(
    () => s3For({}, { maxBytes: 100 }).save('vid_abc', 'video/mp4', 'X', { declaredLength: 500 }),
    (e) => e.status === 400,
  );
});

test('a filename cannot escape the prefix', async () => {
  await assert.rejects(() => s3For({}).save('../../etc/passwd', 'video/mp4', 'X', { declaredLength: 10 }), (e) => e.status === 400);
});

test('an upstream refusal surfaces as unavailable, not as success', async () => {
  const storage = createS3Storage({
    endpoint: 'https://acct.r2.cloudflarestorage.com', bucket: 'neutv',
    accessKeyId: 'k', secretAccessKey: 's',
    fetchImpl: async () => ({ ok: false, status: 403, text: async () => 'AccessDenied' }),
  });
  await assert.rejects(
    () => storage.save('vid_abc', 'video/mp4', 'X', { declaredLength: 10 }),
    (e) => e.status === 503,
  );
});

test('local is the default, so a checkout works with no credentials', () => {
  const storage = createMediaStorage({}, { uploadsRoot: '/tmp/neutv-test-uploads' });
  assert.equal(storage.driver, 'local');
  assert.equal(mediaBaseFor({}), '/media');
});

test('selecting s3 without credentials fails loudly at boot, not at upload', () => {
  assert.throws(
    () => createMediaStorage({ NEUTV_MEDIA_DRIVER: 's3', NEUTV_S3_BUCKET: 'b' }, {}),
    /NEUTV_S3_ENDPOINT/,
  );
});

test('a CDN hostname replaces the gateway media route', () => {
  assert.equal(mediaBaseFor({ NEUTV_MEDIA_BASE_URL: 'https://cdn.neu.tv/' }), 'https://cdn.neu.tv');
});
