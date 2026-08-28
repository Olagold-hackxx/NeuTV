import { createRouter, ok, created } from '../../platform/http.mjs';
import { createLiveService } from './service.mjs';

export function createLiveRouter(deps) {
  const service = deps.service || createLiveService(deps);
  const hub = deps.hub;
  const r = createRouter('live');

  r.get('/live/state',     async (req) => ok(await service.state(req.auth, { viewerId: req.query.viewerId })), { auth: 'optional' });
  r.get('/live/telemetry', () => ok(service.telemetry()), { auth: 'none' });

  r.get('/live/stage',         async (req) => ok(await service.stage(req.auth, { viewerId: req.query.viewerId })), { auth: 'optional' });
  r.post('/live/stage',        async (req) => ok(await service.takeStage(req.auth, req.body)),   { auth: 'optional', limit: { tokens: 60, windowMs: 60_000 } });
  r.post('/live/stage/revert', async (req) => ok(await service.revertStage(req.auth, req.body)), { auth: 'optional', limit: { tokens: 60, windowMs: 60_000 } });

  r.post('/live/tv/like',  async (req) => ok(await service.toggleLike(req.auth, req.body)), { auth: 'required' });

  r.get('/live/comments',  (req) => ok(service.comments({ limit: Number(req.query.limit) || 30 })), { auth: 'none' });
  r.post('/live/comments', async (req) => created(await service.postComment(req.auth, req.body)), {
    auth: 'required', limit: { tokens: 20, windowMs: 60_000 },
  });

  r.post('/live/reactions', (req) => ok(service.react(req.auth, req.body)), { auth: 'optional', limit: { tokens: 120, windowMs: 60_000 } });
  r.get('/live/reactions',  () => ok(service.reactions()), { auth: 'none' });

  r.get('/live/chat/:serverId/:channelId', (req) => ok(service.chat(req.params.serverId, req.params.channelId, {
    limit: Number(req.query.limit) || 50,
  })), { auth: 'optional' });
  r.post('/live/chat/:serverId/:channelId', async (req) => created(
    await service.postChat(req.auth, req.params.serverId, req.params.channelId, req.body),
  ), { auth: 'required', limit: { tokens: 30, windowMs: 60_000 } });

  r.get('/live/leaderboard', async (req) => ok(await service.leaderboard({ limit: Number(req.query.limit) || 10 })), { auth: 'none' });
  r.post('/live/presence',   (req) => ok(service.presence(req.auth, req.body)), { auth: 'optional', limit: { tokens: 120, windowMs: 60_000 } });

  // SSE. The gateway owns the socket; the route just declares the subscription.
  r.get('/live/stream', (req) => ({
    stream: (write) => hub.subscribe(write, {
      topics: req.query.topics ? req.query.topics.split(',') : ['*'],
      lastEventId: req.headers?.['last-event-id'] ?? null,
    }),
  }), { auth: 'none', stream: true });

  return Object.assign(r, { service });
}
