import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeRuntime } from '../../../platform/runtime.mjs';
import { TEST_COST, createPasswordHasher } from '../../../platform/password.mjs';
import { createCatalogService } from '../../catalog/service.mjs';
import { createIdentityService } from '../service.mjs';
import { scopesFor, scopeIdsFor } from '../scopes.mjs';
import { ROUTES } from '../../../contracts/manifest.mjs';

const build = (over = {}) => {
  const runtime = fakeRuntime();
  const catalog = createCatalogService({ runtime });
  return { runtime, identity: createIdentityService({ runtime, catalog, passwordCost: TEST_COST, ...over }) };
};

test('SSO through a product issues a session and the product badge', () => {
  const { identity } = build();
  const res = identity.sso({ productId: 'worldstreet', username: 'Alex Trader' });
  assert.equal(res.user.name, '@Alex Trader');
  assert.equal(res.user.badge, 'WorldStreet Verified');
  assert.equal(res.user.verified, true);
  assert.ok(res.session.token);
});

test('signing in twice through the same product returns the same account', () => {
  const { identity } = build();
  const first = identity.sso({ productId: 'worldstreet', username: 'Alex' });
  const second = identity.sso({ productId: 'worldstreet', username: 'Alex' });
  assert.equal(second.user.id, first.user.id);
  assert.equal(second.returning, true);
  assert.notEqual(second.session.token, first.session.token, 'but a fresh session each time');
});

test('nobody gets a starter balance: the celebration says zero coins', () => {
  const { identity } = build();
  assert.equal(identity.sso({ productId: 'ark', username: 'zed' }).celebration.coins, 0);
  assert.equal(identity.signup({ email: 'a@neu.tv', password: 'longenough1' }).celebration.coins, 0);
  assert.equal(identity.consent('ark').grantsCoins, 0);
});

test('consent lists the common scopes plus the ones that product adds', () => {
  const { identity } = build();
  const ws = identity.consent('worldstreet');
  assert.ok(ws.scopes.some((s) => s.id === 'trade:mirror'), 'WorldStreet grants trade mirroring');
  assert.ok(ws.scopes.some((s) => s.id === 'profile:read'));
  assert.ok(!identity.consent('ark').scopes.some((s) => s.id === 'trade:mirror'), 'ARK does not');
  assert.ok(identity.consent('linkpay').scopes.some((s) => s.id === 'offramp:route'));
  assert.ok(identity.consent('market').scopes.some((s) => s.id === 'escrow:authorize'));
});

test('the session carries exactly the scopes the viewer consented to', () => {
  const { identity } = build();
  const res = identity.sso({ productId: 'market', username: 'elena' });
  assert.deepEqual(res.session.scopes, scopeIdsFor('market'));
  assert.deepEqual(identity.authenticate(res.session.token).scopes, scopeIdsFor('market'));
});

test('an unknown product cannot be used to sign in', () => {
  const { identity } = build();
  // Username is deliberately valid, so this asserts the product check and not
  // the length check that would otherwise short-circuit it at 400.
  assert.throws(() => identity.sso({ productId: 'fakebank', username: 'alex' }), (e) => e.status === 404);
  assert.throws(() => identity.sso({ productId: 'worldstreet', username: 'x' }), (e) => e.status === 400, 'short username is still 400');
  assert.throws(() => identity.consent('fakebank'), (e) => e.status === 404);
});

test('a wrong password and an unknown email are indistinguishable', () => {
  const { identity } = build();
  identity.signup({ email: 'real@neu.tv', password: 'longenough1' });
  const wrongPassword = (() => { try { identity.signin({ email: 'real@neu.tv', password: 'nope12345' }); } catch (e) { return e; } })();
  const noSuchUser = (() => { try { identity.signin({ email: 'ghost@neu.tv', password: 'nope12345' }); } catch (e) { return e; } })();
  assert.equal(wrongPassword.status, noSuchUser.status);
  assert.equal(wrongPassword.message, noSuchUser.message, 'no account enumeration oracle');
});

test('passwords are never stored recoverably', () => {
  const hasher = createPasswordHasher(TEST_COST);
  const stored = hasher.hash('correct horse battery');
  assert.ok(stored.startsWith('scrypt$'), 'memory-hard KDF, not a bare digest');
  assert.ok(!stored.includes('correct horse battery'));
  assert.equal(hasher.verify('correct horse battery', stored), true);
  assert.equal(hasher.verify('wrong', stored), false);
  assert.equal(hasher.verify('x', 'not-a-hash'), false, 'garbage does not throw, it fails');
});

