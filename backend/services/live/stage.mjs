// The broadcast stage state machine.
//
// The rule the product asks for: one video is the main broadcast and owns the
// main page. Clicking another video replaces it, and when that video finishes
// the stage returns to the main broadcast on its own.
//
// Implemented as expiry, not as a timer. A takeover stores when it ends, and
// every read compares that against the clock. Nothing has to fire on time,
// nothing leaks if the process restarts, and the revert is correct even for a
// viewer who closed the tab an hour ago. Pure function of (state, now), so the
// tests assert the revert without waiting for it.

export const MAX_TAKEOVER_MS = 4 * 60 * 60 * 1000; // 4h ceiling on any takeover
export const DEFAULT_TAKEOVER_MS = 10 * 60 * 1000; // used when a video's length is unknown

export const takeoverDuration = (durationSeconds, requestedMs = null) => {
  const fromVideo = Number(durationSeconds) > 0 ? Number(durationSeconds) * 1000 : null;
  const chosen = requestedMs ?? fromVideo ?? DEFAULT_TAKEOVER_MS;
  return Math.min(Math.max(Math.round(chosen), 1000), MAX_TAKEOVER_MS);
};

// overrides: { viewer: entry|null, broadcast: entry|null }
// entry: { videoId, video, startedAt, expiresAt, requestedBy, scope }
export function resolveStage({ base, overrides = {}, now }) {
  const live = (entry) => (entry && entry.expiresAt > now ? entry : null);

  // A viewer's own click beats a global promote: the person who chose what to
  // watch is the one looking at the screen.
  const active = live(overrides.viewer) || live(overrides.broadcast) || null;

  if (!active) {
    return {
      current: base,
      isOverride: false,
      scope: null,
      revertsAt: null,
      revertsIn: null,
      revertsTo: base,
      mainBroadcast: base,
    };
  }

  return {
    current: active.video,
    isOverride: true,
    scope: active.scope,
    startedAt: active.startedAt,
    revertsAt: active.expiresAt,
    revertsIn: active.expiresAt - now,
    revertsTo: base,
    mainBroadcast: base,
    requestedBy: active.requestedBy ?? null,
  };
}
