// Live ingest providers.
//
// Getting video from an admin's encoder onto viewers' screens needs somewhere
// to receive RTMP and something to package HLS. That is infrastructure, not
// application code, so it sits behind a provider the same way object storage
// does - and the default needs no account at all.
//
//   manual (default)  the admin already streams somewhere (OBS -> YouTube Live,
//                     or their own MediaMTX / nginx-rtmp). They paste the public
//                     playback URL and we broadcast it. Zero infrastructure.
//   mux               Mux Video live streams: the API mints an RTMP ingest and
//                     an HLS playback id.
//   cloudflare        Cloudflare Stream live inputs: the same shape.
//
// Every provider returns the same shape, so the admin service never learns
// which one is configured.

import { randomBytes } from 'node:crypto';
import { badRequest, unavailable } from '../../../platform/errors.mjs';

/** A stream key is a bearer credential for an encoder. Treat it like one. */
export const mintStreamKey = () => `nk_${randomBytes(24).toString('base64url')}`;

function manualProvider() {
  return {
    driver: 'manual',
    // Nothing to provision: the admin is already streaming somewhere and only
    // tells us where to point viewers.
    async provision(event) {
      return {
        ingestUrl: null,
        streamKey: null,
        playbackUrl: event.playbackUrl ?? null,
        providerRef: null,
        instructions:
          'Stream to your own destination (OBS to YouTube Live, or your own RTMP server), '
          + 'then paste the public playback URL: an .m3u8 HLS URL, or a YouTube video id.',
      };
    },
    async teardown() { /* nothing was provisioned */ },
  };
}

