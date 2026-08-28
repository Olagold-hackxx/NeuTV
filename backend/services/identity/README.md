# identity

One NEU Passport across WorldStreet, mARKet, KashPlus, ARK and Tsion Cars.

- **SSO** through any product issues a session and that product's verified
  badge. Signing in twice through the same product returns the same account.
- **Consent scopes** (`scopes.mjs`) are the source for both the checklist the
  gate renders and the scopes stored on the session, so the two cannot drift.
- **Zero starter balance.** Nothing here credits coins. `celebration.coins` is
  `0` on every path, and there is no code that could make it otherwise.
- **Passwords** use scrypt from `node:crypto` with an injectable cost, not a
  bare digest. Sign-in returns one error for both a wrong password and an
  unknown email, so there is no account-enumeration oracle.
- **Roles** come from `NEUTV_ADMIN_EMAILS` at deployment. SSO cannot mint an
  admin; neither can signup.

Sessions expire by timestamp and are treated as expired on read, so the hourly
sweep is housekeeping rather than correctness.

Tests: `npm run test:identity`.
