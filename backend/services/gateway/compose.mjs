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
import { createAdminRouter } from '../admin/router.mjs';
import { openAdminStore } from '../admin/store.mjs';
import { createModerationService } from '../moderation/service.mjs';
import { createModerationRouter } from '../moderation/router.mjs';
import { openModerationStore } from '../moderation/store.mjs';

// Anchored to this file, not to process.cwd(). A CWD-relative default wrote
// stores wherever a script happened to be run from, and one of those stray
// directories got committed.
const SERVICES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

export function compose({
  runtime = realRuntime(),
  dataDir = SERVICES_DIR,
  memory = false,                 // tests build the whole graph in memory
  adminEmails = [],
  passwordCost = PROD_COST,
  uploadsRoot = null,
  mediaBase = '/media',
} = {}) {
  const file = (service, name) => (memory ? ':memory:' : `${dataDir}/${service}/data/${name}.db`);
  const hub = createHub(runtime);

  // Registry is filled below; the client closes over it so services created
  // early can still call services created later.
  const registry = {};
  const client = loopbackClient(registry);

  const catalog = createCatalogService({ runtime });

  const identity = createIdentityService({
    runtime, catalog, adminEmails, passwordCost,
    store: openIdentityStore(file('identity', 'identity')),
  });

  const moderation = createModerationService({
    runtime,
    store: openModerationStore(file('moderation', 'moderation')),
  });

  const wallet = createWalletService({
    runtime,
    store: openWalletStore(file('wallet', 'wallet')),
    // The wallet does not know the live stage exists. The gift banner on the
    // broadcast is this wire, and nothing else.
    events: { emit: (type, payload) => { if (type === 'gift') live.onGift(payload); } },
  });

  const social = createSocialService({
    runtime, catalog, moderation: client,
    store: openSocialStore(file('social', 'social')),
  });

  const live = createLiveService({
    runtime, catalog, hub,
    moderation: client,
    programmeClient: client,
    socialClient: client,
    giftPort: { topGifters: (target, opts) => wallet.topGifters(target, opts) },
    store: openLiveStore(file('live', 'live')),
  });

  const admin = createAdminService({
    runtime, catalog, mediaBase,
    store: openAdminStore(file('admin', 'admin')),
    uploadsRoot: uploadsRoot || `${dataDir}/admin/data/uploads`,
    // CRM read ports. Each is a narrow, read-only view another service chose to
    // expose - not a database handle.
    ports: {
      viewers: { summary: () => identity.viewerSummary(), list: (o) => identity.viewerList(o) },
      spend: { summary: () => wallet.spendSummary(), byUser: () => wallet.spendByUser() },
      moderation: { summary: () => moderation.summary(), queue: (o) => moderation.queue(o) },
      engagement: { summary: () => social.engagementSummary() },
    },
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
    close() {
      for (const s of Object.values(services)) s.close?.();
    },
  };
}
