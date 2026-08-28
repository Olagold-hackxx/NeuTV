import { createRouter, ok, created } from '../../platform/http.mjs';
import { createAdminService } from './service.mjs';

export function createAdminRouter(deps) {
  const service = deps.service || createAdminService(deps);
  const r = createRouter('admin');

  r.get('/admin/videos', (req) => ok(service.listVideos({
    status: req.query.status || null,
    productId: req.query.productId || null,
    limit: Number(req.query.limit) || 50,
  })), { auth: 'admin' });

  r.post('/admin/videos',          (req) => created(service.createVideo(req.auth.userId, req.body)), { auth: 'admin' });
  r.get('/admin/videos/:videoId',  (req) => ok(service.getVideo(req.params.videoId)),                { auth: 'admin' });
  r.put('/admin/videos/:videoId',  (req) => ok(service.updateVideo(req.params.videoId, req.body)),   { auth: 'admin' });
  r.del('/admin/videos/:videoId',  (req) => ok(service.archiveVideo(req.params.videoId)),            { auth: 'admin' });

  // Raw binary body: the gateway hands over the request stream untouched.
  r.put('/admin/videos/:videoId/file', async (req) => ok(await service.uploadFile(req.params.videoId, req.raw)), {
    auth: 'admin', raw: true,
  });

  r.get('/admin/programme', (req) => ok(service.programmeWithHistory(Number(req.query.limit) || 20)), { auth: 'admin' });
  r.put('/admin/programme', (req) => ok(service.setProgramme(req.auth.userId, req.body)),             { auth: 'admin' });

  r.get('/admin/crm/overview',   async () => ok(await service.crmOverview()),   { auth: 'admin' });
  r.get('/admin/crm/viewers',    async (req) => ok(await service.crmViewers({ limit: Number(req.query.limit) || 50 })), { auth: 'admin' });
  r.get('/admin/crm/moderation', async (req) => ok(await service.crmModeration({ limit: Number(req.query.limit) || 50 })), { auth: 'admin' });

  // Public: what the stage reverts to, and how the stage resolves a takeover.
  r.get('/programme/current', () => ok(service.currentProgramme()), { auth: 'none' });
  r.get('/videos/:videoId',   (req) => ok(service.publishedVideo(req.params.videoId)), { auth: 'none' });

  return Object.assign(r, { service });
}
