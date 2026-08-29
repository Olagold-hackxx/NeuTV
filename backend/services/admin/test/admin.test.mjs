import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createAdminService, parseDuration } from '../service.mjs';
import { openAdminStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { createStorage, ALLOWED_TYPES } from '../storage/local.mjs';

const build = async (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const root = mkdtempSync(join(tmpdir(), 'neutv-uploads-'));
  const admin = createAdminService({
    runtime, catalog, uploadsRoot: root, store: await testStore(openAdminStore), ...over,
  });
  return { runtime, admin, root };
};
const ADMIN = 'admin-1';
const external = (admin, over = {}) => admin.createVideo(ADMIN, {
  title: 'Opening Bell', kind: 'external', sourceUrl: 'https://cdn.neu.tv/bell.mp4', duration: '04:12', ...over,
});

test('an external video is playable the moment it is registered', async () => {
  const { admin } = await build();
  const { video, upload } = await external(admin);
  assert.equal(video.status, 'ready');
  assert.equal(video.durationSeconds, 252);
  assert.equal(upload, null, 'nothing to upload');
});

test('an upload starts as a draft and is handed an upload target', async () => {
  const { admin } = await build();
  const { video, upload } = await admin.createVideo(ADMIN, { title: 'Studio Session', kind: 'upload' });
  assert.equal(video.status, 'draft');
  assert.equal(video.hasFile, false);
  assert.equal(upload.method, 'PUT');
  assert.ok(upload.url.endsWith(`/admin/videos/${video.id}/file`));
});

test('uploading bytes makes the video ready and gives it a playback URL', async () => {
  const { admin, root } = await build();
  const { video } = await admin.createVideo(ADMIN, { title: 'Studio Session', kind: 'upload' });
  const res = await admin.uploadFile(video.id, {
    stream: Readable.from([Buffer.from('fake mp4 bytes')]),
    contentType: 'video/mp4',
  });
  assert.equal(res.video.status, 'ready');
  assert.equal(res.video.hasFile, true);
  assert.equal(res.video.playbackUrl, `/media/${video.id}.mp4`);
  assert.equal(readFileSync(join(root, `${video.id}.mp4`), 'utf8'), 'fake mp4 bytes');
});

test('an unsupported file type is refused', async () => {
  const { admin } = await build();
  const { video } = await admin.createVideo(ADMIN, { title: 'Not A Video', kind: 'upload' });
  await assert.rejects(
    () => admin.uploadFile(video.id, { stream: Readable.from(['<?php ?>']), contentType: 'application/x-php' }),
    (e) => e.status === 400,
  );
});

test('an oversized upload is cut off and leaves no partial file behind', async () => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const root = mkdtempSync(join(tmpdir(), 'neutv-cap-'));
  const admin = createAdminService({
    runtime, catalog, storage: createStorage({ root, maxBytes: 100 }),
    store: await testStore(openAdminStore),
  });
  const { video } = await admin.createVideo(ADMIN, { title: 'Too Big', kind: 'upload' });
  await assert.rejects(
    () => admin.uploadFile(video.id, {
      stream: Readable.from([Buffer.alloc(500)]), contentType: 'video/mp4',
    }),
    (e) => e.status === 400,
  );
  assert.equal(existsSync(join(root, `${video.id}.mp4`)), false, 'no half-written file left to serve');
});

test('a lying Content-Length does not get past the byte meter', async () => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const root = mkdtempSync(join(tmpdir(), 'neutv-lie-'));
  const admin = createAdminService({
    runtime, catalog, storage: createStorage({ root, maxBytes: 100 }),
    store: await testStore(openAdminStore),
  });
  const { video } = await admin.createVideo(ADMIN, { title: 'Liar', kind: 'upload' });
  await assert.rejects(
    () => admin.uploadFile(video.id, {
      stream: Readable.from([Buffer.alloc(500)]), contentType: 'video/mp4', contentLength: '10',
    }),
    (e) => e.status === 400,
  );
});

test('an empty upload is refused', async () => {
  const { admin } = await build();
  const { video } = await admin.createVideo(ADMIN, { title: 'Empty', kind: 'upload' });
  await assert.rejects(
    () => admin.uploadFile(video.id, { stream: Readable.from([]), contentType: 'video/mp4' }),
    (e) => e.status === 400,
  );
});

test('the stored filename comes from the video id, never from the client', async () => {
  const { admin, root } = await build();
  const { video } = await admin.createVideo(ADMIN, { title: 'Traversal', kind: 'upload' });
  await admin.uploadFile(video.id, {
    stream: Readable.from(['x']), contentType: 'video/mp4; codecs="avc1"',
  });
  assert.ok(existsSync(join(root, `${video.id}.mp4`)));
  assert.ok(Object.values(ALLOWED_TYPES).includes('mp4'));
});

