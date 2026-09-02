import { createRouter, ok, created } from '../../platform/http.mjs';

export function createWalletRouter(deps) {
  const service = deps.service;
  const r = createRouter('wallet');

  r.get('/wallet',         async (req) => ok(await service.balance(req.auth.userId)), { auth: 'required' });
  r.get('/wallet/gifts',   () => ok(service.gifts()),                     { auth: 'none' });
  r.get('/wallet/ledger',  async (req) => ok(await service.ledger(req.auth.userId, { limit: Number(req.query.limit) || 50 })), { auth: 'required' });
  r.post('/wallet/tip',    async (req) => created(await service.tip(req.auth.userId, req.body)),    { auth: 'required', limit: { tokens: 30, windowMs: 60_000 } });
  r.post('/wallet/credit', async (req) => created(await service.credit(req.auth.userId, req.body)), { auth: 'required', limit: { tokens: 10, windowMs: 60_000 } });

  // Subscriptions: charged from the KashCoin balance through the same ledger
  // as everything else. The plan catalog rides along on the status read so a
  // portal can render prices without a second endpoint.
  r.post('/subscriptions',   async (req) => created(await service.subscribe(req.auth.userId, req.body)), { auth: 'required', limit: { tokens: 10, windowMs: 60_000 } });
  r.get('/subscriptions/me', async (req) => ok(await service.subscriptionStatus(req.auth.userId)),       { auth: 'required' });

  return Object.assign(r, { service });
}
