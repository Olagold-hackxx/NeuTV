import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createS3Storage } from '../storage/s3.mjs';
import { createCloudinaryStorage, signParams } from '../storage/cloudinary.mjs';
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

// --- Cloudinary -------------------------------------------------------------

const cloudinaryFetch = (capture, reply) => async (url, init) => {
  capture.url = String(url);
  capture.init = init;
  // Drain the streamed multipart body so the test sees what was really sent.
  const chunks = [];
  if (init?.body) for await (const c of init.body) chunks.push(Buffer.from(c));
  capture.body = Buffer.concat(chunks);
  return reply ?? {
    ok: true, status: 200,
    text: async () => JSON.stringify({ public_id: 'videos/vid_x', format: 'mp4', bytes: 2048 }),
  };
};

test('a Cloudinary upload is signed and streamed as multipart', async () => {
  const capture = {};
  const storage = createCloudinaryStorage({
    cloudName: 'neutv', apiKey: 'key-1', apiSecret: 'secret-1',
    fetchImpl: cloudinaryFetch(capture), now: () => 1700000000, boundary: () => 'BOUND',
  });
  const res = await storage.save('vid_x', 'video/mp4', Readable.from([Buffer.alloc(2048, 3)]), { declaredLength: 2048 });

  assert.equal(capture.url, 'https://api.cloudinary.com/v1_1/neutv/video/upload');
  assert.match(capture.init.headers['content-type'], /^multipart\/form-data; boundary=BOUND$/);

  const body = capture.body.toString('latin1');
  assert.match(body, /name="public_id"\r\n\r\nvideos\/vid_x/);
  assert.match(body, /name="signature"/);
  assert.ok(!body.includes('secret-1'), 'the API secret is never transmitted, only the digest');
  assert.equal(capture.body.length, Number(capture.init.headers['content-length']),
    'the declared length has to match the bytes actually sent, or the upload hangs');

  // What Cloudinary reports is what gets recorded, because it transcodes.
  assert.deepEqual(res, { path: 'videos/vid_x.mp4', size: 2048, contentType: 'video/mp4', ext: 'mp4' });
});

test('the Cloudinary signature covers the parameters and excludes the file', () => {
  // sorted "k=v" pairs, joined by &, secret appended, sha1 - computed here
  // independently of the implementation.
  const expected = createHash('sha1').update('public_id=sample&timestamp=1315060510' + 'abcd').digest('hex');
  assert.equal(signParams({ timestamp: '1315060510', public_id: 'sample' }, 'abcd'), expected);

  // api_key, file and resource_type are sent but must not change the digest.
  assert.equal(
    signParams({ public_id: 'a', timestamp: '1', api_key: 'k', file: 'f', resource_type: 'video' }, 's'),
    signParams({ public_id: 'a', timestamp: '1' }, 's'),
  );
  // A different secret must produce a different signature.
  assert.notEqual(signParams({ public_id: 'a', timestamp: '1' }, 's'), signParams({ public_id: 'a', timestamp: '1' }, 't'));
});

test('Cloudinary needs a length, and honours the type allowlist and size cap', async () => {
  const storage = createCloudinaryStorage({
    cloudName: 'neutv', apiKey: 'k', apiSecret: 's', maxBytes: 1024, fetchImpl: cloudinaryFetch({}),
  });
  const body = () => Readable.from([Buffer.alloc(8)]);
  await assert.rejects(() => storage.save('vid_x', 'video/mp4', body(), {}), (e) => e.status === 400);
  await assert.rejects(() => storage.save('vid_x', 'text/plain', body(), { declaredLength: 8 }), (e) => e.status === 400);
  await assert.rejects(() => storage.save('vid_x', 'video/mp4', body(), { declaredLength: 99999 }), (e) => e.status === 400);
  await assert.rejects(() => storage.save('../escape', 'video/mp4', body(), { declaredLength: 8 }), (e) => e.status === 400);
});

test('a Cloudinary refusal surfaces as unavailable, not as a successful upload', async () => {
  const storage = createCloudinaryStorage({
    cloudName: 'neutv', apiKey: 'k', apiSecret: 's',
    fetchImpl: cloudinaryFetch({}, { ok: false, status: 401, text: async () => 'Invalid Signature' }),
  });
  await assert.rejects(
    () => storage.save('vid_x', 'video/mp4', Readable.from([Buffer.alloc(8)]), { declaredLength: 8 }),
    (e) => e.status === 503 && /Cloudinary refused/.test(e.message),
  );
});

test('selecting cloudinary without credentials fails loudly at boot', () => {
  assert.throws(() => createMediaStorage({ NEUTV_MEDIA_DRIVER: 'cloudinary' }), /needs: NEUTV_CLOUDINARY_CLOUD_NAME/);
  const ok = createMediaStorage({
    NEUTV_MEDIA_DRIVER: 'cloudinary',
    NEUTV_CLOUDINARY_CLOUD_NAME: 'neutv', NEUTV_CLOUDINARY_API_KEY: 'k', NEUTV_CLOUDINARY_API_SECRET: 's',
  });
  assert.equal(ok.driver, 'cloudinary');
});

test('the delivery transform keeps a file under a CDN object limit', async () => {
  // A 28-second 1080p upload arrives at 50.7MB, which Fastly refuses to buffer
  // ("Response object too large", error 54113) so it never plays. q_auto brings
  // the same clip to 5.3MB. The transform is a URL segment, so it costs nothing
  // to store and nothing to compute here.
  const { mediaTransformFor } = await import('../storage/index.mjs');
  assert.equal(mediaTransformFor({ NEUTV_MEDIA_DRIVER: 'cloudinary' }), 'q_auto,f_auto');
  assert.equal(mediaTransformFor({ NEUTV_MEDIA_DRIVER: 'local' }), '', 'disk serves what it was given');
  assert.equal(mediaTransformFor({ NEUTV_MEDIA_DRIVER: 's3' }), '', 'plain object storage does not transform');
  assert.equal(
    mediaTransformFor({ NEUTV_MEDIA_DRIVER: 'cloudinary', NEUTV_MEDIA_TRANSFORM: 'q_auto:eco,w_1280' }),
    'q_auto:eco,w_1280',
    'and it can be overridden',
  );
  assert.equal(mediaTransformFor({ NEUTV_MEDIA_DRIVER: 'cloudinary', NEUTV_MEDIA_TRANSFORM: '' }), '',
    'including turned off entirely');
});