test('setting the programme puts a video on the main page and publishes it', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  const res = await admin.setProgramme(ADMIN, { videoId: video.id, note: 'morning block' });
  assert.equal(res.video.id, video.id);
  assert.equal(res.video.status, 'published');
  assert.equal(res.programme.setBy, ADMIN);
  assert.equal((await admin.currentProgramme()).video.id, video.id);
});

test('before any admin sets one, there is no programme and the caller is told so', async () => {
  const { admin } = await build();
  const current = await admin.currentProgramme();
  assert.equal(current.video, null);
  assert.equal(current.source, 'unset', 'live falls back to the seeded broadcast');
});

test('a video with nothing to play cannot be broadcast or published', async () => {
  const { admin } = await build();
  const { video } = await admin.createVideo(ADMIN, { title: 'No Bytes Yet', kind: 'upload' });
  await assert.rejects(() => admin.setProgramme(ADMIN, { videoId: video.id }), (e) => e.status === 409);
  await assert.rejects(() => admin.updateVideo(video.id, { status: 'published' }), (e) => e.status === 409);
});

test('the video currently on air cannot be archived out from under the page', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  await admin.setProgramme(ADMIN, { videoId: video.id });
  await assert.rejects(() => admin.archiveVideo(video.id), (e) => e.status === 409);
});

test('archiving keeps the file, and an archived video cannot go on air', async () => {
  const { admin } = await build();
  const a = (await external(admin)).video;
  const b = (await external(admin, { title: 'Second' })).video;
  await admin.setProgramme(ADMIN, { videoId: a.id });
  const res = await admin.archiveVideo(b.id);
  assert.equal(res.video.status, 'archived');
  await assert.rejects(() => admin.setProgramme(ADMIN, { videoId: b.id }), (e) => e.status === 409);
});

test('programme history records every change, newest first', async () => {
  const { runtime, admin } = await build();
  const a = (await external(admin)).video;
  const b = (await external(admin, { title: 'Second' })).video;
  await admin.setProgramme(ADMIN, { videoId: a.id });
  runtime.tick();
  await admin.setProgramme(ADMIN, { videoId: b.id });
  const { history, video } = await admin.programmeWithHistory();
  assert.equal(video.id, b.id);
  assert.deepEqual(history.map((h) => h.videoId), [b.id, a.id]);
});

test('a video must belong to a real ecosystem product', async () => {
  const { admin } = await build();
  await assert.rejects(() => external(admin, { productId: 'fakebank' }), (e) => e.status === 400);
});

test('an external video needs somewhere to play from', async () => {
  const { admin } = await build();
  await assert.rejects(
    () => admin.createVideo(ADMIN, { title: 'Nowhere', kind: 'external' }),
    (e) => e.status === 400,
  );
});

// --- editing a video that is already live ---------------------------------

test('editing the title leaves the source alone', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  const res = await admin.updateVideo(video.id, { title: 'Closing Bell' });
  assert.equal(res.video.title, 'Closing Bell');
  assert.equal(res.video.playbackUrl, 'https://cdn.neu.tv/bell.mp4');
  assert.equal(res.video.status, 'ready', 'an unrelated edit does not touch publish state');
});

test('swapping the URL replaces the source rather than stacking on it', async () => {
  const { admin } = await build();
  const { video } = await external(admin, { youtubeId: 'abc123xyz' });
  assert.equal(video.youtubeId, 'abc123xyz');

  const res = await admin.updateVideo(video.id, { sourceUrl: 'https://cdn.neu.tv/replacement.mp4' });
  assert.equal(res.video.playbackUrl, 'https://cdn.neu.tv/replacement.mp4');
  assert.equal(res.video.youtubeId, null, 'the old YouTube id would otherwise keep winning in the player');
});

test('a published video can switch to a YouTube id and stays published', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  await admin.updateVideo(video.id, { status: 'published' });

  const res = await admin.updateVideo(video.id, { youtubeId: 'SqBx7QADBes' });
  assert.equal(res.video.youtubeId, 'SqBx7QADBes');
  assert.equal(res.video.playbackUrl, null, 'a YouTube video has no direct URL');
  assert.equal(res.video.status, 'published');
});

test('switching an external video to an uploaded file makes it await bytes', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  await admin.updateVideo(video.id, { status: 'published' });

  const res = await admin.updateVideo(video.id, { kind: 'upload' });
  assert.equal(res.video.kind, 'upload');
  assert.equal(res.video.hasFile, false);
  assert.equal(res.video.playbackUrl, null, 'the external URL is no longer how it is reached');
  assert.equal(res.video.status, 'draft', 'nothing to play, so it cannot stay published');
});

