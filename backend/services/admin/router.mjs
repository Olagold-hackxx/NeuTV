import { createRouter, ok, created } from '../../platform/http.mjs';

export function createAdminRouter(deps) {
  const service = deps.service;
  const r = createRouter('admin');

  r.get('/admin/videos', async (req) => ok(await service.listVideos({
    status: req.query.status || null,
    productId: req.query.productId || null,
    limit: Number(req.query.limit) || 50,
  })), { auth: 'admin' });

  r.post('/admin/videos',          async (req) => created(await service.createVideo(req.auth.userId, req.body)), { auth: 'admin' });
  r.get('/admin/videos/:videoId',  async (req) => ok(await service.getVideo(req.params.videoId)),                { auth: 'admin' });
  r.put('/admin/videos/:videoId',  async (req) => ok(await service.updateVideo(req.params.videoId, req.body)),   { auth: 'admin' });
  r.del('/admin/videos/:videoId',  async (req) => ok(await service.archiveVideo(req.params.videoId)),            { auth: 'admin' });

  // Raw binary body: the gateway hands over the request stream untouched.
  r.put('/admin/videos/:videoId/file', async (req) => ok(await service.uploadFile(req.params.videoId, req.raw)), {
    auth: 'admin', raw: true,
  });

  r.get('/admin/programme', async (req) => ok(await service.programmeWithHistory(Number(req.query.limit) || 20)), { auth: 'admin' });
  r.put('/admin/programme', async (req) => ok(await service.setProgramme(req.auth.userId, req.body)),             { auth: 'admin' });

  r.get('/admin/crm/overview',   async () => ok(await service.crmOverview()),   { auth: 'admin' });
  r.get('/admin/crm/viewers',    async (req) => ok(await service.crmViewers({ limit: Number(req.query.limit) || 50 })), { auth: 'admin' });
  r.get('/admin/crm/moderation', async (req) => ok(await service.crmModeration({ limit: Number(req.query.limit) || 50 })), { auth: 'admin' });

  // --- live events -------------------------------------------------------
  r.get('/admin/live-events',                 async (req) => ok(await service.liveEvents.list({
    status: req.query.status || null, limit: Number(req.query.limit) || 50,
  })), { auth: 'admin' });
  r.post('/admin/live-events',                async (req) => created(await service.liveEvents.create(req.auth.userId, req.body)), { auth: 'admin' });
  r.get('/admin/live-events/:eventId',        async (req) => ok(await service.liveEvents.get(req.params.eventId)), { auth: 'admin' });
  r.put('/admin/live-events/:eventId',        async (req) => ok(await service.liveEvents.update(req.params.eventId, req.body)), { auth: 'admin' });
  r.post('/admin/live-events/:eventId/start', async (req) => ok(await service.liveEvents.start(req.params.eventId)), { auth: 'admin' });
  r.post('/admin/live-events/:eventId/stop',  async (req) => ok(await service.liveEvents.stop(req.params.eventId, req.body ?? {})), { auth: 'admin' });
  r.post('/admin/live-events/:eventId/rotate', async (req) => ok(await service.liveEvents.rotateKey(req.params.eventId)), { auth: 'admin' });
  r.del('/admin/live-events/:eventId',        async (req) => ok(await service.liveEvents.cancel(req.params.eventId)), { auth: 'admin' });

  // Public: never carries the stream key.
  r.get('/live-event/current', async () => ok(await service.liveEvents.current()), { auth: 'none' });

  // Public: what the stage reverts to, and how the stage resolves a takeover.
  r.get('/programme/current', async () => ok(await service.currentProgramme()), { auth: 'none' });
  r.get('/videos/:videoId',   async (req) => ok(await service.publishedVideo(req.params.videoId)), { auth: 'none' });

  return Object.assign(r, { service });
}
