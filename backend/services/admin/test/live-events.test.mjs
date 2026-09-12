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

// --- self-hosted ingest -----------------------------------------------------

test('the mediamtx driver mints a path and derives the playback URL from it', async () => {
  const ingest = createIngestProvider({
    NEUTV_LIVE_DRIVER: 'mediamtx',
    NEUTV_MEDIAMTX_RTMP_URL: 'rtmp://stream.neu.tv:1935/',
    NEUTV_MEDIAMTX_HLS_BASE: 'https://stream.neu.tv/hls/',
  });
  assert.equal(ingest.driver, 'mediamtx');

  const a = await ingest.provision({ title: 'Market Open' });
  assert.equal(a.ingestUrl, 'rtmp://stream.neu.tv:1935', 'trailing slash trimmed; OBS appends its own');
  assert.equal(a.playbackUrl, `https://stream.neu.tv/hls/${a.streamKey}/index.m3u8`);
  assert.ok(a.streamKey.startsWith('live-'));

  // The path is the credential: anyone who can publish to it owns the
  // broadcast, so two events must never collide.
  const b = await ingest.provision({ title: 'Market Open' });
  assert.notEqual(b.streamKey, a.streamKey);
  assert.ok(a.streamKey.length >= 20, 'and it has to be long enough not to be guessed');

  // A path is created by publishing to it, so there is nothing to release.
  await ingest.teardown(a.providerRef);
});

test('mediamtx without its URLs fails at boot rather than at go-live', () => {
  assert.throws(() => createIngestProvider({ NEUTV_LIVE_DRIVER: 'mediamtx' }),
    /needs NEUTV_MEDIAMTX_RTMP_URL and NEUTV_MEDIAMTX_HLS_BASE/);
});

test('the transport viewers are told is the one the video actually takes', async (t) => {
  // The viewer opens a different player per transport, so a wrong answer here
  // is a broadcast nobody sees: it inferred "segments" from source=browser
  // until WHIP made that false, and every viewer asked for a segment 0 that
  // did not exist.
  await t.test('the studio declares WHIP at start', async () => {
    const { events } = await build();
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await events.start(event.id, { transport: 'whip' });
    assert.equal((await events.current()).event.transport, 'whip');
  });

  await t.test('a start from the panel declares nothing', async () => {
    const { events } = await build();
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await events.start(event.id);
    // Null, not a guess: defaulting to 'segments' would repeat the original
    // bug for a panel-started event that then broadcasts over WHIP.
    assert.equal((await events.current()).event.transport, null);
  });

  await t.test('the first segment settles it regardless', async (sub) => {
    const { admin, events } = await build();
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await events.start(event.id, { transport: 'whip' });
    const { Readable } = await import('node:stream');
    await admin.liveSegments.append(event.id, {
      stream: Readable.from([Buffer.from('webmish header bytes')]),
      contentType: 'video/webm',
      contentLength: 20,
      init: true,
    });
    assert.equal((await events.current()).event.transport, 'segments',
      'proof of arrival beats the declaration');
  });

  await t.test('rejects a transport that is neither', async () => {
    const { events } = await build();
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await assert.rejects(
      () => events.start(event.id, { transport: 'carrier-pigeon' }),
      // The validator's message is the generic one; the field is in details.
      (err) => err.status === 400
        && JSON.stringify(err.details ?? '').includes('transport'),
    );
  });
});

