// The composition root.
//
// This is the only file that knows every service exists. Services are built
// here, given their stores, and wired to each other exclusively through:
//   - contract clients (loopback in-process, HTTP when split across hosts), and
//   - injected ports/events for reads that are not part of the public API.
//
// No service imports another. Deleting a service from this file removes it from
// the deployment without touching any other service's code.

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { realRuntime } from '../../platform/runtime.mjs';
import { openServiceStore } from '../../platform/db/index.mjs';
import { createHub } from '../../platform/sse.mjs';
import { loopbackClient } from '../../contracts/client.mjs';
import { PROD_COST } from '../../platform/password.mjs';

import { createCatalogService } from '../catalog/service.mjs';
import { createCatalogRouter } from '../catalog/router.mjs';
import { createIdentityService } from '../identity/service.mjs';
import { createIdentityRouter } from '../identity/router.mjs';
import { openIdentityStore } from '../identity/store.mjs';
import { createWalletService } from '../wallet/service.mjs';
import { createWalletRouter } from '../wallet/router.mjs';
import { openWalletStore } from '../wallet/store.mjs';
import { createSocialService } from '../social/service.mjs';
import { createSocialRouter } from '../social/router.mjs';
import { openSocialStore } from '../social/store.mjs';
import { createLiveService } from '../live/service.mjs';
import { createLiveRouter } from '../live/router.mjs';
import { openLiveStore } from '../live/store.mjs';
import { createAdminService } from '../admin/service.mjs';
import { createMediaStorage, mediaBaseFor, mediaTransformFor } from '../admin/storage/index.mjs';
import { createAdminRouter } from '../admin/router.mjs';
import { openAdminStore } from '../admin/store.mjs';
import { createModerationService } from '../moderation/service.mjs';
import { createModerationRouter } from '../moderation/router.mjs';
import { openModerationStore } from '../moderation/store.mjs';

// Anchored to this file, not to process.cwd(). A CWD-relative default wrote
// stores wherever a script happened to be run from, and one of those stray
// directories got committed.
const SERVICES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

// Async because opening a store now runs migrations, and a half-migrated
// database is not a state anything should be allowed to serve from.
export async function compose({
  runtime = realRuntime(),
  dataDir = SERVICES_DIR,
  memory = false,                 // tests build the whole graph in memory
  databaseUrl = process.env.DATABASE_URL,
  adminEmails = [],
  passwordCost = PROD_COST,
  uploadsRoot = null,
  mediaBase = mediaBaseFor(),
  mediaTransform = mediaTransformFor(),
  storage = null,
} = {}) {
  // One Postgres database when DATABASE_URL is set, otherwise a SQLite file per
  // service. Each service gets its own Postgres SCHEMA, which is the same
  // isolation a private SQLite file gave it: social and live both own a table
  // called "comments" and must not see each other's.
  const open = (openFn, service) => openServiceStore(openFn, service, { databaseUrl, dataDir, memory });
  const hub = createHub(runtime);

  // Registry is filled below; the client closes over it so services created
  // early can still call services created later.
  const registry = {};
  const client = loopbackClient(registry);

  const catalog = createCatalogService({ runtime });

  const identity = createIdentityService({
    runtime, catalog, adminEmails, passwordCost,
    store: await open(openIdentityStore, 'identity'),
  });

  const moderation = createModerationService({
    runtime,
    store: await open(openModerationStore, 'moderation'),
  });

  const wallet = createWalletService({
    runtime,
    store: await open(openWalletStore, 'wallet'),
    // The wallet does not know the live stage exists. The gift banner on the
    // broadcast is this wire, and nothing else.
    events: { emit: (type, payload) => { if (type === 'gift') live.onGift(payload); } },
    // The creator gift split needs the user behind a handle; identity chose to
    // expose exactly that lookup, nothing wider.
    identity: { userIdByHandle: (handle) => identity.userIdByHandle(handle) },
  });

  const social = createSocialService({
    runtime, catalog, moderation: client,
    store: await open(openSocialStore, 'social'),
  });
  // The designed feed is loaded once, here, rather than as a side effect of
  // constructing the service.
  await social.seed();

  const live = createLiveService({
    runtime, catalog, hub,
    moderation: client,
    programmeClient: client,
    socialClient: client,
    giftPort: { topGifters: (target, opts) => wallet.topGifters(target, opts) },
    store: await open(openLiveStore, 'live'),
  });

  const uploads = uploadsRoot || `${dataDir}/admin/data/uploads`;
  const admin = createAdminService({
    runtime, catalog, mediaBase, mediaTransform,
    store: await open(openAdminStore, 'admin'),
    // Local disk unless NEUTV_MEDIA_DRIVER says otherwise; the service only
    // ever sees "something with save() on it".
    storage: storage || createMediaStorage(process.env, { uploadsRoot: uploads }),
    uploadsRoot: uploads,
    // Broadcast segments are transient and windowed, so they live beside the
    // uploads rather than in them.
    segmentsRoot: `${dataDir}/admin/data/live-segments`,
    // CRM read ports. Each is a narrow, read-only view another service chose to
    // expose - not a database handle.
    ports: {
      viewers: { summary: () => identity.viewerSummary(), list: (o) => identity.viewerList(o) },
      spend: { summary: () => wallet.spendSummary(), byUser: () => wallet.spendByUser() },
      moderation: { summary: () => moderation.summary(), queue: (o) => moderation.queue(o) },
      engagement: { summary: () => social.engagementSummary() },
      // The creator surface: the wallet gates publishing on an active plan and
      // pays task bounties; identity resolves owner ids into spotlight cards.
      wallet: {
        subscriptionActive: (userId, plan) => wallet.subscriptionActive(userId, plan),
        payBounty: (userId, amount, reference, memo) => wallet.payBounty(userId, amount, reference, memo),
      },
      identity: { profile: (userId) => identity.profileById(userId) },
    },
    // A live event going on or off air reaches viewers over SSE, so the stage
    // switches without anyone reloading.
    events: { emit: (type, payload) => hub.publish(type, payload) },
  });

  const services = { catalog, identity, wallet, social, live, admin, moderation };

  Object.assign(registry, {
    catalog: createCatalogRouter({ runtime, service: catalog }),
    identity: createIdentityRouter({ runtime, service: identity }),
    wallet: createWalletRouter({ runtime, service: wallet }),
    social: createSocialRouter({ runtime, service: social }),
    live: createLiveRouter({ runtime, service: live, hub }),
    admin: createAdminRouter({ runtime, service: admin }),
    moderation: createModerationRouter({ runtime, service: moderation }),
  });

  return {
    runtime,
    hub,
    services,
    routers: registry,
    client,
    async close() {
      for (const s of Object.values(services)) await s.close?.();
    },
  };
}