function muxProvider({ tokenId, tokenSecret, fetchImpl = globalThis.fetch }) {
  const auth = 'Basic ' + Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64');
  const call = async (method, path, body) => {
    const res = await fetchImpl(`https://api.mux.com${path}`, {
      method,
      headers: { authorization: auth, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw unavailable(`Mux refused the request (${res.status}).`, { detail: text.slice(0, 300) });
    return text ? JSON.parse(text) : null;
  };

  return {
    driver: 'mux',
    async provision() {
      const { data } = await call('POST', '/video/v1/live-streams', {
        playback_policy: ['public'],
        new_asset_settings: { playback_policy: ['public'] },
        latency_mode: 'low',
      });
      const playbackId = data.playback_ids?.[0]?.id;
      return {
        ingestUrl: 'rtmps://global-live.mux.com:443/app',
        streamKey: data.stream_key,
        playbackUrl: playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null,
        providerRef: data.id,
        instructions: 'Point your encoder at the RTMP URL above using this stream key.',
      };
    },
    async teardown(providerRef) {
      if (providerRef) await call('DELETE', `/video/v1/live-streams/${providerRef}`);
    },
  };
}

function cloudflareProvider({ accountId, apiToken, fetchImpl = globalThis.fetch }) {
  const call = async (method, path, body) => {
    const res = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
      method,
      headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) throw unavailable(`Cloudflare refused the request (${res.status}).`, { detail: text.slice(0, 300) });
    return text ? JSON.parse(text) : null;
  };

  return {
    driver: 'cloudflare',
    async provision(event) {
      const { result } = await call('POST', '/stream/live_inputs', {
        meta: { name: event.title },
        recording: { mode: 'automatic' },
      });
      return {
        ingestUrl: result.rtmps?.url ?? 'rtmps://live.cloudflare.com:443/live/',
        streamKey: result.rtmps?.streamKey ?? null,
        playbackUrl: result.uid
          ? `https://customer-${accountId}.cloudflarestream.com/${result.uid}/manifest/video.m3u8`
          : null,
        providerRef: result.uid,
        instructions: 'Point your encoder at the RTMPS URL above using this stream key.',
      };
    },
    async teardown(providerRef) {
      if (providerRef) await call('DELETE', `/stream/live_inputs/${providerRef}`);
    },
  };
}

/**
 * MediaMTX running alongside the API, usually in the same compose file.
 *
 * The one self-hosted option: a single Go binary that accepts RTMP from OBS and
 * republishes it as HLS. Nothing is provisioned over an API because MediaMTX
 * creates a path the moment something publishes to it - so "provisioning" is
 * deciding the path name, and the stream key IS that name. Which means the key
 * has to be unguessable: anyone who can publish to a path owns the broadcast.
 */
function mediamtxProvider({ rtmpUrl, hlsBase, whipBase }) {
  return {
    driver: 'mediamtx',
    async provision() {
      const path = `live-${mintStreamKey().slice(3).toLowerCase()}`;
      return {
        ingestUrl: rtmpUrl.replace(/\/$/, ''),
        streamKey: path,
        // WHIP lets the studio publish straight from the browser, which is what
        // makes sub-second ingest possible: a peer connection sends frames as
        // they are captured, where MediaRecorder could not send a chunk until
        // it had finished recording it.
        whipUrl: whipBase ? `${whipBase.replace(/\/$/, '')}/${path}/whip` : null,
        playbackUrl: `${hlsBase.replace(/\/$/, '')}/${path}/index.m3u8`,
        providerRef: path,
        instructions:
          `In OBS: Settings -> Stream -> Custom, Server "${rtmpUrl.replace(/\/$/, '')}", `
          + 'Stream Key as shown. Viewers get HLS a few seconds behind.',
      };
    },
    // A MediaMTX path exists only while something is publishing to it, so there
    // is nothing to release. Ending the event stops it being served.
    async teardown() { /* nothing was allocated */ },
  };
}

export function createIngestProvider(env = process.env) {
  const driver = (env.NEUTV_LIVE_DRIVER || 'manual').toLowerCase();

  if (driver === 'mediamtx') {
    if (!env.NEUTV_MEDIAMTX_RTMP_URL || !env.NEUTV_MEDIAMTX_HLS_BASE) {
      throw new Error('NEUTV_LIVE_DRIVER=mediamtx needs NEUTV_MEDIAMTX_RTMP_URL and NEUTV_MEDIAMTX_HLS_BASE');
    }
    return mediamtxProvider({
      rtmpUrl: env.NEUTV_MEDIAMTX_RTMP_URL,
      hlsBase: env.NEUTV_MEDIAMTX_HLS_BASE,
      whipBase: env.NEUTV_MEDIAMTX_WHIP_BASE,
    });
  }

  if (driver === 'mux') {
    if (!env.NEUTV_MUX_TOKEN_ID || !env.NEUTV_MUX_TOKEN_SECRET) {
      throw new Error('NEUTV_LIVE_DRIVER=mux needs NEUTV_MUX_TOKEN_ID and NEUTV_MUX_TOKEN_SECRET');
    }
    return muxProvider({ tokenId: env.NEUTV_MUX_TOKEN_ID, tokenSecret: env.NEUTV_MUX_TOKEN_SECRET });
  }
  if (driver === 'cloudflare') {
    if (!env.NEUTV_CF_ACCOUNT_ID || !env.NEUTV_CF_API_TOKEN) {
      throw new Error('NEUTV_LIVE_DRIVER=cloudflare needs NEUTV_CF_ACCOUNT_ID and NEUTV_CF_API_TOKEN');
    }
    return cloudflareProvider({ accountId: env.NEUTV_CF_ACCOUNT_ID, apiToken: env.NEUTV_CF_API_TOKEN });
  }
  if (driver !== 'manual') throw new Error(`Unknown NEUTV_LIVE_DRIVER "${driver}".`);
  return manualProvider();
}

/** A playback target has to be something a player can actually open. */
export function validatePlayback(url) {
  if (!url) return null;
  const value = String(url).trim();
  // A bare YouTube id is accepted because the viewer app already embeds those.
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return { kind: 'youtube', youtubeId: value, playbackUrl: null };
  if (!/^https:\/\//.test(value)) throw badRequest('Playback URL must be https, or a YouTube video id.');
  return { kind: value.includes('.m3u8') ? 'hls' : 'file', youtubeId: null, playbackUrl: value };
}
