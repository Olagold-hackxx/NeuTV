// Live service: the 24/7 central stage and everything overlaid on it.
//
// The stage is the interesting part. The main broadcast comes from the admin
// service through the contract (falling back to the seeded Central TV programme
// before an admin has set one). A click on any other video writes a takeover
// row with an expiry; every read resolves against the clock and returns to the
// main broadcast the moment the takeover is over. See stage.mjs.

import { validate } from '../../platform/validate.mjs';
import { notFound, badRequest, forbidden, unauthorized } from '../../platform/errors.mjs';
import { resolveStage, takeoverDuration } from './stage.mjs';

const PRESENCE_WINDOW_MS = 45_000;
const REACTION_EMOJIS = ['❤️', '🔥', '👏', '🎉', '🚀', '⭐', '💖', '💎', '🎁', '👑', '🏆', '⚡', '🏎️'];

const VIEWER_KEY = /^[A-Za-z0-9_-]{4,64}$/;

export function createLiveService({
  runtime,
  store,
  catalog,                          // contract client or service handle
  programmeClient = null,           // contract client for admin's /programme/current
  socialClient = null,              // contract client for social's /social/posts/:id
  moderation = null,                // contract client for /moderation/check
  giftPort = null,                  // wallet read port for the leaderboard
  hub = { publish: () => {}, clientCount: () => 0 },
  startedAt = null,
}) {
  const bootedAt = startedAt ?? runtime.now();

  // --- stage ------------------------------------------------------------

  // Resolve any clickable thing in the product to a playable stage card.
  const resolveVideo = async (videoId) => {
    const spotlight = catalog.spotlight?.(videoId);
    if (spotlight) {
      return {
        id: spotlight.id, title: spotlight.title, kind: 'spotlight',
        productId: spotlight.productId, product: spotlight.product,
        streamer: spotlight.name, handle: spotlight.handle, avatar: spotlight.avatar,
        videoUrl: spotlight.videoMp4, youtubeId: spotlight.videoUrl,
        posterUrl: spotlight.thumbnail, duration: spotlight.duration,
        durationSeconds: parseClock(spotlight.duration),
      };
    }
    const media = catalog.mediaItem?.(videoId);
    if (media) {
      return {
        id: media.id, title: media.title, kind: 'media',
        productId: media.productId, product: media.productName,
        streamer: media.influencer, avatar: media.avatar,
        posterUrl: media.thumbnail, duration: media.duration,
        durationSeconds: parseClock(media.duration),
      };
    }
    const vod = catalog.vodItem?.(videoId);
    if (vod) {
      return {
        id: vod.id, title: vod.title, kind: 'vod',
        productId: vod.platformId, product: vod.platform,
        videoUrl: vod.videoUrl, posterUrl: vod.thumbnail,
        duration: vod.duration, durationSeconds: parseClock(vod.duration),
      };
    }
    // A video attached to an announcement post. Clicking one in the feed puts
    // it on the main stage, so the stage has to be able to resolve a post id
    // the same way it resolves a spotlight.
    if (socialClient) {
      const res = await socialClient.call('social', 'GET', `/social/posts/${videoId}`, {});
      if (res.status === 200 && res.body?.post) {
        const p = res.body.post;
        // A post with nothing to play is not a stage candidate.
        if (p.videoMp4 || p.youtubeId) {
          return {
            id: p.id,
            title: p.videoTitle || p.content?.slice(0, 80) || 'Announcement',
            kind: 'post',
            productId: p.productId,
            product: p.productName,
            streamer: p.author,
            handle: p.handle,
            avatar: p.avatar,
            videoUrl: p.videoMp4,
            youtubeId: p.youtubeId,
            posterUrl: p.mediaUrl,
            duration: p.duration,
            durationSeconds: parseClock(p.duration),
            description: p.content,
          };
        }
      }
    }

    // Admin-uploaded videos, through the PUBLIC video route. Using the
    // admin-only route here worked in-process (loopback does not run the
    // gateway's auth gate) but would 403 as soon as the services were split
    // across hosts.
    if (programmeClient) {
      const res = await programmeClient.call('admin', 'GET', `/videos/${videoId}`, {});
      if (res.status === 200 && res.body?.video) {
        const v = res.body.video;
        return {
          id: v.id, title: v.title, kind: 'upload', productId: v.productId,
          videoUrl: v.playbackUrl, youtubeId: v.youtubeId, posterUrl: v.posterUrl,
          durationSeconds: v.durationSeconds,
        };
      }
    }
    return null;
  };

  // The main broadcast. Admin's programme wins; the seeded Central TV entry is
  // the fallback so the page is never empty on a fresh install.
  const mainBroadcast = async () => {
    if (programmeClient) {
      try {
        const res = await programmeClient.call('admin', 'GET', '/programme/current', {});
        if (res.status === 200 && res.body?.video) {
          const v = res.body.video;
          return {
            id: v.id, title: v.title, kind: 'programme', productId: v.productId,
            videoUrl: v.playbackUrl, youtubeId: v.youtubeId, posterUrl: v.posterUrl,
            durationSeconds: v.durationSeconds, description: v.description,
            source: 'admin', setAt: res.body.programme?.setAt ?? null,
          };
        }
      } catch { /* fall through to the seed */ }
    }
    const seed = catalog.centralTv();
    return {
      id: seed.id, title: seed.title, kind: 'programme', productId: seed.productId,
      product: seed.product, streamer: seed.streamer, streamerRole: seed.streamerRole,
      avatar: seed.avatar, videoUrl: seed.videoUrl, youtubeId: seed.youtubeId,
      posterUrl: seed.posterUrl, description: seed.description, banner: seed.banner,
      campaignCta: seed.campaignCta, campaignUrl: seed.campaignUrl,
      isLive: seed.isLive, durationSeconds: 0, source: 'seed',
    };
  };

  const viewerKeyFor = (auth, provided) => {
    if (auth?.userId) return `user:${auth.userId}`;
    if (provided && VIEWER_KEY.test(provided)) return `anon:${provided}`;
    return null;
  };

  const loadOverrides = async (viewerKey) => {
    const now = runtime.now();
    // Lazy sweep: expired rows are dead weight, not state.
    await store.run('DELETE FROM stage_overrides WHERE expires_at <= ?', now);
    const read = async (key) => {
      const row = await store.get('SELECT * FROM stage_overrides WHERE key = ?', key);
      if (!row) return null;
      return {
        videoId: row.video_id, video: JSON.parse(row.video_json), scope: row.scope,
        startedAt: row.started_at, expiresAt: row.expires_at, requestedBy: row.requested_by,
      };
    };
    return {
      viewer: viewerKey ? await read(`viewer:${viewerKey}`) : null,
      broadcast: await read('broadcast'),
    };
  };

  // Always an options object, never a bare viewerId. A mixed convention here
  // already cost one silent bug where the object was tested against the
  // viewer-key regex and every lookup quietly resolved to the main broadcast.
  const stageFor = async (auth, { viewerId = null } = {}) => {
    const viewerKey = viewerKeyFor(auth, viewerId);
    const base = await mainBroadcast();
    return resolveStage({ base, overrides: await loadOverrides(viewerKey), now: runtime.now() });
  };

  // --- telemetry ---------------------------------------------------------

  const liveViewers = async () =>
    (await store.get('SELECT COUNT(*) AS n FROM presence WHERE last_seen > ?', runtime.now() - PRESENCE_WINDOW_MS)).n;

  const telemetry = async () => {
    const seed = catalog.centralTv();
    return {
      onAir: true,
      resolution: '1080p HD',
      // A real measurement from presence heartbeats.
      viewers: await liveViewers(),
      // Seed content shipped with the catalog, kept separate so nobody mistakes
      // it for a measurement.
      baselineViewers: seed.viewers ?? 0,
      subscribers: hub.clientCount(),
      uptimeMs: runtime.now() - bootedAt,
      at: runtime.now(),
    };
  };

  // --- moderation gate ---------------------------------------------------

  const gate = async (text, surface, userId) => {
    if (!moderation) return { verdict: 'allow', allowed: true, needsReview: false };
    const res = await moderation.call('moderation', 'POST', '/moderation/check', {
      body: { text, surface }, auth: userId ? { userId } : null,
    });
    if (res.status !== 200) return { verdict: 'allow', allowed: true, needsReview: false };
    return res.body;
  };

  return {
    async state(auth, { viewerId = null } = {}) {
      const stage = await stageFor(auth, { viewerId });
      const videoId = stage.current?.id;
      const [tele, likes, liked] = await Promise.all([
        telemetry(),
        store.get('SELECT COUNT(*) AS n FROM tv_likes WHERE video_id = ?', videoId ?? ''),
        auth ? store.get('SELECT 1 AS x FROM tv_likes WHERE user_id = ? AND video_id = ?', auth.userId, videoId ?? '') : null,
      ]);
      return {
        stage,
        telemetry: tele,
        likes: {
          total: likes.n,
          seeded: catalog.centralTv().likes ?? 0,
          liked: Boolean(liked),
        },
      };
    },

    telemetry,

    stage: (auth, opts = {}) => stageFor(auth, opts),

    // Click a video: it takes the stage, and the stage returns to the main
    // broadcast when it ends.
    async takeStage(auth, input) {
      const { videoId, scope, viewerId, durationMs } = validate(input, {
        videoId: { type: 'string', required: true, max: 80 },
        scope: { type: 'string', required: false, default: 'viewer', enum: ['viewer', 'broadcast'] },
        viewerId: { type: 'string', required: false, max: 64 },
        durationMs: { type: 'int', required: false, min: 1000, max: 4 * 60 * 60 * 1000 },
      });

      // A global promote changes what every viewer sees, so it is not something
      // an anonymous click can do.
      if (scope === 'broadcast' && auth?.role !== 'admin' && !auth?.scopes?.includes('broadcast:promote')) {
        throw forbidden('Promoting to the Central TV stage requires broadcast rights.');
      }

      const viewerKey = viewerKeyFor(auth, viewerId);
      if (scope === 'viewer' && !viewerKey) {
        throw badRequest('Send a viewerId (4-64 chars, A-Za-z0-9_-) or sign in to take the stage.');
      }

      const video = await resolveVideo(videoId);
      if (!video) throw notFound(`No playable video "${videoId}".`);

      const now = runtime.now();
      const ttl = takeoverDuration(video.durationSeconds, durationMs ?? null);
      const key = scope === 'broadcast' ? 'broadcast' : `viewer:${viewerKey}`;
      await store.run(
        `INSERT INTO stage_overrides (key, scope, video_id, video_json, started_at, expires_at, requested_by)
         VALUES (?,?,?,?,?,?,?)
         ON CONFLICT(key) DO UPDATE SET scope=excluded.scope, video_id=excluded.video_id,
           video_json=excluded.video_json, started_at=excluded.started_at,
           expires_at=excluded.expires_at, requested_by=excluded.requested_by`,
        key, scope, videoId, JSON.stringify(video), now, now + ttl, auth?.userId ?? null,
      );

      const stage = await stageFor(auth, { viewerId });
      if (scope === 'broadcast') hub.publish('stage', { scope, video, revertsAt: now + ttl });
      return stage;
    },

    // Called when the video finishes early, or when the viewer closes it.
    async revertStage(auth, input) {
      const { scope, viewerId } = validate(input ?? {}, {
        scope: { type: 'string', required: false, default: 'viewer', enum: ['viewer', 'broadcast'] },
        viewerId: { type: 'string', required: false, max: 64 },
      });
      if (scope === 'broadcast' && auth?.role !== 'admin' && !auth?.scopes?.includes('broadcast:promote')) {
        throw forbidden('Ending a Central TV promote requires broadcast rights.');
      }
      const viewerKey = viewerKeyFor(auth, viewerId);
      const key = scope === 'broadcast' ? 'broadcast' : `viewer:${viewerKey}`;
      await store.run('DELETE FROM stage_overrides WHERE key = ?', key);
      if (scope === 'broadcast') hub.publish('stage', { scope, reverted: true });
      return stageFor(auth, { viewerId });
    },

    // --- overlays --------------------------------------------------------

    async postComment(auth, input) {
      if (!auth) throw unauthorized('Sign in to comment on the live stream.');
      const { text } = validate(input, { text: { type: 'string', required: true, min: 1, max: 280 } });
      const decision = await gate(text, 'live_comment', auth.userId);
      if (!decision.allowed) {
        throw badRequest('That message was blocked by moderation.', {
          reasons: (decision.matches || []).map((m) => m.reason),
        });
      }
      const id = `lc_${runtime.uuid()}`;
      await store.run(
        'INSERT INTO comments (id, user_id, author, handle, avatar, badge, text, flagged, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        id, auth.userId, auth.user.name, auth.user.handle, auth.user.avatar, auth.user.badge,
        text, decision.needsReview ? 1 : 0, runtime.now(),
      );
      const comment = {
        id, author: auth.user.name, handle: auth.user.handle, avatar: auth.user.avatar,
        badge: auth.user.badge, text, at: runtime.now(), flagged: decision.needsReview,
      };
      hub.publish('comment', comment);
      return { comment, moderation: { verdict: decision.verdict, needsReview: decision.needsReview } };
    },

    async comments({ limit = 30 } = {}) {
      const rows = await store.all(
        `SELECT id, author, handle, avatar, badge, text, created_at AS at, flagged
         FROM comments ORDER BY created_at DESC LIMIT ?`, Math.min(limit, 100),
      );
      // Before anyone has spoken, the ticker shows the seeded ambient chatter
      // the frontend already renders.
      if (!rows.length) {
        return {
          comments: catalog.liveCommentSeeds().map((c) => ({
            id: `seed-${c.id}`, author: c.author, badge: c.badge, text: c.text,
            avatar: c.avatar, at: bootedAt, seeded: true,
          })),
          seeded: true,
        };
      }
      return { comments: rows, seeded: false };
    },

    async react(auth, input) {
      const { emoji } = validate(input, { emoji: { type: 'string', required: true, max: 8 } });
      if (!REACTION_EMOJIS.includes(emoji)) {
        throw badRequest('That reaction is not on the broadcast palette.', { allowed: REACTION_EMOJIS });
      }
      await store.run(
        'INSERT INTO reactions (emoji, total) VALUES (?, 1) ON CONFLICT(emoji) DO UPDATE SET total = reactions.total + 1',
        emoji,
      );
      const total = (await store.get('SELECT total FROM reactions WHERE emoji = ?', emoji)).total;
      hub.publish('reaction', { emoji, total, at: runtime.now() });
      return { emoji, total };
    },

    async reactions() {
      return {
        palette: REACTION_EMOJIS,
        totals: await store.all('SELECT emoji, total FROM reactions ORDER BY total DESC'),
      };
    },

    async toggleLike(auth, input) {
      if (!auth) throw unauthorized();
      const stage = await stageFor(auth, { viewerId: input?.viewerId ?? null });
      const videoId = stage.current?.id ?? 'main';
      const existing = await store.get('SELECT 1 AS x FROM tv_likes WHERE user_id = ? AND video_id = ?', auth.userId, videoId);
      if (existing) await store.run('DELETE FROM tv_likes WHERE user_id = ? AND video_id = ?', auth.userId, videoId);
      else await store.run('INSERT INTO tv_likes (user_id, video_id, created_at) VALUES (?,?,?)', auth.userId, videoId, runtime.now());
      const total = (await store.get('SELECT COUNT(*) AS n FROM tv_likes WHERE video_id = ?', videoId)).n;
      return { videoId, liked: !existing, total, seeded: catalog.centralTv().likes ?? 0 };
    },

    async postChat(auth, serverId, channelId, input) {
      if (!auth) throw unauthorized('Sign in to post in a community hub.');
      if (!catalog.hasChannel(serverId, channelId)) throw notFound(`No channel "${channelId}" in hub "${serverId}".`);
      const { text } = validate(input, { text: { type: 'string', required: true, min: 1, max: 500 } });
      const decision = await gate(text, 'chat', auth.userId);
      if (!decision.allowed) {
        throw badRequest('That message was blocked by moderation.', {
          reasons: (decision.matches || []).map((m) => m.reason),
        });
      }
      const id = `msg_${runtime.uuid()}`;
      await store.run(
        'INSERT INTO chat_messages (id, server_id, channel_id, user_id, author, avatar, text, flagged, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        id, serverId, channelId, auth.userId, auth.user.name, auth.user.avatar, text,
        decision.needsReview ? 1 : 0, runtime.now(),
      );
      const message = { id, serverId, channelId, author: auth.user.name, avatar: auth.user.avatar, text, at: runtime.now() };
      hub.publish('chat', message);
      return { message, moderation: { verdict: decision.verdict, needsReview: decision.needsReview } };
    },

    async chat(serverId, channelId, { limit = 50 } = {}) {
      if (!catalog.hasChannel(serverId, channelId)) throw notFound(`No channel "${channelId}" in hub "${serverId}".`);
      return {
        serverId, channelId,
        messages: await store.all(
          `SELECT id, author, avatar, text, created_at AS at, flagged
           FROM chat_messages WHERE server_id = ? AND channel_id = ?
           ORDER BY created_at ASC LIMIT ?`, serverId, channelId, Math.min(limit, 200),
        ),
      };
    },

    async leaderboard({ limit = 10 } = {}) {
      const stage = await stageFor(null, {});
      const target = { type: 'stream', id: stage.mainBroadcast?.id ?? 'main' };
      const rows = giftPort?.topGifters ? await giftPort.topGifters(target, { limit }) : [];
      return { target, leaders: rows, generatedAt: runtime.now() };
    },

    async presence(auth, input) {
      const { viewerId } = validate(input ?? {}, { viewerId: { type: 'string', required: false, max: 64 } });
      const key = viewerKeyFor(auth, viewerId);
      if (!key) throw badRequest('Send a viewerId (4-64 chars, A-Za-z0-9_-) or sign in.');
      const now = runtime.now();
      await store.run(
        'INSERT INTO presence (viewer_key, user_id, last_seen) VALUES (?,?,?) ON CONFLICT(viewer_key) DO UPDATE SET last_seen = excluded.last_seen, user_id = excluded.user_id',
        key, auth?.userId ?? null, now,
      );
      await store.run('DELETE FROM presence WHERE last_seen < ?', now - PRESENCE_WINDOW_MS * 4);
      return { counted: true, viewers: await liveViewers(), windowMs: PRESENCE_WINDOW_MS };
    },

    // Wallet emits gift events here through the composition root.
    onGift(payload) { hub.publish('gift', payload); },

    close: () => store.close(),
  };
}

// "04:12" -> 252. Duplicated deliberately from admin's parseDuration: the two
// services must not import each other, and a four-line pure function is a
// cheaper price than a coupling.
function parseClock(value) {
  const parts = String(value ?? '').trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((total, n) => total * 60 + n, 0);
}
