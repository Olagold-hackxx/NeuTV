// Password hashing with scrypt from node:crypto.
//
// Not sha256: a bare digest is trivially brute-forced against a leaked table.
// scrypt is memory-hard, is in the standard library, and costs no dependency.
// The cost parameter is injectable so gate tests stay under their 2s budget
// without weakening the real deployment.

import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

export const PROD_COST = { N: 16384, r: 8, p: 1, keylen: 64 };
export const TEST_COST = { N: 1024, r: 8, p: 1, keylen: 64 };

export function createPasswordHasher(cost = PROD_COST) {
  const derive = (password, salt) =>
    scryptSync(password, salt, cost.keylen, { N: cost.N, r: cost.r, p: cost.p, maxmem: 256 * 1024 * 1024 });

  return {
    hash(password, saltOverride = null) {
      const salt = saltOverride || randomBytes(16).toString('hex');
      return `scrypt$${cost.N}$${salt}$${derive(password, salt).toString('hex')}`;
    },
    // Constant-time compare so a timing side channel cannot leak the digest.
    verify(password, stored) {
      if (typeof stored !== 'string') return false;
      const [scheme, n, salt, digest] = stored.split('$');
      if (scheme !== 'scrypt' || !salt || !digest) return false;
      const candidate = scryptSync(password, salt, cost.keylen, {
        N: Number(n), r: cost.r, p: cost.p, maxmem: 256 * 1024 * 1024,
      });
      const expected = Buffer.from(digest, 'hex');
      if (expected.length !== candidate.length) return false;
      return timingSafeEqual(expected, candidate);
    },
  };
}