test('a video switched to upload plays from the file once it lands', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  await admin.updateVideo(video.id, { kind: 'upload' });

  const res = await admin.uploadFile(video.id, { stream: Readable.from(['bytes']), contentType: 'video/mp4' });
  assert.equal(res.video.hasFile, true);
  assert.equal(res.video.status, 'ready');
  assert.match(res.video.playbackUrl, /\/media\//);
});

test('an uploaded video switched to an external URL stops reporting a file', async () => {
  const { admin } = await build();
  const { video } = await admin.createVideo(ADMIN, { title: 'Studio Session', kind: 'upload' });
  await admin.uploadFile(video.id, { stream: Readable.from(['bytes']), contentType: 'video/mp4' });

  const res = await admin.updateVideo(video.id, { kind: 'external', sourceUrl: 'https://cdn.neu.tv/studio.mp4' });
  assert.equal(res.video.kind, 'external');
  assert.equal(res.video.hasFile, false);
  assert.equal(res.video.fileSize, null, 'a size for a file it no longer plays would be a lie');
  assert.equal(res.video.playbackUrl, 'https://cdn.neu.tv/studio.mp4');
});

test('going external with nowhere to play is refused', async () => {
  const { admin } = await build();
  const { video } = await admin.createVideo(ADMIN, { title: 'Studio Session', kind: 'upload' });
  await assert.rejects(() => admin.updateVideo(video.id, { kind: 'external' }), (e) => e.status === 400);
});

test('the video on air cannot be edited into having nothing to play', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  await admin.setProgramme(ADMIN, { videoId: video.id });
  await assert.rejects(() => admin.updateVideo(video.id, { kind: 'upload' }), (e) => e.status === 409);
  assert.equal((await admin.currentProgramme()).video.playbackUrl, 'https://cdn.neu.tv/bell.mp4');
});

test('a length can be edited as a display string, the way it is entered', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  const res = await admin.updateVideo(video.id, { duration: '1:02:33' });
  assert.equal(res.video.durationSeconds, 3753);
});

test('an unknown video is a 404 on every path that touches it', async () => {
  const { admin } = await build();
  await assert.rejects(() => admin.getVideo('vid_nope'), (e) => e.status === 404);
  await assert.rejects(() => admin.updateVideo('vid_nope', { title: 'x' }), (e) => e.status === 404);
  await assert.rejects(() => admin.setProgramme(ADMIN, { videoId: 'vid_nope' }), (e) => e.status === 404);
  await assert.rejects(() => admin.uploadFile('vid_nope', { stream: Readable.from(['x']), contentType: 'video/mp4' }), (e) => e.status === 404);
});

test('the CRM survives ports that are not wired', async () => {
  const { admin } = await build();
  await external(admin);
  const overview = await admin.crmOverview();
  assert.equal(overview.library.total, 1);
  assert.equal(overview.viewers, null, 'an unwired port reports null, it does not throw');
  assert.deepEqual(await admin.crmViewers(), { viewers: [] });
});

test('the CRM joins viewers to what they have spent', async () => {
  const { admin } = await build({
    ports: {
      viewers: {
        summary: () => ({ total: 2 }),
        list: () => [{ id: 'u1', name: '@alex' }, { id: 'u2', name: '@elena' }],
      },
      spend: { summary: () => ({ coinsSpent: 500 }), byUser: () => ({ u1: { spent: 500, gifts: 1 } }) },
    },
  });
  const { viewers } = await admin.crmViewers();
  assert.equal(viewers.find((v) => v.id === 'u1').coinsSpent, 500);
  assert.equal(viewers.find((v) => v.id === 'u2').coinsSpent, 0, 'a viewer who never spent reads as zero, not undefined');
});

test('duration parsing covers the formats the catalog actually ships', async () => {
  assert.equal(parseDuration('04:12'), 252);
  assert.equal(parseDuration('1:02:33'), 3753);
  assert.equal(parseDuration('12'), 12);
  assert.equal(parseDuration(90), 90);
  assert.equal(parseDuration('nonsense'), 0);
  assert.equal(parseDuration(null), 0);
  assert.equal(parseDuration(undefined), 0);
});

test('the public video route serves only published videos', async () => {
  const { admin } = await build();
  const { video } = await external(admin);
  // Ready but not on air: not publicly readable.
  await assert.rejects(() => admin.publishedVideo(video.id), (e) => e.status === 404);
  await admin.setProgramme(ADMIN, { videoId: video.id });
  assert.equal((await admin.publishedVideo(video.id)).video.id, video.id);
});

test('an archived video stops being publicly readable', async () => {
  const { admin } = await build();
  const a = (await external(admin)).video;
  const b = (await external(admin, { title: 'Second' })).video;
  await admin.setProgramme(ADMIN, { videoId: a.id });
  await admin.setProgramme(ADMIN, { videoId: b.id });
  await admin.archiveVideo(a.id);
  await assert.rejects(() => admin.publishedVideo(a.id), (e) => e.status === 404);
});
