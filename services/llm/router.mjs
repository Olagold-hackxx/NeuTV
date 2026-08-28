import { createRouter, ok } from '../../platform/http.mjs';
import { createLlmService } from './service.mjs';

export function createLlmRouter(deps) {
  const service = deps.service || createLlmService(deps);
  const r = createRouter('llm');

  r.get('/llm/health', () => ok(service.health()), { auth: 'none' });
  // Latent-space calls are metered: they cost real tokens on the host machine.
  r.post('/llm/complete', async (req) => ok(await service.complete(req.body)), {
    auth: 'required', limit: { tokens: 20, windowMs: 60_000 },
  });

  return Object.assign(r, { service });
}
