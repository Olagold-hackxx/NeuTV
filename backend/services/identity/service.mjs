// Identity service: one NEU Passport across the five ecosystem products.

import { validate } from '../../platform/validate.mjs';
import { badRequest, unauthorized, notFound, conflict } from '../../platform/errors.mjs';
import { createPasswordHasher, PROD_COST } from '../../platform/password.mjs';
import { slugify } from '../../platform/runtime.mjs';
import { scopesFor, scopeIdsFor } from './scopes.mjs';

const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const publicUser = (row) => ({
  id: row.id,
  role: row.role ?? 'viewer',
  name: row.display_name,
  handle: row.handle,
  avatar: row.avatar,
  badge: row.badge,
  productId: row.product_id,
  authMethod: row.auth_method,
  verified: Boolean(row.verified),
  createdAt: row.created_at,
});

// "@Alex Trader" and "alex trader" both land on the same handle shape the
// frontend already renders.
const formatDisplayName = (raw) => {
  const trimmed = String(raw).trim();
  if (trimmed.startsWith('@') || trimmed.startsWith('$')) return trimmed;
  return `@${trimmed}`;
};

export function createIdentityService({
  runtime,
  store,
  catalog,                       // read through the contract, never a hub import
  passwordCost = PROD_COST,
  sessionTtlMs = SESSION_TTL_MS,
  // Emails that get the admin role on first sign-in. Configured by deployment
  // (NEUTV_ADMIN_EMAILS), never self-service: nobody grants themselves the
  // back office by picking an email at signup.
  adminEmails = [],
}) {
  const adminSet = new Set(adminEmails.map((e) => String(e).trim().toLowerCase()).filter(Boolean));
  const roleFor = (email) => (email && adminSet.has(email.toLowerCase()) ? 'admin' : 'viewer');
  const hasher = createPasswordHasher(passwordCost);

  const knownProduct = (productId) => {
    const products = catalog.products().products;
    return products.find((p) => p.id === productId) || null;
  };

  const uniqueHandle = async (base) => {
    const root = slugify(base) || 'viewer';
    let candidate = root;
    let n = 1;
    while (await store.get('SELECT id FROM users WHERE handle = ?', candidate)) {
      candidate = `${root}${++n}`;
    }
    return candidate;
  };

  const issueSession = async (user, productId) => {
    const scopes = scopeIdsFor(productId);
    const token = runtime.token();
    const now = runtime.now();
    await store.run(
      'INSERT INTO sessions (token, user_id, product_id, scopes, created_at, expires_at) VALUES (?,?,?,?,?,?)',
      token, user.id, productId, JSON.stringify(scopes), now, now + sessionTtlMs,
    );
    return { token, scopes, expiresAt: now + sessionTtlMs };
  };

  const createUser = async ({ displayName, handle, email, passwordHash, badge, productId, authMethod, verified }) => {
    const id = `user_${runtime.uuid()}`;
    await store.run(
      `INSERT INTO users (id, handle, display_name, email, password_hash, avatar, badge, product_id, auth_method, verified, role, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      id, handle, displayName, email, passwordHash, DEFAULT_AVATAR, badge, productId, authMethod, verified ? 1 : 0,
      roleFor(email), runtime.now(),
    );
    return store.get('SELECT * FROM users WHERE id = ?', id);
  };

  return {
    providers() {
      return {
        providers: catalog.products().products.map((p) => ({
          id: p.id,
          name: p.name,
          logo: p.logo,
          badge: p.badge,
          officialUrl: p.officialUrl,
          scopes: scopesFor(p.id),
        })),
      };
    },

    consent(productId) {
      const product = knownProduct(productId);
      if (!product) throw notFound(`"${productId}" is not an ecosystem product.`);
      return {
        productId,
        productName: product.name,
        // Mirrors the copy rendered in the gate so consent text has one source.
        headline: `Authorize & Sign In with ${product.name}`,
        scopes: scopesFor(productId),
        grantsCoins: 0, // PRD 4.4: zero starter balance friction, no sign-in bonus.
      };
    },

    // One-click SSO through an ecosystem product. A viewer who signs in twice
    // through the same product gets the same account, not a duplicate.
    async sso(input) {
      const { productId, username, password } = validate(input, {
        productId: { type: 'string', required: true, max: 40 },
        username: { type: 'string', required: true, min: 2, max: 40 },
        password: { type: 'string', required: false, max: 200 },
      });
      const product = knownProduct(productId);
      if (!product) throw notFound(`"${productId}" is not an ecosystem product.`);

      const displayName = formatDisplayName(username);
      const handle = slugify(username.replace(/^[@$]/, ''));
      if (!handle) throw badRequest('Username must contain at least one letter or digit.');

      const existing = await store.get(
        'SELECT * FROM users WHERE handle = ? AND product_id = ? AND auth_method = ?',
        handle, productId, 'sso',
      );
      const user = existing || await createUser({
        displayName,
        handle: await uniqueHandle(handle),
        email: null,
        passwordHash: password ? hasher.hash(password) : null,
        badge: `${product.name} Verified`,
        productId,
        authMethod: 'sso',
        verified: true,
      });

      const session = await issueSession(user, productId);
      return {
        user: publicUser(user),
        session,
        // The gate's celebration modal reads this. Explicitly zero.
        celebration: { name: user.display_name, badge: user.badge, platform: product.name, coins: 0 },
        returning: Boolean(existing),
      };
    },

    async signup(input) {
      const { name, email, password, platform } = validate(input, {
        name: { type: 'string', required: false, max: 40 },
        email: { type: 'string', required: true, max: 160, pattern: /^[^@\s]+@[^@\s.]+\.[^@\s]+$/ },
        password: { type: 'string', required: true, min: 8, max: 200 },
        platform: { type: 'string', required: false, default: 'worldstreet', max: 40 },
      });

      const product = knownProduct(platform);
      if (!product) throw notFound(`"${platform}" is not an ecosystem product.`);
      if (await store.get('SELECT id FROM users WHERE email = ?', email.toLowerCase())) {
        throw conflict('That email already has a NEU Passport. Sign in instead.');
      }

      const base = name || email.split('@')[0];
      const user = await createUser({
        displayName: formatDisplayName(base),
        handle: await uniqueHandle(base),
        email: email.toLowerCase(),
        passwordHash: hasher.hash(password),
        badge: `${product.name} Member`,
        productId: platform,
        authMethod: 'password',
        verified: false,
      });

      return {
        user: publicUser(user),
        session: await issueSession(user, platform),
        celebration: { name: user.display_name, badge: user.badge, platform: 'NEU TV', coins: 0 },
      };
    },

    async signin(input) {
      const { email, password } = validate(input, {
        email: { type: 'string', required: true, max: 160 },
        password: { type: 'string', required: true, max: 200 },
      });
      const user = await store.get('SELECT * FROM users WHERE email = ?', email.toLowerCase());
      // Same error either way: a distinct "no such account" reply is an account
      // enumeration oracle.
      if (!user || !hasher.verify(password, user.password_hash)) {
        throw unauthorized('Email or password is incorrect.');
      }
      return {
        user: publicUser(user),
        session: await issueSession(user, user.product_id),
        celebration: { name: user.display_name, badge: user.badge, platform: 'NEU TV', coins: 0 },
      };
    },

    // Resolves a bearer token to an auth context. Returns null rather than
    // throwing so the gateway can serve 'optional' routes to guests.
    async authenticate(token) {
      if (!token) return null;
      const row = await store.get(
        `SELECT s.token, s.scopes, s.product_id, s.expires_at, s.revoked_at, u.*
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`, token,
      );
      if (!row) return null;
      if (row.revoked_at !== null) return null;
      if (row.expires_at <= runtime.now()) return null;
      return {
        token,
        userId: row.id,
        user: publicUser(row),
        productId: row.product_id,
        role: row.role ?? 'viewer',
        scopes: JSON.parse(row.scopes),
      };
    },

    async logout(auth) {
      if (!auth) throw unauthorized();
      await store.run('UPDATE sessions SET revoked_at = ? WHERE token = ? AND revoked_at IS NULL', runtime.now(), auth.token);
      return { loggedOut: true, at: runtime.now() };
    },

    me(auth) {
      if (!auth) throw unauthorized();
      return { user: auth.user, productId: auth.productId, role: auth.role, scopes: auth.scopes };
    },

    // Never 401s: the frontend uses this to decide guest vs signed-in on load.
    session(auth) {
      if (!auth) return { authenticated: false, guest: true, user: null, role: null, scopes: [] };
      return { authenticated: true, guest: false, user: auth.user, productId: auth.productId, role: auth.role, scopes: auth.scopes };
    },

    // Set or replace an account's password. Operations only: there is no route
    // for this in the contract, and there deliberately is not one. It is
    // reachable from scripts/create-admin.mjs, which needs filesystem access to
    // the database - a level of access that already implies full control.
    async resetPassword(email, password) {
      const normalized = String(email || '').trim().toLowerCase();
      const { password: checked } = validate({ password }, {
        password: { type: 'string', required: true, min: 8, max: 200 },
      });
      const user = await store.get('SELECT * FROM users WHERE email = ?', normalized);
      if (!user) throw notFound(`No account for ${normalized}.`);
      await store.run('UPDATE users SET password_hash = ? WHERE id = ?', hasher.hash(checked), user.id);
      // Every existing session is invalidated: a password reset that leaves old
      // sessions alive has not actually locked anyone out.
      const revoked = await store.run(
        'UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL',
        runtime.now(), user.id,
      );
      return { user: publicUser(user), sessionsRevoked: revoked.changes };
    },

    // --- read ports for the admin CRM (see services/admin/ports.mjs) ------

    async viewerSummary() {
      const week = runtime.now() - 7 * 24 * 60 * 60 * 1000;
      const [total, recent, admins, byProduct, sessions] = await Promise.all([
        store.get('SELECT COUNT(*) AS n FROM users'),
        store.get('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', week),
        store.get("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'"),
        store.all('SELECT product_id, COUNT(*) AS n FROM users GROUP BY product_id'),
        store.get('SELECT COUNT(*) AS n FROM sessions WHERE revoked_at IS NULL AND expires_at > ?', runtime.now()),
      ]);
      return {
        total: total.n,
        newLast7d: recent.n,
        admins: admins.n,
        byProduct: Object.fromEntries(byProduct.map((r) => [r.product_id, r.n])),
        activeSessions: sessions.n,
      };
    },

    async viewerList({ limit = 50 } = {}) {
      return (await store.all(
        `SELECT id, display_name AS name, handle, badge, product_id AS "productId", role,
                auth_method AS "authMethod", verified, created_at AS "createdAt"
         FROM users ORDER BY created_at DESC LIMIT ?`, Math.min(limit, 200),
      )).map((r) => ({ ...r, verified: Boolean(r.verified) }));
    },

    // Housekeeping for the gateway's periodic sweep.
    async purgeExpiredSessions() {
      const res = await store.run('DELETE FROM sessions WHERE expires_at <= ?', runtime.now());
      return { purged: res.changes };
    },

    close: () => store.close(),
  };
}
