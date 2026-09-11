import { createRouter, ok, created } from '../../platform/http.mjs';

export function createIdentityRouter(deps) {
  const service = deps.service;
  const r = createRouter('identity');
  const AUTH_LIMIT = { tokens: 10, windowMs: 60_000 };

  r.get('/identity/providers',          () => ok(service.providers()), { auth: 'none' });
  r.get('/identity/consent/:productId',  (req) => ok(service.consent(req.params.productId)), { auth: 'none' });
  r.post('/identity/sso',                async (req) => created(await service.sso(req.body)),    { auth: 'none', limit: AUTH_LIMIT });
  r.post('/identity/signup',             async (req) => created(await service.signup(req.body)), { auth: 'none', limit: AUTH_LIMIT });
  r.post('/identity/signin',             async (req) => ok(await service.signin(req.body)),      { auth: 'none', limit: AUTH_LIMIT });
  r.post('/identity/logout',             async (req) => ok(await service.logout(req.auth)),      { auth: 'required' });
  r.get('/identity/me',                  (req) => ok(service.me(req.auth)),          { auth: 'required' });
  r.get('/identity/session',             (req) => ok(service.session(req.auth)),     { auth: 'optional' });

  // Creators are approved from the back office, never self-appointed.
  r.put('/admin/creators/:userId', async (req) => ok(await service.setRole(req.params.userId, req.body?.role)), { auth: 'admin' });

  // The press desk: apply with a passport, get verified by the network.
  r.post('/press/apply',          async (req) => created(await service.applyPress(req.auth, req.body)), { auth: 'required', limit: AUTH_LIMIT });
  r.get('/press/me',              async (req) => ok(await service.pressStatus(req.auth)), { auth: 'required' });
  r.get('/admin/press',           async (req) => ok(await service.adminListPress({
    status: req.query.status || null, limit: Number(req.query.limit) || 50,
  })), { auth: 'admin' });
  r.put('/admin/press/:userId',   async (req) => ok(await service.adminReviewPress(req.auth.userId, req.params.userId, req.body)), { auth: 'admin' });

  return Object.assign(r, { service });
}
