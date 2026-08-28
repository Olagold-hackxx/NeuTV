import { createRouter, ok, created } from '../../platform/http.mjs';
import { createSocialService } from './service.mjs';

export function createSocialRouter(deps) {
  const service = deps.service || createSocialService(deps);
  const r = createRouter('social');

  r.get('/social/posts', (req) => ok(service.feed(req.auth, {
    productId: req.query.product || req.query.productId || null,
    limit: Number(req.query.limit) || 20,
    cursor: req.query.cursor || null,
  })), { auth: 'optional' });

  r.post('/social/posts', async (req) => created(await service.create(req.auth, req.body)), {
    auth: 'required', limit: { tokens: 10, windowMs: 60_000 },
  });

  r.get('/social/posts/:postId',           (req) => ok(service.post(req.auth, req.params.postId)), { auth: 'optional' });
  r.post('/social/posts/:postId/upvote',   (req) => ok(service.toggleUpvote(req.auth, req.params.postId)), { auth: 'required' });
  r.post('/social/posts/:postId/save',     (req) => ok(service.toggleSave(req.auth, req.params.postId)), { auth: 'required' });
  r.post('/social/posts/:postId/share',    (req) => ok(service.share(req.auth, req.params.postId, { origin: req.body?.origin ?? '' })), { auth: 'optional' });
  r.get('/social/posts/:postId/comments',  (req) => ok(service.comments(req.auth, req.params.postId, { limit: Number(req.query.limit) || 50 })), { auth: 'optional' });
  r.post('/social/posts/:postId/comments', async (req) => created(await service.comment(req.auth, req.params.postId, req.body)), {
    auth: 'required', limit: { tokens: 20, windowMs: 60_000 },
  });

  r.post('/social/follows/:handle', (req) => ok(service.toggleFollow(req.auth, req.params.handle)), { auth: 'required' });
  r.get('/social/follows',          (req) => ok(service.follows(req.auth)), { auth: 'required' });

  return Object.assign(r, { service });
}