test('a MediaMTX event survives a domain migration', async (t) => {
  // The playback URL viewers failed on was https://<old-domain>/hls/...,
  // minted at creation and stored verbatim. The path is the event's identity;
  // the hostname is deployment configuration, re-derived on every read.
  const domain = (host) => createIngestProvider({
    NEUTV_LIVE_DRIVER: 'mediamtx',
    NEUTV_MEDIAMTX_RTMP_URL: `rtmp://${host}:1935`,
    NEUTV_MEDIAMTX_HLS_BASE: `https://${host}/hls`,
    NEUTV_MEDIAMTX_WHIP_BASE: `https://${host}/whip`,
  });

  const sharedStore = await testStore(openAdminStore);
  const onOld = await build({ store: sharedStore, ingest: domain('neutv.tsionark.io') });
  const { event: created } = await schedule(onOld.events, { source: 'browser', playbackUrl: undefined });
  assert.match(created.playbackUrl, /tsionark\.io/, 'minted under the old domain');

  // The server is redeployed under the new domain; the rows are untouched.
  // (The runtime is shared: a fresh fakeRuntime would restart its
  // deterministic uuid sequence and collide with the ids already stored.)
  const onNew = await build({ store: sharedStore, runtime: onOld.runtime, ingest: domain('api.tsionneu.xyz'), hookSecret: 'k' });

  await t.test('every stored URL now answers from the new domain', async () => {
    const { event } = await onNew.events.get(created.id);
    assert.equal(event.playbackUrl, `https://api.tsionneu.xyz/hls/${created.streamKey}/index.m3u8`);
    assert.equal(event.whipUrl, `https://api.tsionneu.xyz/whip/${created.streamKey}/whip`);
    assert.equal(event.ingestUrl, 'rtmp://api.tsionneu.xyz:1935');
  });

  await t.test('viewers see the new domain too', async () => {
    await onNew.events.start(created.id, { transport: 'whip' });
    // No transcoder prefix on this provider, so the viewer path is the raw key.
    await onNew.events.hook({ event: 'available', path: created.streamKey, secret: 'k' });
    const { event } = await onNew.events.current();
    assert.match(event.playbackUrl, /^https:\/\/api\.tsionneu\.xyz\//);
    await onNew.events.stop(created.id);
  });

  await t.test('a hand-pasted playback URL is not rewritten', async () => {
    const { event: ext } = await schedule(onNew.events, { source: 'browser', playbackUrl: undefined });
    await onNew.events.update(ext.id, {
      source: 'external',
      playbackUrl: 'https://stream.mux.com/abc123.m3u8',
    });
    const again = await build({ store: sharedStore, runtime: onOld.runtime, ingest: domain('yet-another.example') });
    const { event } = await again.events.get(ext.id);
    assert.equal(event.playbackUrl, 'https://stream.mux.com/abc123.m3u8',
      'the admin chose this URL; no relocation may second-guess it');
  });
});

test('viewers are sent to the transcoded stream, publishers to the raw one', async (t) => {
  // The whole point of the transcoder is that the stream the studio publishes
  // and the stream viewers read are no longer the same stream. Getting this
  // backwards is silent: ingest works, playback works, and the six-second
  // drift nobody could explain is simply still there.
  const provider = (prefix) => createIngestProvider({
    NEUTV_LIVE_DRIVER: 'mediamtx',
    NEUTV_MEDIAMTX_RTMP_URL: 'rtmp://api.example.com:1935',
    NEUTV_MEDIAMTX_HLS_BASE: 'https://cdn.example.com/hls',
    NEUTV_MEDIAMTX_WHIP_BASE: 'https://api.example.com/whip',
    ...(prefix === undefined ? {} : { NEUTV_MEDIAMTX_TRANSCODE_PREFIX: prefix }),
  });

  await t.test('publish to the raw path, play the re-encoded one', async () => {
    const { streamKey, whipUrl, playbackUrl } = await provider('abr').provision();
    assert.equal(whipUrl, `https://api.example.com/whip/${streamKey}/whip`);
    assert.equal(playbackUrl, `https://cdn.example.com/hls/abr/${streamKey}/index.m3u8`);
  });

  await t.test('no prefix means no transcoder, so playback falls back to the raw path', async () => {
    // A stream six seconds behind still beats a 404 at a path nothing writes to.
    const { streamKey, playbackUrl } = await provider(undefined).provision();
    assert.equal(playbackUrl, `https://cdn.example.com/hls/${streamKey}/index.m3u8`);
  });

  await t.test('an event scheduled before the transcoder existed is relocated onto it', async () => {
    const shared = await testStore(openAdminStore);
    const before = await build({ store: shared, ingest: provider(undefined) });
    const { event } = await schedule(before.events, { source: 'browser', playbackUrl: undefined });
    assert.ok(!event.playbackUrl.includes('/abr/'), 'minted before the transcoder');

    const after = await build({ store: shared, runtime: before.runtime, ingest: provider('abr') });
    const { event: moved } = await after.events.get(event.id);
    assert.equal(moved.playbackUrl, `https://cdn.example.com/hls/abr/${event.streamKey}/index.m3u8`,
      'playback follows the transcoder without touching the row');
    assert.equal(moved.whipUrl, `https://api.example.com/whip/${event.streamKey}/whip`,
      'the publish endpoint is left exactly where the studio expects it');
  });
});


test('viewers are told about a stream only once it exists', async (t) => {
  // On a linear network every viewer is already on the page when the admin
  // goes live. The transcoder needs ~3s to publish abr/<key>; announcing the
  // event before then switched every stage to a manifest that 404'd. Now the
  // event is invisible to viewers until MediaMTX says the path is up.
  const SECRET = 'hook-s3cret';
  const mtx = () => createIngestProvider({
    NEUTV_LIVE_DRIVER: 'mediamtx',
    NEUTV_MEDIAMTX_RTMP_URL: 'rtmp://api.example.com:1935',
    NEUTV_MEDIAMTX_HLS_BASE: 'https://cdn.example.com/hls',
    NEUTV_MEDIAMTX_WHIP_BASE: 'https://api.example.com/whip',
    NEUTV_MEDIAMTX_TRANSCODE_PREFIX: 'abr',
  });
  const started = (emitted) => emitted.filter(([t, p]) => t === 'live-event' && p.status === 'started').length;
  const withStatus = (emitted, st) => emitted.filter(([t, p]) => t === 'live-event' && p.status === st).length;

  await t.test('on air is not yet visible; the hook makes it so, exactly once', async () => {
    const { events, emitted } = await build({ ingest: mtx(), hookSecret: SECRET });
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await events.start(event.id, { transport: 'whip' });

    assert.equal((await events.current()).event, null, 'viewers see nothing yet');
    assert.equal(started(emitted), 0, 'nothing announced yet');
    assert.equal((await events.get(event.id)).event.isReady, false, 'the admin can see why');

    await events.hook({ event: 'available', path: `abr/${event.streamKey}`, secret: SECRET });
    assert.equal((await events.current()).event?.id, event.id, 'now viewers are pointed at a path that answers');
    assert.equal(started(emitted), 1);

    await events.hook({ event: 'available', path: `abr/${event.streamKey}`, secret: SECRET });
    assert.equal(started(emitted), 1, 'a repeated hook announces nothing');
  });

  await t.test('the raw path coming up is not readiness when a transcoder is in front', async () => {
    const { events } = await build({ ingest: mtx(), hookSecret: SECRET });
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await events.start(event.id, { transport: 'whip' });
    const r = await events.hook({ event: 'available', path: event.streamKey, secret: SECRET });
    assert.equal(r.matched, false, 'the publisher\'s own path is nobody\'s viewer path');
    assert.equal((await events.current()).event, null);
  });

  await t.test('losing the stream hides the event and says so; it comes back when the stream does', async () => {
    const { events, emitted } = await build({ ingest: mtx(), hookSecret: SECRET });
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await events.start(event.id, { transport: 'whip' });
    const path = `abr/${event.streamKey}`;
    await events.hook({ event: 'available', path, secret: SECRET });

    await events.hook({ event: 'unavailable', path, secret: SECRET });
    assert.equal((await events.current()).event, null, 'viewers fall back to the programme');
    assert.equal(withStatus(emitted, 'interrupted'), 1, 'and are told it is an interruption, not an ending');
    assert.equal((await events.get(event.id)).event.status, 'live', 'the event itself is not over');

    await events.hook({ event: 'available', path, secret: SECRET });
    assert.equal((await events.current()).event?.id, event.id);
    assert.equal(started(emitted), 2, 'the return is announced like a start');
  });

  await t.test('a stream that never returns ends its event, judged when next asked', async () => {
    const { events, emitted, runtime } = await build({ ingest: mtx(), hookSecret: SECRET });
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await events.start(event.id, { transport: 'whip' });
    const path = `abr/${event.streamKey}`;
    await events.hook({ event: 'available', path, secret: SECRET });
    await events.hook({ event: 'unavailable', path, secret: SECRET });

    runtime.advance(30_000);
    await events.current();
    assert.equal((await events.get(event.id)).event.status, 'live', 'inside the grace it is only interrupted');

    runtime.advance(31_000);
    assert.equal((await events.current()).event, null);
    assert.equal((await events.get(event.id)).event.status, 'ended', 'past the grace it is over');
    assert.equal(withStatus(emitted, 'ended'), 1, 'and viewers hear that too');
  });

  await t.test('a publisher who connects before the operator presses start is not lost', async () => {
    const { events, emitted } = await build({ ingest: mtx(), hookSecret: SECRET });
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    // The stream arrives while the event is still scheduled.
    const r = await events.hook({ event: 'available', path: `abr/${event.streamKey}`, secret: SECRET });
    assert.equal(r.matched, true);
    assert.equal(started(emitted), 0, 'nothing to announce: not on air');
    await events.start(event.id, { transport: 'whip' });
    assert.equal((await events.current()).event?.id, event.id, 'start sees the stream is already there');
    assert.equal(started(emitted), 1);
  });

  await t.test('an external provider needs no word from anyone', async () => {
    const { events, emitted } = await build({ hookSecret: SECRET });   // manual driver, HLS URL
    const { event } = await schedule(events);
    await events.start(event.id);
    assert.equal((await events.current()).event?.id, event.id, 'their URL is theirs to keep up');
    assert.equal(started(emitted), 1);
  });

  await t.test('the segment path is served by this API, so it is ready at start', async () => {
    const { events } = await build({ ingest: mtx(), hookSecret: SECRET });
    const { event } = await schedule(events, { source: 'browser', playbackUrl: undefined });
    await events.start(event.id, { transport: 'segments' });
    assert.equal((await events.current()).event?.id, event.id);
  });

  await t.test('the hook proves itself or is refused', async () => {
    const { events } = await build({ ingest: mtx(), hookSecret: SECRET });
    await assert.rejects(() => events.hook({ event: 'available', path: 'abr/x', secret: 'wrong' }),
      (e) => e.status === 401);
    await assert.rejects(() => events.hook({ event: 'available', path: 'abr/x', secret: null }),
      (e) => e.status === 401);
    const none = await build({ ingest: mtx() });   // no secret configured at all
    await assert.rejects(() => none.events.hook({ event: 'available', path: 'abr/x', secret: 'anything' }),
      (e) => e.status === 401, 'an unconfigured hook accepts nobody');
    await assert.rejects(() => events.hook({ event: 'exploded', path: 'abr/x', secret: SECRET }),
      (e) => e.status === 400);
    const r = await events.hook({ event: 'available', path: 'abr/not-an-event', secret: SECRET });
    assert.deepEqual(r, { matched: false, changed: false }, 'an unknown path is ignored, not an error');
  });
});
