// Catalog service: the content spine of the 24/7 network.
//
// Deliberately has no database. Everything it serves is derived from a
// committed seed plus the clock, so there is no
// mutable state to store and nothing for two processes to disagree about.
// Adding SQLite here would buy nothing and cost a failure mode.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { notFound } from '../../platform/errors.mjs';
import { CONTRACT_VERSION } from '../../contracts/version.mjs';
import { resolveSchedule } from './schedule.mjs';
import { stripCounts, stripSeededComments, SEEDED_SPEECH } from './counts.mjs';
import { searchCatalog } from './search.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SEED_PATH = join(HERE, 'seed', 'catalog.seed.json');

export function loadSeed(path = SEED_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function createCatalogService({ runtime, seed = loadSeed(), tzOffsetMinutes = 0 }) {
  // Every count in the seed was invented. Engagement is measured or it is not
  // shown, so the numbers are dropped once, here, and no consumer has to
  // remember which fields were real. See counts.mjs.
  const content = stripCounts(seed.content);
  // Invented speech goes the same way the invented counts did.
  for (const key of SEEDED_SPEECH) content[key] = [];

  // The five canonical ecosystem products. Every other service validates
  // productId against this list, through the contract, never by hardcoding.
  const productIds = (content.PRODUCTS || []).map((p) => p.id);
  const productsById = new Map((content.PRODUCTS || []).map((p) => [p.id, p]));

  return {
    checksum: seed.checksum,

    // Drop-in payload for window.CentralData. Schedule is resolved against the
    // clock so the frontend never renders a stale "on air" block.
    bootstrap() {
      return {
        // The API contract, and separately the version of the seed content.
        // One field carrying both meanings made /health and /bootstrap
        // disagree about what "contractVersion" referred to.
        contractVersion: CONTRACT_VERSION,
        seedVersion: seed.contractVersion,
        checksum: seed.checksum,
        generatedAt: runtime.now(),
        ...content,
        SCHEDULE_ITEMS: resolveSchedule(content.SCHEDULE_ITEMS || [], runtime.now(), tzOffsetMinutes),
      };
    },

    products: () => ({ products: content.PRODUCTS || [] }),
    productIds: () => productIds,
    product: (id) => productsById.get(id) || null,

    hubs: () => ({ hubs: content.PRODUCT_COMMUNITY_HUBS || {} }),
    hub(hubId) {
      const hub = (content.PRODUCT_COMMUNITY_HUBS || {})[hubId];
      if (!hub) throw notFound(`No community hub "${hubId}".`);
      return { id: hubId, ...hub };
    },
    // Channel lookup used by the live service to reject messages addressed to a
    // channel that does not exist.
    hasChannel(hubId, channelId) {
      const hub = (content.PRODUCT_COMMUNITY_HUBS || {})[hubId];
      return Boolean(hub && (hub.channels || []).some((c) => c.id === channelId));
    },

    spotlights: () => ({ spotlights: content.CREATOR_SPOTLIGHTS || [] }),
    spotlight: (id) => (content.CREATOR_SPOTLIGHTS || []).find((s) => s.id === id) || null,
    mediaRows: () => ({ rows: content.INITIAL_MEDIA_ROWS || [] }),
    mediaItem(id) {
      for (const row of content.INITIAL_MEDIA_ROWS || []) {
        const hit = (row.items || []).find((i) => i.id === id);
        if (hit) return hit;
      }
      return null;
    },
    platforms: () => ({ platforms: content.PLATFORMS || [] }),
    vod: () => ({ vod: content.VOD_LIBRARY || [] }),
    vodItem: (id) => (content.VOD_LIBRARY || []).find((v) => v.id === id) || null,
    trending: () => ({ topics: content.TRENDING_TOPICS || [] }),
    hashtags: () => ({
      feeds: content.HASHTAG_FEEDS || [],
      posts: content.AGGREGATED_HASHTAG_POSTS || [],
    }),
    liveCommentSeeds: () => content.SAMPLE_LIVE_COMMENTS || [],
    centralTv: () => content.INITIAL_CENTRAL_TV || {},
    // Posts keep their video and copy; their comment threads do not survive,
    // because a comment nobody wrote is worse than an empty thread.
    seedPosts: () => stripSeededComments(content.INITIAL_POSTS || []),

    schedule: () => ({
      items: resolveSchedule(content.SCHEDULE_ITEMS || [], runtime.now(), tzOffsetMinutes),
      resolvedAt: runtime.now(),
    }),

    search: (query, opts) => searchCatalog(content, query, opts),
  };
}
