import { createRouter, ok } from '../../platform/http.mjs';
import { createCatalogService } from './service.mjs';

export function createCatalogRouter(deps) {
  const service = deps.service || createCatalogService(deps);
  const r = createRouter('catalog');

  r.get('/catalog/bootstrap',   () => ok(service.bootstrap()),        { auth: 'none' });
  r.get('/catalog/products',    () => ok(service.products()),         { auth: 'none' });
  r.get('/catalog/hubs',        () => ok(service.hubs()),             { auth: 'none' });
  r.get('/catalog/hubs/:hubId', (req) => ok(service.hub(req.params.hubId)), { auth: 'none' });
  r.get('/catalog/spotlights',  () => ok(service.spotlights()),       { auth: 'none' });
  r.get('/catalog/media-rows',  () => ok(service.mediaRows()),        { auth: 'none' });
  r.get('/catalog/platforms',   () => ok(service.platforms()),        { auth: 'none' });
  r.get('/catalog/schedule',    () => ok(service.schedule()),         { auth: 'none' });
  r.get('/catalog/vod',         () => ok(service.vod()),              { auth: 'none' });
  r.get('/catalog/trending',    () => ok(service.trending()),         { auth: 'none' });
  r.get('/catalog/hashtags',    () => ok(service.hashtags()),         { auth: 'none' });
  r.get('/catalog/search',      (req) => ok(service.search(req.query.q, {
    limit: Math.min(Number(req.query.limit) || 20, 50),
  })), { auth: 'none', limit: { tokens: 60, windowMs: 60_000 } });

  return Object.assign(r, { service });
}