test('a short password is refused at signup', () => {
  const { identity } = build();
  assert.throws(() => identity.signup({ email: 'a@neu.tv', password: 'short' }), (e) => e.status === 400);
});

test('a malformed email is refused', () => {
  const { identity } = build();
  for (const email of ['nope', 'a@b', '@neu.tv', 'a b@neu.tv']) {
    assert.throws(() => identity.signup({ email, password: 'longenough1' }), (e) => e.status === 400, `accepted ${email}`);
  }
});

test('an email can only hold one passport', () => {
  const { identity } = build();
  identity.signup({ email: 'dup@neu.tv', password: 'longenough1' });
  assert.throws(() => identity.signup({ email: 'dup@neu.tv', password: 'longenough1' }), (e) => e.status === 409);
});

test('handles never collide', () => {
  const { identity } = build();
  const a = identity.signup({ email: 'alex@neu.tv', password: 'longenough1', name: 'alex' });
  const b = identity.signup({ email: 'alex2@neu.tv', password: 'longenough1', name: 'alex' });
  assert.notEqual(a.user.handle, b.user.handle);
});

test('logout revokes the session immediately', () => {
  const { identity } = build();
  const res = identity.sso({ productId: 'ark', username: 'zed' });
  const auth = identity.authenticate(res.session.token);
  identity.logout(auth);
  assert.equal(identity.authenticate(res.session.token), null);
});

test('an expired session stops authenticating without anything sweeping it', () => {
  const { runtime, identity } = build({ sessionTtlMs: 1000 });
  const res = identity.sso({ productId: 'ark', username: 'zed' });
  assert.ok(identity.authenticate(res.session.token));
  runtime.advance(1001);
  assert.equal(identity.authenticate(res.session.token), null);
});

test('a garbage token is simply not a session', () => {
  const { identity } = build();
  assert.equal(identity.authenticate('made-up'), null);
  assert.equal(identity.authenticate(''), null);
  assert.equal(identity.authenticate(null), null);
});

test('the session probe answers for guests instead of failing', () => {
  const { identity } = build();
  const guest = identity.session(null);
  assert.equal(guest.authenticated, false);
  assert.equal(guest.guest, true);
  assert.equal(guest.user, null);
});

test('the admin role comes from deployment config, never from self-service', () => {
  const { identity } = build({ adminEmails: ['boss@neu.tv'] });
  assert.equal(identity.signup({ email: 'boss@neu.tv', password: 'longenough1' }).user.role, 'admin');
  assert.equal(identity.signup({ email: 'random@neu.tv', password: 'longenough1' }).user.role, 'viewer');
  assert.equal(identity.sso({ productId: 'ark', username: 'boss' }).user.role, 'viewer', 'SSO cannot mint an admin');
});

test('scope helpers stay in step with the product list', () => {
  for (const id of ['worldstreet', 'market', 'linkpay', 'ark', 'tsioncars']) {
    assert.ok(scopesFor(id).length > 4, `${id} should add a product scope`);
    assert.equal(new Set(scopeIdsFor(id)).size, scopeIdsFor(id).length, 'no duplicate scopes');
  }
});

test('resetPassword replaces the password and kills every live session', () => {
  const { identity } = build();
  const created = identity.signup({ email: 'ops@neu.tv', password: 'originalpass1' });
  const session = identity.authenticate(created.session.token);
  assert.ok(session, 'signed in to begin with');

  const res = identity.resetPassword('ops@neu.tv', 'a-brand-new-password');
  assert.equal(res.sessionsRevoked, 1);
  assert.equal(identity.authenticate(created.session.token), null,
    'a reset that leaves old sessions alive has not locked anyone out');

  assert.throws(() => identity.signin({ email: 'ops@neu.tv', password: 'originalpass1' }), (e) => e.status === 401);
  assert.ok(identity.signin({ email: 'ops@neu.tv', password: 'a-brand-new-password' }).session.token);
});

test('resetPassword refuses an unknown account and a weak password', () => {
  const { identity } = build();
  identity.signup({ email: 'ops@neu.tv', password: 'originalpass1' });
  assert.throws(() => identity.resetPassword('nobody@neu.tv', 'longenough1'), (e) => e.status === 404);
  assert.throws(() => identity.resetPassword('ops@neu.tv', 'short'), (e) => e.status === 400);
});

test('resetPassword is not reachable over the contract', () => {
  // It is an operations tool, not an API. Nothing in the manifest exposes it.
  assert.ok(!ROUTES.some((r) => r.path.includes('reset') || r.path.includes('password')));
});
