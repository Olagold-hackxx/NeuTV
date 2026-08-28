import { createRouter, ok, created } from '../../platform/http.mjs';
import { createWalletService } from './service.mjs';

export function createWalletRouter(deps) {
  const service = deps.service || createWalletService(deps);
  const r = createRouter('wallet');

  r.get('/wallet',         (req) => ok(service.balance(req.auth.userId)), { auth: 'required' });
  r.get('/wallet/gifts',   () => ok(service.gifts()),                     { auth: 'none' });
  r.get('/wallet/ledger',  (req) => ok(service.ledger(req.auth.userId, { limit: Number(req.query.limit) || 50 })), { auth: 'required' });
  r.post('/wallet/tip',    (req) => created(service.tip(req.auth.userId, req.body)),    { auth: 'required', limit: { tokens: 30, windowMs: 60_000 } });
  r.post('/wallet/credit', (req) => created(service.credit(req.auth.userId, req.body)), { auth: 'required', limit: { tokens: 10, windowMs: 60_000 } });

  return Object.assign(r, { service });
}
