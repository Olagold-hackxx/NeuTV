// The stage state machine: one video owns the main page, a click takes it over,
// and it returns to the main broadcast when the video ends.
//
// resolveStage is pure, so "when the video ends" is asserted by moving the
// clock, not by sleeping. These tests would all pass in under a millisecond on
// a video that runs for four hours.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveStage, takeoverDuration, MAX_TAKEOVER_MS, DEFAULT_TAKEOVER_MS } from '../stage.mjs';

const base = { id: 'main-broadcast', title: 'NEU TV Central' };
const T = 1_000_000;
const entry = (over = {}) => ({
  videoId: 'cr-1', video: { id: 'cr-1', title: 'Clicked Video' },
  startedAt: T, expiresAt: T + 252_000, requestedBy: 'u1', scope: 'viewer', ...over,
});

test('with no takeover the main broadcast owns the stage', () => {
  const s = resolveStage({ base, now: T });
  assert.equal(s.current.id, 'main-broadcast');
  assert.equal(s.isOverride, false);
  assert.equal(s.revertsAt, null);
  assert.equal(s.mainBroadcast.id, 'main-broadcast');
});

test('a takeover replaces the stage and reports when it ends', () => {
  const s = resolveStage({ base, overrides: { viewer: entry() }, now: T + 1_000 });
  assert.equal(s.current.id, 'cr-1');
  assert.equal(s.isOverride, true);
  assert.equal(s.revertsAt, T + 252_000);
  assert.equal(s.revertsIn, 251_000);
  assert.equal(s.revertsTo.id, 'main-broadcast');
});

test('the stage returns to the main broadcast the instant the video ends', () => {
  const overrides = { viewer: entry() };
  // One millisecond before the end it is still playing.
  assert.equal(resolveStage({ base, overrides, now: T + 251_999 }).current.id, 'cr-1');
  // At the end, and ever after, the main broadcast is back. No timer fired.
  assert.equal(resolveStage({ base, overrides, now: T + 252_000 }).current.id, 'main-broadcast');
  assert.equal(resolveStage({ base, overrides, now: T + 252_001 }).isOverride, false);
  assert.equal(resolveStage({ base, overrides, now: T + 99_999_999 }).current.id, 'main-broadcast');
});

test("a viewer's own click beats a global promote", () => {
  const overrides = {
    viewer: entry(),
    broadcast: entry({ videoId: 'cr-9', video: { id: 'cr-9' }, scope: 'broadcast', expiresAt: T + 999_999 }),
  };
  assert.equal(resolveStage({ base, overrides, now: T + 1_000 }).current.id, 'cr-1');
  assert.equal(resolveStage({ base, overrides, now: T + 1_000 }).scope, 'viewer');
});

test('when the viewer takeover ends, a still-running global promote takes over', () => {
  const overrides = {
    viewer: entry(),
    broadcast: entry({ videoId: 'cr-9', video: { id: 'cr-9' }, scope: 'broadcast', expiresAt: T + 999_999 }),
  };
  const s = resolveStage({ base, overrides, now: T + 300_000 });
  assert.equal(s.current.id, 'cr-9');
  assert.equal(s.scope, 'broadcast');
});

test('an expired override is ignored, not resurrected', () => {
  const overrides = { viewer: entry({ expiresAt: T - 1 }) };
  assert.equal(resolveStage({ base, overrides, now: T }).current.id, 'main-broadcast');
});

test('takeover length follows the video, with a floor and a ceiling', () => {
  assert.equal(takeoverDuration(252), 252_000, 'uses the video length');
  assert.equal(takeoverDuration(0), DEFAULT_TAKEOVER_MS, 'unknown length falls back');
  assert.equal(takeoverDuration(null), DEFAULT_TAKEOVER_MS);
  assert.equal(takeoverDuration(252, 5_000), 5_000, 'an explicit request wins');
  assert.equal(takeoverDuration(99_999_999), MAX_TAKEOVER_MS, 'capped so a bad duration cannot pin the stage');
  assert.equal(takeoverDuration(0, 1), 1_000, 'floored so it cannot revert instantly');
});
