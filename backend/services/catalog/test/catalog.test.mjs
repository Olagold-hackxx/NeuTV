import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService, loadSeed } from '../service.mjs';
import { resolveSchedule } from '../schedule.mjs';
import { searchCatalog } from '../search.mjs';
import { CONTRACT_VERSION } from '../../../contracts/version.mjs';
import { readFileSync } from 'node:fs';

const build = (over = {}) => createCatalogService({ runtime: fakeRuntime(), ...over });

test('bootstrap carries every key the frontend reads from window.CentralData', () => {
  const data = build().bootstrap();
  for (const key of ['PRODUCTS', 'PRODUCT_COMMUNITY_HUBS', 'CREATOR_SPOTLIGHTS', 'INITIAL_MEDIA_ROWS',
    'INITIAL_POSTS', 'PLATFORMS', 'SCHEDULE_ITEMS', 'INITIAL_CENTRAL_TV', 'VOD_LIBRARY',
    'HASHTAG_FEEDS', 'AGGREGATED_HASHTAG_POSTS', 'SAMPLE_LIVE_COMMENTS', 'TRENDING_TOPICS']) {
    assert.ok(data[key], `bootstrap is missing ${key}`);
  }
  assert.equal(data.PRODUCTS.length, 6, 'the five ecosystem products plus the network itself');
});

test('bootstrap reports the API contract version, not the seed version', () => {
  const data = build().bootstrap();
  assert.equal(data.contractVersion, CONTRACT_VERSION, 'must match /health');
  assert.ok(data.seedVersion, 'the seed keeps its own version, under its own name');
  assert.ok(data.checksum, 'and its checksum, so content drift is visible');
});

test('the product ids are the ecosystem the PRD names, plus the network', () => {
  // "neutv" is not one of the five ecosystem products: it is NEU TV itself, so
  // a video made by the network has somewhere to belong instead of being filed
  // under whichever product happens to be first in the list.
  assert.deepEqual(build().productIds().sort(), ['ark', 'linkpay', 'market', 'neutv', 'tsioncars', 'worldstreet']);
});

test('logo paths point at real brand assets, not placeholders', () => {
  const withLogos = build().products().products.filter((p) => p.logo.startsWith('./assets/'));
  assert.ok(withLogos.length >= 3, 'the seed should carry the shipped brand logos');
});

test('every community hub id is either a product or a known standalone hub', () => {
  // The seed ships a "tsion" hub (TSION General) that is NOT one of the five
  // ecosystem products. The frontend used to default new posts to that id, so
  // every post would have failed product validation the moment the UI was
  // wired to the API. Hubs and products are different namespaces; this pins it.
  const catalog = build();
  const productIds = catalog.productIds();
  const hubIds = Object.keys(catalog.hubs().hubs);
  const standalone = hubIds.filter((h) => !productIds.includes(h));
  assert.deepEqual(standalone, ['tsion'], 'a new standalone hub needs a decision, not a silent 400');
  for (const id of productIds) {
    assert.ok(hubIds.includes(id), `product ${id} has no community hub`);
  }
});

test('the id the composer defaults to is a real ecosystem product', () => {
  // Guards the seam: whatever the frontend composer defaults to must survive
  // the backend's product validation.
  const catalog = build();
  const source = readFileSync(new URL('../../../../frontend/src/app.js', import.meta.url), 'utf8');
  const match = /useState\('([^']+)'\);\s*\n[^\n]*newPostMedia|newPostProduct, setNewPostProduct\] = useState\('([^']+)'\)/.exec(source);
  const defaultId = match && (match[2] || match[1]);
  assert.ok(defaultId, 'could not find the composer default in src/app.js');
  assert.ok(catalog.productIds().includes(defaultId),
    `the composer defaults to "${defaultId}", which the API rejects`);
});

test('an unknown hub is a 404, not an empty object', () => {
  assert.throws(() => build().hub('nope'), (e) => e.status === 404);
});

test('channel lookup is exact, and used to reject bad chat targets', () => {
  const catalog = build();
  assert.equal(catalog.hasChannel('worldstreet', 'ws-c1'), true);
  assert.equal(catalog.hasChannel('worldstreet', 'ws-c99'), false);
  assert.equal(catalog.hasChannel('nope', 'ws-c1'), false);
});

// --- schedule -------------------------------------------------------------

const ITEMS = [
  { id: 's1', time: '18:00 - 18:30', title: 'A' },
  { id: 's2', time: '18:30 - 19:15', title: 'B' },
  { id: 's3', time: '19:15 - 19:45', title: 'C' },
];
const at = (h, m) => ((h * 60 + m) * 60_000);

test('the block on air is the one the clock is inside', () => {
  const current = (items, ms) => resolveSchedule(items, ms).find((i) => i.isCurrent);
  assert.equal(current(ITEMS, at(18, 10)).id, 's1');
  assert.equal(current(ITEMS, at(18, 45)).id, 's2');
  assert.equal(current(ITEMS, at(19, 30)).id, 's3');
});

test('a 24/7 channel always has exactly one block on air, even outside the grid', () => {
  for (let minute = 0; minute < 1440; minute += 7) {
    const resolved = resolveSchedule(ITEMS, minute * 60_000);
    const live = resolved.filter((i) => i.isCurrent);
    assert.equal(live.length, 1, `no single block on air at minute ${minute}`);
  }
});

test('outside the published grid the schedule is marked as looping, not as scheduled', () => {
  const inGrid = resolveSchedule(ITEMS, at(18, 10)).find((i) => i.isCurrent);
  const outOfGrid = resolveSchedule(ITEMS, at(3, 0)).find((i) => i.isCurrent);
  assert.equal(inGrid.looped, false);
  assert.equal(outOfGrid.looped, true, 'honest about why that block is on air');
});

test("the seed's static isCurrent flag is never trusted", () => {
  const seeded = [{ id: 'x', time: '18:00 - 18:30', isCurrent: true }, { id: 'y', time: '18:30 - 19:00' }];
  const atY = resolveSchedule(seeded, at(18, 45));
  assert.equal(atY.find((i) => i.id === 'x').isCurrent, false);
  assert.equal(atY.find((i) => i.id === 'y').isCurrent, true);
});

test('a malformed time does not take the schedule down', () => {
  const resolved = resolveSchedule([{ id: 'bad', time: 'whenever' }, { id: 'ok', time: '18:00 - 18:30' }], at(18, 10));
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].id, 'ok');
});

// --- search ---------------------------------------------------------------

test('search is deterministic: the same query twice gives the same order', () => {
  const content = loadSeed().content;
  const once = searchCatalog(content, 'kash').results.map((r) => r.id);
  const twice = searchCatalog(content, 'kash').results.map((r) => r.id);
  assert.deepEqual(once, twice);
});

test('search ranks an exact product name above a passing mention', () => {
  const content = loadSeed().content;
  const top = searchCatalog(content, 'worldstreet').results[0];
  assert.equal(top.kind, 'product');
  assert.equal(top.id, 'worldstreet');
});

test('a one-character query returns nothing rather than everything', () => {
  const content = loadSeed().content;
  assert.equal(searchCatalog(content, 'a').results.length, 0);
  assert.equal(searchCatalog(content, '').results.length, 0);
});

test('search finds creators by handle', () => {
  const content = loadSeed().content;
  const hits = searchCatalog(content, 'david_trades').results;
  assert.ok(hits.some((h) => h.kind === 'spotlight'));
});
