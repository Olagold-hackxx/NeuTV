import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { TEST_COST, createPasswordHasher } from '../../../platform/password.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createIdentityService } from '../service.mjs';
import { openIdentityStore } from '../store.mjs';
import { testStore } from '../../../platform/db/testing.mjs';
import { scopesFor, scopeIdsFor } from '../scopes.mjs';
import { ROUTES } from '../../../contracts/manifest.mjs';

const build = async (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  const store = await testStore(openIdentityStore);
  return { runtime, identity: createIdentityService({ runtime, catalog, store, passwordCost: TEST_COST, ...over }) };
};

test('SSO through a product issues a session and the product badge', async () => {
  const { identity } = await build();
  const res = await identity.sso({ productId: 'worldstreet', username: 'Alex Trader' });
  assert.equal(res.user.name, '@Alex Trader');
  assert.equal(res.user.badge, 'WorldStreet Verified');
  assert.equal(res.user.verified, true);
  assert.ok(res.session.token);
});

test('signing in twice through the same product returns the same account', async () => {
  const { identity } = await build();
  const first = await identity.sso({ productId: 'worldstreet', username: 'Alex' });
  const second = await identity.sso({ productId: 'worldstreet', username: 'Alex' });
  assert.equal(second.user.id, first.user.id);
  assert.equal(second.returning, true);
  assert.notEqual(second.session.token, first.session.token, 'but a fresh session each time');
});

test('nobody gets a starter balance: the celebration says zero coins', async () => {
  const { identity } = await build();
  assert.equal((await identity.sso({ productId: 'ark', username: 'zed' })).celebration.coins, 0);
  assert.equal((await identity.signup({ email: 'a@neu.tv', password: 'longenough1' })).celebration.coins, 0);
  assert.equal(await identity.consent('ark').grantsCoins, 0);
});

test('consent lists the common scopes plus the ones that product adds', async () => {
  const { identity } = await build();
  const ws = await identity.consent('worldstreet');
  assert.ok(ws.scopes.some((s) => s.id === 'trade:mirror'), 'WorldStreet grants trade mirroring');
  assert.ok(ws.scopes.some((s) => s.id === 'profile:read'));
  assert.ok(!await identity.consent('ark').scopes.some((s) => s.id === 'trade:mirror'), 'ARK does not');
  assert.ok(await identity.consent('linkpay').scopes.some((s) => s.id === 'offramp:route'));
  assert.ok(await identity.consent('market').scopes.some((s) => s.id === 'escrow:authorize'));
});

test('the session carries exactly the scopes the viewer consented to', async () => {
  const { identity } = await build();
  const res = await identity.sso({ productId: 'market', username: 'elena' });
  assert.deepEqual(res.session.scopes, scopeIdsFor('market'));
  assert.deepEqual((await identity.authenticate(res.session.token)).scopes, scopeIdsFor('market'));
});

test('an unknown product cannot be used to sign in', async () => {
  const { identity } = await build();
  // Username is deliberately valid, so this asserts the product check and not
  // the length check that would otherwise short-circuit it at 400.
  await assert.rejects(() => identity.sso({ productId: 'fakebank', username: 'alex' }), (e) => e.status === 404);
  await assert.rejects(() => identity.sso({ productId: 'worldstreet', username: 'x' }), (e) => e.status === 400, 'short username is still 400');
  // consent() reads only the catalog, so it stays synchronous and throws.
  assert.throws(() => identity.consent('fakebank'), (e) => e.status === 404);
});

test('a wrong password and an unknown email are indistinguishable', async () => {
  const { identity } = await build();
  await identity.signup({ email: 'real@neu.tv', password: 'longenough1' });
  const attempt = async (email) => {
    try { await identity.signin({ email, password: 'nope12345' }); return null; } catch (e) { return e; }
  };
  const wrongPassword = await attempt('real@neu.tv');
  const noSuchUser = await attempt('ghost@neu.tv');
  assert.equal(wrongPassword.status, noSuchUser.status);
  assert.equal(wrongPassword.message, noSuchUser.message, 'no account enumeration oracle');
});

test('passwords are never stored recoverably', async () => {
  const hasher = createPasswordHasher(TEST_COST);
  const stored = hasher.hash('correct horse battery');
  assert.ok(stored.startsWith('scrypt$'), 'memory-hard KDF, not a bare digest');
  assert.ok(!stored.includes('correct horse battery'));
  assert.equal(hasher.verify('correct horse battery', stored), true);
  assert.equal(hasher.verify('wrong', stored), false);
  assert.equal(hasher.verify('x', 'not-a-hash'), false, 'garbage does not throw, it fails');
});

