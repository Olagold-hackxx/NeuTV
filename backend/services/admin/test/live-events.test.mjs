import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createAdminService } from '../service.mjs';
import { openAdminStore } from '../store.mjs';
import { adminEvent, publicEvent } from '../live-events.mjs';
import { createIngestProvider, validatePlayback } from '../ingest/index.mjs';

const ADMIN = 'admin-1';
const HLS = 'https://stream.example.com/live/abc.m3u8';

const build = async (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const emitted = [];
  const admin = createAdminService({
    runtime, catalog,
    store: await testStore(openAdminStore),
    uploadsRoot: '/tmp/neutv-live-test',
    events: { emit: (type, payload) => emitted.push([type, payload]) },
    ...over,
  });
  return { runtime, admin, events: admin.liveEvents, emitted };
};

const schedule = (events, over = {}) =>
  events.create(ADMIN, { title: 'Market Open Special', playbackUrl: HLS, ...over });

test('scheduling an event mints a stream key and starts it off air', async () => {
  const { events } = await build();
  const { event, instructions } = await schedule(events);
  assert.equal(event.status, 'scheduled');
  assert.equal(event.isLive, false);
  assert.equal(event.driver, 'manual');
  assert.ok(event.streamKey.startsWith('nk_'), 'a key is minted even for the manual driver');
  assert.equal(event.playbackUrl, HLS);
  assert.match(instructions, /OBS|RTMP/i, 'the admin is told how to feed it');
});

test('going on air supersedes the programme, and ending gives it back', async () => {
  const { admin, events } = await build();
  // Something is programmed.
  const { video } = await admin.createVideo(ADMIN, {
    title: 'Scheduled Block', kind: 'external', sourceUrl: 'https://cdn/x.mp4', duration: '10:00',
  });
  await admin.setProgramme(ADMIN, { videoId: video.id });
  assert.equal((await admin.currentProgramme()).video.id, video.id);

  const { event } = await schedule(events);
  await events.start(event.id);

  const onAir = await events.current();
  assert.equal(onAir.event.id, event.id);
  assert.equal(onAir.event.isLive, true);
  // The programme is untouched underneath; it is simply outranked.
  assert.equal((await admin.currentProgramme()).video.id, video.id);

  await events.stop(event.id);
  assert.equal((await events.current()).event, null, 'nothing on air once it ends');
});

test('only one event can be on air at a time', async () => {
  const { events } = await build();
  const a = (await schedule(events, { title: 'First' })).event;
  const b = (await schedule(events, { title: 'Second' })).event;
  await events.start(a.id);
  await assert.rejects(() => events.start(b.id), (e) => e.status === 409 && /already on air/.test(e.message));
  await events.stop(a.id);
  await events.start(b.id);
  assert.equal((await events.current()).event.id, b.id);
});

test('an event with nothing to play cannot go on air', async () => {
  const { events } = await build();
  const { event } = await events.create(ADMIN, { title: 'No Feed Yet' });
  await assert.rejects(() => events.start(event.id), (e) => e.status === 409 && /no playback URL/.test(e.message));
});

test('the lifecycle only moves forwards', async () => {
  const { events } = await build();
  const { event } = await schedule(events);
  await assert.rejects(() => events.stop(event.id), (e) => e.status === 409, 'cannot stop what is not on air');
  await events.start(event.id);
  await assert.rejects(() => events.start(event.id), (e) => e.status === 409, 'cannot start twice');
  await events.stop(event.id);
  await assert.rejects(() => events.start(event.id), (e) => e.status === 409, 'cannot restart an ended event');
});

test('an event on air cannot be edited or cancelled out from under viewers', async () => {
  const { events } = await build();
  const { event } = await schedule(events);
  await events.start(event.id);
  await assert.rejects(() => events.update(event.id, { title: 'Renamed' }), (e) => e.status === 409);
  await assert.rejects(() => events.cancel(event.id), (e) => e.status === 409);
});

test('the stream key never appears in the public shape', async () => {
  const { events } = await build();
  const { event } = await schedule(events);
  await events.start(event.id);

  const current = (await events.current()).event;
  assert.ok(!('streamKey' in current), 'no stream key');
  assert.ok(!('ingestUrl' in current), 'no ingest URL');
  assert.ok(!('providerRef' in current), 'no provider internals');
  assert.ok(!JSON.stringify(current).includes(event.streamKey), 'the key is nowhere in the payload');
  assert.equal(current.title, event.title, 'but the useful fields are there');
});

test('rotating the key invalidates the old one', async () => {
  const { events } = await build();
  const { event } = await schedule(events);
  const rotated = (await events.rotateKey(event.id)).event;
  assert.notEqual(rotated.streamKey, event.streamKey);
  assert.ok(rotated.streamKey.startsWith('nk_'));
});

test('an ended event cannot have its key rotated', async () => {
  const { events } = await build();
  const { event } = await schedule(events);
  await events.start(event.id);
  await events.stop(event.id);
  await assert.rejects(() => events.rotateKey(event.id), (e) => e.status === 409);
});

test('going on and off air is announced so viewers switch without reloading', async () => {
  const { events, emitted } = await build();
  const { event } = await schedule(events);
  await events.start(event.id);
  await events.stop(event.id);

  const announcements = emitted.filter(([type]) => type === 'live-event');
  assert.deepEqual(announcements.map(([, p]) => p.status), ['started', 'ended']);
  assert.equal(announcements[0][1].event.id, event.id);
  assert.ok(!JSON.stringify(announcements).includes(event.streamKey), 'and never leaks the key over SSE');
});

