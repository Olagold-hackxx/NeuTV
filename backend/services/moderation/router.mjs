import { createRouter, ok } from '../../platform/http.mjs';


export function createModerationRouter(deps) {
  const service = deps.service;
  const r = createRouter('moderation');

  r.post('/moderation/check', async (req) => ok(await service.check(req.body, { userId: req.auth?.userId })), {
    auth: 'optional', limit: { tokens: 120, windowMs: 60_000 },
  });
  r.get('/moderation/health', async () => ok(await service.health()), { auth: 'none' });

  return Object.assign(r, { service });
}
