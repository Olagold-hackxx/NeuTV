import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createIdentityService, PRESS_CARD_TTL_MS } from '../service.mjs';
import { openIdentityStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { TEST_COST } from '../../../platform/password.mjs';

// The press desk: anyone applies, the network verifies, and the role and the
// card move together - neither can be held without the other.

const build = async (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const store = await testStore(openIdentityStore);
  return {
    runtime, store,
    identity: createIdentityService({ runtime, catalog, store, passwordCost: TEST_COST, ...over }),
  };
};
const PASSWORD = 'longenough1';
const APPLICATION = { outlet: 'WorldStreet Wire', title: 'Markets correspondent', beat: 'Fintech' };

test('applying files a pending application; verifying mints the card and grants the role', async () => {
  const { identity } = await build();
  const { session } = await identity.signup({ name: 'Dana Reporter', email: 'dana@wire.news', password: PASSWORD });
  const auth = await identity.authenticate(session.token);

  const applied = await identity.applyPress(auth, APPLICATION);
  assert.equal(applied.application.status, 'pending');
  assert.equal(applied.press, false);
  assert.equal(applied.application.card, null, 'no card until the desk says so');

  await assert.rejects(() => identity.applyPress(auth, APPLICATION), (e) => e.status === 409, 'one application at a time');

  const { applications } = await identity.adminListPress({ status: 'pending' });
  assert.equal(applications.length, 1);
  assert.equal(applications[0].name, '@Dana Reporter', 'the desk sees who is asking');

  const verified = await identity.adminReviewPress('admin-1', auth.userId, { decision: 'verify' });
  assert.equal(verified.application.status, 'verified');
  assert.equal(verified.application.card.id, 'NEU-PRESS-000001');
  assert.equal(verified.application.role, 'press');

  const after = await identity.authenticate(session.token);
  assert.equal(after.role, 'press', 'existing sessions see the new standing');
  const me = await identity.pressStatus(after);
  assert.equal(me.press, true);
  assert.equal(me.cardValid, true);
});

test('the card lapses after a year, and revoking takes the role back with it', async () => {
  const { runtime, identity } = await build();
  const { session } = await identity.signup({ email: 'p@wire.news', password: PASSWORD });
  const auth = await identity.authenticate(session.token);
  await identity.applyPress(auth, APPLICATION);
  await identity.adminReviewPress('admin-1', auth.userId, { decision: 'verify' });

  // Re-read the standing before the clock moves: a year out, the session
  // itself has expired, and that is the identity service doing its job.
  const pressAuth = await identity.authenticate(session.token);
  runtime.advance(PRESS_CARD_TTL_MS + 1);
  const lapsed = await identity.pressStatus(pressAuth);
  assert.equal(lapsed.press, true, 'standing is still there');
  assert.equal(lapsed.cardValid, false, 'but the card has expired');

  const revoked = await identity.adminReviewPress('admin-1', auth.userId, { decision: 'revoke' });
  assert.equal(revoked.application.status, 'revoked');
  assert.equal(revoked.application.role, 'viewer');
  const fresh = await identity.signin({ email: 'p@wire.news', password: PASSWORD });
  assert.equal(fresh.user.role, 'viewer');

  // Re-verification keeps the card number: the outlet's identity is stable.
  const again = await identity.adminReviewPress('admin-1', auth.userId, { decision: 'verify' });
  assert.equal(again.application.card.id, 'NEU-PRESS-000001');
});

test('a rejected applicant can apply again; an admin never needs a card', async () => {
  const { identity } = await build({ adminEmails: ['boss@neu.tv'] });
  const { session } = await identity.signup({ email: 'r@wire.news', password: PASSWORD });
  const auth = await identity.authenticate(session.token);
  await identity.applyPress(auth, APPLICATION);
  await identity.adminReviewPress('admin-1', auth.userId, { decision: 'reject' });
  await assert.rejects(() => identity.adminReviewPress('admin-1', auth.userId, { decision: 'reject' }), (e) => e.status === 409);

  const reapplied = await identity.applyPress(auth, { ...APPLICATION, outlet: 'Another Desk' });
  assert.equal(reapplied.application.status, 'pending');
  assert.equal(reapplied.application.outlet, 'Another Desk');

  const boss = await identity.authenticate((await identity.signup({ email: 'boss@neu.tv', password: PASSWORD })).session.token);
  await assert.rejects(() => identity.applyPress(boss, APPLICATION), (e) => e.status === 400);
});

test('press is a grantable role beside creator, and a handle resolves with its role', async () => {
  const { identity } = await build();
  const { user } = await identity.signup({ name: 'Sam', email: 's@neu.tv', password: PASSWORD });
  const granted = await identity.setRole(user.id, 'press');
  assert.equal(granted.user.role, 'press');
  const found = await identity.accountByHandle('@SAM');
  assert.equal(found.id, user.id);
  assert.equal(found.role, 'press');
  assert.equal(await identity.accountByHandle('@nobody'), null);
});