test('teardown failing does not keep a broadcast on air', async () => {
  // A dangling live input at the provider is a billing problem. Refusing to end
  // the broadcast because of it would be an outage.
  const ingest = {
    driver: 'manual',
    provision: async (e) => ({ ingestUrl: null, streamKey: null, playbackUrl: e.playbackUrl, providerRef: 'ref-1', instructions: 'x' }),
    teardown: async () => { throw new Error('provider unreachable'); },
  };
  const { events } = await build({ ingest });
  const { event } = await schedule(events);
  await events.start(event.id);
  const stopped = await events.stop(event.id);
  assert.equal(stopped.event.status, 'ended');
  assert.equal((await events.current()).event, null);
});

test('a playback target must be something a player can open', () => {
  assert.equal(validatePlayback(HLS).kind, 'hls');
  assert.equal(validatePlayback('xHU5MHuUSKI').kind, 'youtube');
  assert.equal(validatePlayback('https://cdn/clip.mp4').kind, 'file');
  assert.throws(() => validatePlayback('http://insecure/x.m3u8'), (e) => e.status === 400);
  assert.throws(() => validatePlayback('javascript:alert(1)'), (e) => e.status === 400);
  assert.equal(validatePlayback(null), null);
});

test('the default ingest driver needs no account', () => {
  assert.equal(createIngestProvider({}).driver, 'manual');
  assert.throws(() => createIngestProvider({ NEUTV_LIVE_DRIVER: 'mux' }), /NEUTV_MUX_TOKEN_ID/);
  assert.throws(() => createIngestProvider({ NEUTV_LIVE_DRIVER: 'nonsense' }), /Unknown NEUTV_LIVE_DRIVER/);
});

test('the public shape is built by naming fields, not by deleting them', () => {
  // A field added to the admin shape later must not leak into the public one.
  const row = {
    id: 'evt_1', title: 't', description: '', product_id: 'ark', status: 'live',
    stream_key: 'nk_secret', ingest_url: 'rtmp://x', provider_ref: 'ref',
    playback_url: HLS, youtube_id: null, poster_url: null, started_at: 1,
    peak_viewers: 0, created_by: 'a', created_at: 1, updated_at: 1, driver: 'manual',
  };
  assert.ok(adminEvent(row).streamKey, 'admins see the key');
  assert.ok(!Object.keys(publicEvent(row)).some((k) => /key|ingest|provider/i.test(k)));
});

test('a browser broadcast goes on air without a playback URL', async () => {
  // Its video arrives as segments once the studio starts recording, so
  // demanding a URL up front made browser broadcasting impossible to start.
  const { events } = await build();
  const { event } = await events.create(ADMIN, { title: 'Live From The Studio', source: 'browser' });
  assert.equal(event.source, 'browser');
  assert.equal(event.playbackUrl, null);

  const started = await events.start(event.id);
  assert.equal(started.event.status, 'live');
  assert.equal((await events.current()).event.source, 'browser');
});

test('an external event still needs somewhere to play from', async () => {
  const { events } = await build();
  const { event } = await events.create(ADMIN, { title: 'External', source: 'external' });
  await assert.rejects(() => events.start(event.id), (e) => e.status === 409 && /no playback URL/.test(e.message));
});

test('the source is visible publicly so a player knows how to fetch it', async () => {
  const { events } = await build();
  const { event } = await events.create(ADMIN, { title: 'Studio', source: 'browser' });
  await events.start(event.id);
  const current = (await events.current()).event;
  assert.equal(current.source, 'browser');
  assert.equal(current.playbackUrl, null, 'a player must fall back to segments');
});

// --- fixing an event that cannot go on air ---------------------------------

test('an external event with no playback source can be switched to the studio', async () => {
  const { events } = await build();
  const { event } = await events.create(ADMIN, { title: 'Live From The Studio', source: 'external' });
  assert.equal(event.source, 'external');
  assert.equal(event.playbackUrl, null);
  // As created it is unstartable, and before source was editable it was also
  // unfixable: cancel and start again was the only way out.
  await assert.rejects(() => events.start(event.id), (e) => e.status === 409);

  const res = await events.update(event.id, { source: 'browser' });
  assert.equal(res.event.source, 'browser');
  assert.equal((await events.start(event.id)).event.status, 'live', 'a browser event needs no URL');
});

test('a playback URL can be added to an event that was missing one', async () => {
  const { events } = await build();
  const { event } = await events.create(ADMIN, { title: 'Market Open', source: 'external' });
  await events.update(event.id, { playbackUrl: 'https://stream.example.com/live/abc.m3u8' });
  assert.equal((await events.start(event.id)).event.status, 'live');
});

test('a YouTube id is accepted as the playback source', async () => {
  const { events } = await build();
  const { event } = await events.create(ADMIN, { title: 'Simulcast', source: 'external' });
  const res = await events.update(event.id, { playbackUrl: 'SqBx7QADBes' });
  assert.equal(res.event.youtubeId, 'SqBx7QADBes');
  assert.equal(res.event.playbackUrl, null, 'a YouTube event plays through the embed');
});

test('an event cannot be left external with nothing to play', async () => {
  const { events } = await build();
  const { event } = await events.create(ADMIN, { title: 'Studio', source: 'browser' });
  await assert.rejects(() => events.update(event.id, { source: 'external' }), (e) => e.status === 400);
});
