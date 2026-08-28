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

  // Public: what the stage reverts to, and how the stage resolves a takeover.
  r.get('/programme/current', async () => ok(await service.currentProgramme()), { auth: 'none' });
  r.get('/videos/:videoId',   async (req) => ok(await service.publishedVideo(req.params.videoId)), { auth: 'none' });

  return Object.assign(r, { service });
}
