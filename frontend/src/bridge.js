/**
 * API bridge.
 *
 * Every handler in app.js updates local state first and then calls through
 * here. Two rules make that safe:
 *
 *   1. If the backend is unreachable, sync() resolves to null and the app
 *      behaves exactly as it did before there was a backend. The page has
 *      always worked standalone and it still does.
 *   2. A rejected call never throws into a React handler. It reports through
 *      onError so the UI can reconcile, and is otherwise swallowed.
 *
 * The optimistic-then-reconcile shape is deliberate: a like should register the
 * instant it is tapped, not a round trip later.
 */
(function () {
  'use strict';

  function isLive() {
    return Boolean(window.NEUTV_LIVE && window.NeuTV);
  }

  /**
   * Run an API call if the backend is there.
   * @param {(api: object) => Promise<any>} fn
   * @param {(err: Error) => void} [onError] called on failure, after logging
   * @returns {Promise<any|null>} null when offline or on failure
   */
  function sync(fn, onError) {
    if (!isLive()) return Promise.resolve(null);
    var result;
    try {
      result = fn(window.NeuTV);
    } catch (err) {
      if (onError) onError(err);
      return Promise.resolve(null);
    }
    if (!result || typeof result.then !== 'function') return Promise.resolve(result);
    return result.catch(function (err) {
      // 401 is normal: the viewer is signed out. Anything else is worth seeing.
      if (err && err.status !== 401 && window.console) {
        console.warn('[NeuTV] ' + (err.message || 'request failed'));
      }
      if (onError) onError(err);
      return null;
    });
  }

  window.NeuTVBridge = { isLive: isLive, sync: sync };
})();
