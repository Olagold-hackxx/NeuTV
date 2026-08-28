/**
 * Catalog access layer.
 *
 * app.js used to destructure window.CentralData at the top of its IIFE, which
 * runs the moment the script loads - before NeuTV.hydrate() has filled it in
 * from the API. The constants were therefore frozen to whatever was bundled,
 * and every hydrated value was silently discarded. The whole backend
 * integration was inert and nothing failed loudly enough to notice.
 *
 * read() resolves the catalog on demand instead. App() calls it during render,
 * which is after hydration, so live data actually reaches the tree - and a
 * later re-hydration would be picked up too.
 *
 * There is no bundled content behind this any more. Everything read() returns
 * came from the API on this page load; the empty defaults below exist so a
 * render that somehow beats hydration cannot crash on an undefined array, not
 * as a second copy of the catalog to fall back on.
 */
(function () {
  'use strict';

  var EMOJIS = ['❤️', '🔥', '👏', '🎉', '🚀', '⭐', '💖', '💎'];

  // Cost is authoritative on the server; these are for rendering the picker.
  var GIFTS = [
    { id: 'giftbox', name: 'Luxury Gift Box', emoji: '🎁', cost: 1000, label: '1,000 Coins' },
    { id: 'crown', name: 'Royal Crown', emoji: '👑', cost: 500, label: '500 Coins' },
    { id: 'diamond', name: 'Diamond Gem', emoji: '💎', cost: 250, label: '250 Coins' },
    { id: 'rocket', name: 'Rocket Booster', emoji: '🚀', cost: 100, label: '100 Coins' },
    { id: 'flame', name: 'Super Flame', emoji: '🔥', cost: 50, label: '50 Coins' },
    { id: 'trophy', name: 'Golden Trophy', emoji: '🏆', cost: 75, label: '75 Coins' },
    { id: 'car', name: 'Supercar Key', emoji: '🏎️', cost: 350, label: '350 Coins' },
    { id: 'spike', name: 'Kash Spike', emoji: '⚡', cost: 25, label: '25 Coins' },
    { id: 'applause', name: 'Applause', emoji: '👏', cost: 10, label: '10 Coins' }
  ];

  /** Snapshot of the catalog as it stands right now. Call it during render. */
  function read() {
    var data = window.CentralData || {};
    return {
      PRODUCTS: data.PRODUCTS || [],
      PRODUCT_COMMUNITY_HUBS: data.PRODUCT_COMMUNITY_HUBS || {},
      INITIAL_CENTRAL_TV: data.INITIAL_CENTRAL_TV || {},
      SAMPLE_LIVE_COMMENTS: data.SAMPLE_LIVE_COMMENTS || [],
      INITIAL_MEDIA_ROWS: data.INITIAL_MEDIA_ROWS || [],
      INITIAL_POSTS: data.INITIAL_POSTS || [],
      TRENDING_TOPICS: data.TRENDING_TOPICS || [],
      PLATFORMS: data.PLATFORMS || [],
      SCHEDULE_ITEMS: data.SCHEDULE_ITEMS || [],
      VOD_LIBRARY: data.VOD_LIBRARY || [],
      CREATOR_SPOTLIGHTS: data.CREATOR_SPOTLIGHTS || [],
      /** The published admin library, exactly as the back office holds it. */
      LIBRARY: data.LIBRARY || [],
      /** true once the API has supplied the catalog. */
      isLive: Boolean(window.NEUTV_LIVE)
    };
  }

  window.NeuTVCatalog = {
    read: read,
    EMOJIS: EMOJIS,
    GIFTS: GIFTS
  };
})();