test('a short password is refused at signup', async () => {
  const { identity } = await build();
  await assert.rejects(() => identity.signup({ email: 'a@neu.tv', password: 'short' }), (e) => e.status === 400);
});

test('a malformed email is refused', async () => {
  const { identity } = await build();
  for (const email of ['nope', 'a@b', '@neu.tv', 'a b@neu.tv']) {
    await assert.rejects(() => identity.signup({ email, password: 'longenough1' }), (e) => e.status === 400, `accepted ${email}`);
  }
});

test('an email can only hold one passport', async () => {
  const { identity } = await build();
  await identity.signup({ email: 'dup@neu.tv', password: 'longenough1' });
  await assert.rejects(() => identity.signup({ email: 'dup@neu.tv', password: 'longenough1' }), (e) => e.status === 409);
});

test('handles never collide', async () => {
  const { identity } = await build();
  const a = await identity.signup({ email: 'alex@neu.tv', password: 'longenough1', name: 'alex' });
  const b = await identity.signup({ email: 'alex2@neu.tv', password: 'longenough1', name: 'alex' });
  assert.notEqual(a.user.handle, b.user.handle);
});

test('logout revokes the session immediately', async () => {
  const { identity } = await build();
  const res = await identity.sso({ productId: 'ark', username: 'zed' });
  const auth = await identity.authenticate(res.session.token);
  await identity.logout(auth);
  assert.equal(await identity.authenticate(res.session.token), null);
});

test('an expired session stops authenticating without anything sweeping it', async () => {
  const { runtime, identity } = await build({ sessionTtlMs: 1000 });
  const res = await identity.sso({ productId: 'ark', username: 'zed' });
  assert.ok(await identity.authenticate(res.session.token));
  runtime.advance(1001);
  assert.equal(await identity.authenticate(res.session.token), null);
});

test('a garbage token is simply not a session', async () => {
  const { identity } = await build();
  assert.equal(await identity.authenticate('made-up'), null);
  assert.equal(await identity.authenticate(''), null);
  assert.equal(await identity.authenticate(null), null);
});

test('the session probe answers for guests instead of failing', async () => {
  const { identity } = await build();
  const guest = await identity.session(null);
  assert.equal(guest.authenticated, false);
  assert.equal(guest.guest, true);
  assert.equal(guest.user, null);
});

test('the admin role comes from deployment config, never from self-service', async () => {
  const { identity } = await build({ adminEmails: ['boss@neu.tv'] });
  assert.equal((await identity.signup({ email: 'boss@neu.tv', password: 'longenough1' })).user.role, 'admin');
  assert.equal((await identity.signup({ email: 'random@neu.tv', password: 'longenough1' })).user.role, 'viewer');
  assert.equal((await identity.sso({ productId: 'ark', username: 'boss' })).user.role, 'viewer', 'SSO cannot mint an admin');
});

test('scope helpers stay in step with the product list', async () => {
  for (const id of ['worldstreet', 'market', 'linkpay', 'ark', 'tsioncars']) {
    assert.ok(scopesFor(id).length > 4, `${id} should add a product scope`);
    assert.equal(new Set(scopeIdsFor(id)).size, scopeIdsFor(id).length, 'no duplicate scopes');
  }
});

test('resetPassword replaces the password and kills every live session', async () => {
  const { identity } = await build();
  const created = await identity.signup({ email: 'ops@neu.tv', password: 'originalpass1' });
  const session = await identity.authenticate(created.session.token);
  assert.ok(session, 'signed in to begin with');

  const res = await identity.resetPassword('ops@neu.tv', 'a-brand-new-password');
  assert.equal(res.sessionsRevoked, 1);
  assert.equal(await identity.authenticate(created.session.token), null,
    'a reset that leaves old sessions alive has not locked anyone out');

  await assert.rejects(() => identity.signin({ email: 'ops@neu.tv', password: 'originalpass1' }), (e) => e.status === 401);
  assert.ok((await identity.signin({ email: 'ops@neu.tv', password: 'a-brand-new-password' })).session.token);
});

test('resetPassword refuses an unknown account and a weak password', async () => {
  const { identity } = await build();
  await identity.signup({ email: 'ops@neu.tv', password: 'originalpass1' });
  await assert.rejects(() => identity.resetPassword('nobody@neu.tv', 'longenough1'), (e) => e.status === 404);
  await assert.rejects(() => identity.resetPassword('ops@neu.tv', 'short'), (e) => e.status === 400);
});

test('resetPassword is not reachable over the contract', async () => {
  // It is an operations tool, not an API. Nothing in the manifest exposes it.
  assert.ok(!ROUTES.some((r) => r.path.includes('reset') || r.path.includes('password')));
});
