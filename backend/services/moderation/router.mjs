import { createRouter, ok } from '../../platform/http.mjs';
import { createModerationService } from './service.mjs';

export function createModerationRouter(deps) {
  const service = deps.service || createModerationService(deps);
  const r = createRouter('moderation');

  r.post('/moderation/check', (req) => ok(service.check(req.body, { userId: req.auth?.userId })), {
    auth: 'optional', limit: { tokens: 120, windowMs: 60_000 },
  });
  r.get('/moderation/health', () => ok(service.health()), { auth: 'none' });

  return Object.assign(r, { service });
}
