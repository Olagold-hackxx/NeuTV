// Clock + id generation, injectable.
//
// Nothing in a service calls Date.now() or Math.random() directly. Handlers take
// a runtime, tests pass a deterministic one, and every timestamp/id in a test
// assertion is exact instead of "roughly now".

import { randomUUID, randomBytes } from 'node:crypto';

export function realRuntime() {
  return {
    now: () => Date.now(),
    uuid: () => randomUUID(),
    token: () => randomBytes(32).toString('base64url'),
    // Sequence used for ordering within the same millisecond.
    seq: (() => { let n = 0; return () => ++n; })(),
  };
}

// Deterministic runtime: fixed epoch, counter-based ids. Used by every gate test.
export function fakeRuntime({ start = 1756339200000, step = 1000 } = {}) {
  let t = start;
  let n = 0;
  return {
    now: () => t,
    advance: (ms) => { t += ms; return t; },
    tick: () => { t += step; return t; },
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    token: () => `tok_${String(++n).padStart(8, '0')}`,
    seq: () => ++n,
  };
}


export function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
