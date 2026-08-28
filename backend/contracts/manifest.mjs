// THE CONTRACT.
//
// Every route the NEU TV backend exposes, declared once. Services import this
// to build their routers; the conformance gate test asserts each service's
// router matches its slice exactly - no undeclared route can ship, and no
// declared route can silently disappear. This is the boundary the PRD's
// "typed interfaces in contracts/" rule asks for, enforced by a test rather
// than by discipline.
//
// auth: 'required' - caller must present a valid session
//       'optional' - works signed out, richer when signed in
//       'none'     - public, session ignored

export const ROUTES = [
  // --- catalog: the 24/7 network's content spine (read-only, public) --------
  { service: 'catalog', method: 'GET',  path: '/catalog/bootstrap',      auth: 'none', summary: 'Full window.CentralData payload, drop-in for the frontend.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/products',       auth: 'none', summary: 'Five ecosystem products for the left rail + SSO gate.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/hubs',           auth: 'none', summary: 'Community hubs keyed by product id.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/hubs/:hubId',    auth: 'none', summary: 'One community hub with channels and perks.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/spotlights',     auth: 'none', summary: 'Creator spotlight reel cards.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/media-rows',     auth: 'none', summary: 'Panning marquee rows.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/platforms',      auth: 'none', summary: 'Platform directory tiles.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/schedule',       auth: 'none', summary: 'Linear programming schedule, current block flagged.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/vod',            auth: 'none', summary: 'On-demand library.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/trending',       auth: 'none', summary: 'Trending topics rail.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/hashtags',       auth: 'none', summary: 'Aggregated hashtag feeds and their moderated posts.' },
  { service: 'catalog', method: 'GET',  path: '/catalog/search',         auth: 'none', summary: 'Cross-catalog search for the top nav.' },

  // --- identity: unified SSO across the five products ----------------------
  { service: 'identity', method: 'GET',  path: '/identity/providers',            auth: 'none',     summary: 'SSO providers with their consent scopes.' },
  { service: 'identity', method: 'GET',  path: '/identity/consent/:productId',   auth: 'none',     summary: 'Consent checklist shown in the SSO gate.' },
  { service: 'identity', method: 'POST', path: '/identity/sso',                  auth: 'none',     summary: 'One-click sign-in through an ecosystem product.' },
  { service: 'identity', method: 'POST', path: '/identity/signup',               auth: 'none',     summary: 'Create a NEU Passport.' },
  { service: 'identity', method: 'POST', path: '/identity/signin',               auth: 'none',     summary: 'Email + password sign-in.' },
  { service: 'identity', method: 'POST', path: '/identity/logout',               auth: 'required', summary: 'Revoke the current session.' },
  { service: 'identity', method: 'GET',  path: '/identity/me',                   auth: 'required', summary: 'Current viewer, badge and granted scopes.' },
  { service: 'identity', method: 'GET',  path: '/identity/session',              auth: 'optional', summary: 'Session probe. Never 401s; reports guest state.' },

  // --- wallet: KashCoin balance, ledger, gifting ---------------------------
  { service: 'wallet', method: 'GET',  path: '/wallet',        auth: 'required', summary: 'Balance. Opens at 0, no sign-in bonus.' },
  { service: 'wallet', method: 'GET',  path: '/wallet/gifts',  auth: 'none',     summary: 'Gift catalog with coin costs.' },
  { service: 'wallet', method: 'GET',  path: '/wallet/ledger', auth: 'required', summary: 'Double-entry ledger for this viewer.' },
  { service: 'wallet', method: 'POST', path: '/wallet/tip',    auth: 'required', summary: 'Spend coins on a gift to a stream or creator.' },
  { service: 'wallet', method: 'POST', path: '/wallet/credit', auth: 'required', summary: 'Credit coins (topup/reward). Idempotent by reference.' },

  // --- social: the official announcements feed -----------------------------
  { service: 'social', method: 'GET',  path: '/social/posts',                auth: 'optional', summary: 'Feed, filterable by product, cursor paginated.' },
  { service: 'social', method: 'POST', path: '/social/posts',                auth: 'required', summary: 'Publish a post. Moderated before it lands.' },
  { service: 'social', method: 'GET',  path: '/social/posts/:postId',        auth: 'optional', summary: 'Single post with viewer engagement state.' },
  { service: 'social', method: 'POST', path: '/social/posts/:postId/upvote', auth: 'required', summary: 'Toggle like/upvote.' },
  { service: 'social', method: 'POST', path: '/social/posts/:postId/save',   auth: 'required', summary: 'Toggle bookmark.' },
  { service: 'social', method: 'POST', path: '/social/posts/:postId/share',  auth: 'optional', summary: 'Record a share, return the canonical link.' },
  { service: 'social', method: 'GET',  path: '/social/posts/:postId/comments', auth: 'optional', summary: 'Comment drawer contents.' },
  { service: 'social', method: 'POST', path: '/social/posts/:postId/comments', auth: 'required', summary: 'Add a comment. Moderated before it lands.' },
  { service: 'social', method: 'POST', path: '/social/follows/:handle',      auth: 'required', summary: 'Toggle following a creator.' },
  { service: 'social', method: 'GET',  path: '/social/follows',              auth: 'required', summary: 'Handles this viewer follows.' },

  // --- live: the 24/7 central stage ----------------------------------------
  { service: 'live', method: 'GET',  path: '/live/state',        auth: 'optional', summary: 'Central TV programme + telemetry.' },
  { service: 'live', method: 'GET',  path: '/live/telemetry',    auth: 'none',     summary: 'Viewer count, resolution, ON AIR, uptime.' },
  { service: 'live', method: 'GET',  path: '/live/stage',        auth: 'optional', summary: "What is on this viewer's stage now, and what it reverts to." },
  { service: 'live', method: 'POST', path: '/live/stage',        auth: 'optional', summary: 'Take the stage over with a video. Reverts to the main broadcast when it ends.' },
  { service: 'live', method: 'POST', path: '/live/stage/revert', auth: 'optional', summary: 'End a takeover early and return to the main broadcast.' },
  { service: 'live', method: 'POST', path: '/live/tv/like',      auth: 'required', summary: 'Toggle the broadcast like.' },
  { service: 'live', method: 'GET',  path: '/live/comments',     auth: 'none',     summary: 'Floating comment ticker backlog.' },
  { service: 'live', method: 'POST', path: '/live/comments',     auth: 'required', summary: 'Post to the floating ticker. Moderated.' },
  { service: 'live', method: 'POST', path: '/live/reactions',    auth: 'optional', summary: 'Fire a reaction particle.' },
  { service: 'live', method: 'GET',  path: '/live/reactions',    auth: 'none',     summary: 'Reaction totals per emoji.' },
  { service: 'live', method: 'GET',  path: '/live/chat/:serverId/:channelId', auth: 'optional', summary: 'Community hub channel backlog.' },
  { service: 'live', method: 'POST', path: '/live/chat/:serverId/:channelId', auth: 'required', summary: 'Send to a hub channel. Moderated.' },
  { service: 'live', method: 'GET',  path: '/live/leaderboard',  auth: 'none',     summary: 'Top gifters on the current broadcast.' },
  { service: 'live', method: 'POST', path: '/live/presence',     auth: 'optional', summary: 'Heartbeat that keeps a viewer counted.' },
  { service: 'live', method: 'GET',  path: '/live/stream',       auth: 'none',     summary: 'SSE: telemetry, comments, reactions, gifts, chat.', stream: true },

  // --- admin / CRM: the back office behind the network ---------------------
  // auth: 'admin' is enforced by the gateway from the identity session's role
  // claim, so no handler here can forget to check.
  { service: 'admin', method: 'GET',    path: '/admin/videos',               auth: 'admin', summary: 'Video library with upload and publish state.' },
  { service: 'admin', method: 'POST',   path: '/admin/videos',               auth: 'admin', summary: 'Register a video and get an upload target.' },
  { service: 'admin', method: 'GET',    path: '/admin/videos/:videoId',      auth: 'admin', summary: 'One video with its playback sources.' },
  { service: 'admin', method: 'PUT',    path: '/admin/videos/:videoId',      auth: 'admin', summary: 'Update video metadata or publish state.' },
  { service: 'admin', method: 'DELETE', path: '/admin/videos/:videoId',      auth: 'admin', summary: 'Archive a video. Never unlinks the file under it.' },
  { service: 'admin', method: 'PUT',    path: '/admin/videos/:videoId/file', auth: 'admin', summary: 'Stream a video file up. Raw binary body, not multipart.', raw: true },
  { service: 'admin', method: 'GET',    path: '/admin/programme',            auth: 'admin', summary: 'The main broadcast plus the history of what held it.' },
  { service: 'admin', method: 'PUT',    path: '/admin/programme',            auth: 'admin', summary: 'Set the video that owns the main page.' },
  { service: 'admin', method: 'GET',    path: '/admin/crm/overview',         auth: 'admin', summary: 'Viewers, engagement, gifting and moderation at a glance.' },
  { service: 'admin', method: 'GET',    path: '/admin/crm/viewers',          auth: 'admin', summary: 'Viewer roster with spend and activity.' },
  { service: 'admin', method: 'GET',    path: '/admin/crm/moderation',       auth: 'admin', summary: 'Moderation queue: everything flagged for review.' },
  // Public read of the current programme: what the stage reverts to, and what
  // a cold frontend loads before any takeover happens.
  // --- live events: an admin going on air --------------------------------
  { service: 'admin', method: 'GET',    path: '/admin/live-events',                  auth: 'admin', summary: 'Live events: scheduled, on air and ended.' },
  { service: 'admin', method: 'POST',   path: '/admin/live-events',                  auth: 'admin', summary: 'Schedule an event and mint its stream key.' },
  { service: 'admin', method: 'GET',    path: '/admin/live-events/:eventId',         auth: 'admin', summary: 'One event, including its ingest credentials.' },
  { service: 'admin', method: 'PUT',    path: '/admin/live-events/:eventId',         auth: 'admin', summary: 'Edit an event that is not on air.' },
  { service: 'admin', method: 'POST',   path: '/admin/live-events/:eventId/start',   auth: 'admin', summary: 'Go on air. Supersedes the programme.' },
  { service: 'admin', method: 'POST',   path: '/admin/live-events/:eventId/stop',    auth: 'admin', summary: 'End the broadcast and fall back to the programme.' },
  { service: 'admin', method: 'POST',   path: '/admin/live-events/:eventId/rotate',  auth: 'admin', summary: 'Mint a new stream key and invalidate the old one.' },
  { service: 'admin', method: 'DELETE', path: '/admin/live-events/:eventId',         auth: 'admin', summary: 'Cancel an event that is not on air.' },
  // Broadcasting from the admin page: the browser records and posts segments.
  { service: 'admin', method: 'PUT',    path: '/admin/live-events/:eventId/segment',  auth: 'admin', summary: 'Append one recorded segment. Raw binary body.', raw: true },
  // Public playback of a browser broadcast. A player polls the manifest and
  // appends the segments it has not seen.
  { service: 'admin', method: 'GET',    path: '/live-event/:eventId/manifest',        auth: 'none',  summary: 'Which segments exist right now.' },
  { service: 'admin', method: 'GET',    path: '/live-event/:eventId/segment/:seq',    auth: 'none',  summary: 'One segment of a browser broadcast.', stream: true },

  // Public: what is on air. Never carries the stream key.
  { service: 'admin', method: 'GET',    path: '/live-event/current',                 auth: 'none',  summary: 'The live event on air right now, if any.' },

  { service: 'admin', method: 'GET',    path: '/programme/current',          auth: 'none',  summary: 'The main broadcast the stage returns to.' },
  // Public read of a PUBLISHED video. The live service resolves stage takeovers
  // through this: the admin route is admin-only, which works in-process but
  // 403s the moment the services are split across hosts.
  // Public read of the published library. The viewer app builds its on-demand
  // shelves from this, so what the back office publishes is what the site
  // carries - there is no second, hardcoded copy of the catalog in the browser.
  { service: 'admin', method: 'GET',    path: '/videos',                     auth: 'none',  summary: 'Every published video, newest first.' },
  { service: 'admin', method: 'GET',    path: '/videos/:videoId',            auth: 'none',  summary: 'A published video, for stage playback.' },

  // --- moderation: the gate every piece of user text passes through --------
  { service: 'moderation', method: 'POST', path: '/moderation/check',  auth: 'optional', summary: 'Classify user text against the deterministic ruleset.' },
  { service: 'moderation', method: 'GET',  path: '/moderation/health', auth: 'none',     summary: 'Ruleset version, thresholds and decision counts.' },

];

export const AUTH_LEVELS = ['none', 'optional', 'required', 'admin'];

export const SERVICES = [...new Set(ROUTES.map((r) => r.service))];

export const routesFor = (service) => ROUTES.filter((r) => r.service === service);

export const findRoute = (method, path) =>
  ROUTES.find((r) => r.method === method && r.path === path) || null;
