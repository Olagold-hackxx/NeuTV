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

  return Object.assign(r, { service });
}
