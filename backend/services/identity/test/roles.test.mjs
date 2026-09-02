import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createIdentityService } from '../service.mjs';
import { openIdentityStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { TEST_COST } from '../../../platform/password.mjs';

// Creator standing: granted from the back office, revocable, and never a path
// to the admin role.

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

test('creator standing is granted and revoked, and survives into the session', async () => {
  const { identity } = await build();
  const { user, session } = await identity.signup({ email: 'alex@neu.tv', password: PASSWORD });
  assert.equal(user.role, 'viewer');

  const granted = await identity.setRole(user.id, 'creator');
  assert.equal(granted.user.role, 'creator');
  assert.equal((await identity.authenticate(session.token)).role, 'creator', 'existing sessions see the new role');

  const revoked = await identity.setRole(user.id, 'viewer');
  assert.equal(revoked.user.role, 'viewer');
});

test('the role grant can never mint or demote an admin', async () => {
  const { identity } = await build({ adminEmails: ['boss@neu.tv'] });
  const viewer = (await identity.signup({ email: 'v@neu.tv', password: PASSWORD })).user;
  const boss = (await identity.signup({ email: 'boss@neu.tv', password: PASSWORD })).user;

  await assert.rejects(() => identity.setRole(viewer.id, 'admin'), (e) => e.status === 400, 'admin is not a grantable value');
  await assert.rejects(() => identity.setRole(boss.id, 'viewer'), (e) => e.status === 400, 'and an admin cannot be demoted here');
});

test('a handle resolves to its user with or without the @, any case', async () => {
  const { identity } = await build();
  const { user } = await identity.signup({ name: 'Alex Trader', email: 'a@neu.tv', password: PASSWORD });
  assert.equal(await identity.userIdByHandle(user.handle), user.id);
  assert.equal(await identity.userIdByHandle(`@${user.handle.toUpperCase()}`), user.id, 'the wallet normalises the same way');
  assert.equal(await identity.userIdByHandle('@nobody_here'), null);
});

test('the spotlight profile port exposes the public face and nothing more', async () => {
  const { identity } = await build();
  const { user } = await identity.signup({ email: 'a@neu.tv', password: PASSWORD });
  const profile = await identity.profileById(user.id);
  assert.deepEqual(Object.keys(profile).sort(), ['avatar', 'handle', 'id', 'name', 'productId']);
  assert.equal(await identity.profileById('user_missing'), null);
});
