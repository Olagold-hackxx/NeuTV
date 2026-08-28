#!/usr/bin/env node
// Create or reset a back-office account.
//
// The admin panel has a login form and no sign-up form, on purpose: nobody
// should be able to create an administrator through a public page. That left
// creating the first one awkward - you had to sign up on the viewer app and
// hope the email matched. This is the operations tool that replaces that.
//
//   npm run admin:create -- --email you@example.com --password 'secret123'
//   npm run admin:create -- --email you@example.com --generate
//
// It refuses any email that is not in NEUTV_ADMIN_EMAILS, so this script cannot
// mint an administrator the deployment has not authorised. Who is an admin has
// exactly one source of truth, and it is the environment.

import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { realRuntime } from '../platform/runtime.mjs';
import { createCatalogService } from '../services/catalog/service.mjs';
import { createIdentityService } from '../services/identity/service.mjs';
import { openIdentityStore } from '../services/identity/store.mjs';

const BACKEND_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const parseArgs = (argv) => {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { args[key] = next; i++; } else { args[key] = true; }
  }
  return args;
};

// Readable but not guessable: 24 bytes of base64url, no ambiguous formatting.
const generatePassword = () => randomBytes(18).toString('base64url');

const die = (message) => { console.error(`\n  ${message}\n`); process.exit(1); };

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`
  Create or reset a NEU TV back-office account.

    npm run admin:create -- --email you@example.com --password 'at-least-8-chars'
    npm run admin:create -- --email you@example.com --generate

  The email must already be listed in NEUTV_ADMIN_EMAILS (backend/.env).
  If the account exists, its password is reset and every live session revoked.
`);
  process.exit(0);
}

const email = String(args.email || '').trim().toLowerCase();
if (!email) die('Which account? Pass --email you@example.com');

const allowed = (process.env.NEUTV_ADMIN_EMAILS || '')
  .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

if (!allowed.length) {
  die('NEUTV_ADMIN_EMAILS is not set. Add it to backend/.env first:\n'
    + `      NEUTV_ADMIN_EMAILS=${email}`);
}
if (!allowed.includes(email)) {
  die(`${email} is not in NEUTV_ADMIN_EMAILS.\n`
    + `      Currently allowed: ${allowed.join(', ')}\n`
    + '      Add it to backend/.env, then run this again.');
}

const generated = Boolean(args.generate) && !args.password;
const password = generated ? generatePassword() : String(args.password || '');
if (!password) die('Pass --password \'at-least-8-chars\', or --generate to make one.');
if (password.length < 8) die('That password is under 8 characters; the API will refuse it.');

const runtime = realRuntime();
const catalog = createCatalogService({ runtime });
const identity = createIdentityService({
  runtime,
  catalog,
  adminEmails: allowed,
  store: openIdentityStore(join(BACKEND_ROOT, 'services', 'identity', 'data', 'identity.db')),
});

try {
  let user;
  let action;
  try {
    // signup() is the real code path, so this account is identical to one
    // created through the API - including how the admin role is assigned.
    ({ user } = identity.signup({ email, password, platform: 'worldstreet' }));
    action = 'created';
  } catch (err) {
    if (err.status !== 409) throw err;
    const reset = identity.resetPassword(email, password);
    user = reset.user;
    action = `password reset (${reset.sessionsRevoked} session${reset.sessionsRevoked === 1 ? '' : 's'} revoked)`;
  }

  console.log(`
  Back-office account ${action}.

    email     ${email}
    handle    ${user.name}
    role      ${user.role}${user.role !== 'admin' ? '   <-- NOT admin; check NEUTV_ADMIN_EMAILS' : ''}
${generated ? `    password  ${password}\n\n  That password is shown once. Store it now.` : ''}
  Sign in at the admin panel: npm run admin  ->  http://localhost:4174
`);
} catch (err) {
  die(err.message);
} finally {
  identity.close();
}
