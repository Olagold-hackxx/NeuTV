// Fixed-window rate limiter, in-memory and per-process.
//
// Deterministic: the runtime clock is injected, so the gate tests assert exact
// reset boundaries instead of sleeping.

import { tooMany } from './errors.mjs';

export function createLimiter(runtime, { sweepEvery = 5000 } = {}) {
  const buckets = new Map();
  let lastSweep = 0;

  const sweep = (now) => {
    if (now - lastSweep < sweepEvery) return;
    lastSweep = now;
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  };

  return {
    // Throws ApiError(429) when the caller is over budget.
    check(key, { tokens, windowMs }) {
      const now = runtime.now();
      sweep(now);
      let b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      }
      b.count += 1;
      if (b.count > tokens) {
        throw tooMany('Too many requests. Slow down.', { retryAfterMs: b.resetAt - now });
      }
      return { remaining: tokens - b.count, resetAt: b.resetAt };
    },
    reset: () => buckets.clear(),
    size: () => buckets.size,
  };
}
