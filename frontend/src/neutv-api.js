/**
 * NEU TV browser client.
 *
 * One object, window.NeuTV, covering the whole v1 contract. Zero dependencies,
 * no build step, loads from a plain script tag like everything else in this app.
 *
 * Two things it does before React ever renders:
 *   1. hydrate() replaces window.CentralData with the live catalog, and leaves
 *      the inline blob untouched if the backend is unreachable. The page works
 *      offline exactly as it does today; it just gets live data when it can.
 *   2. keeps a session token and a stable anonymous viewer id in localStorage,
 *      so the stage remembers what a returning viewer was watching.
 */
(function () {
  'use strict';

  var BASE = (window.NEUTV_API_BASE || '') + '/api/v1';
  var TOKEN_KEY = 'neutv.session.token';
  var VIEWER_KEY = 'neutv.viewer.id';

  // localStorage throws in some privacy modes; the client must never be the
  // reason the page fails to render.
  function readStore(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { window.localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function clearStore(key) {
    try { window.localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  var token = readStore(TOKEN_KEY);

  function viewerId() {
    var id = readStore(VIEWER_KEY);
    if (!id) {
      // Must satisfy the server's ^[A-Za-z0-9_-]{4,64}$.
      id = 'v' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      writeStore(VIEWER_KEY, id);
    }
    return id;
  }

  function request(method, path, body, options) {
    var opts = options || {};
    var headers = { 'content-type': 'application/json' };
    if (token && opts.auth !== false) headers.authorization = 'Bearer ' + token;

    return fetch(BASE + path, {
      method: method,
      headers: headers,
      body: body === undefined || body === null ? undefined : JSON.stringify(body),
    }).then(function (res) {
      return res.text().then(function (text) {
        var parsed = text ? JSON.parse(text) : null;
        if (res.ok) return parsed;
        // A dead session should log the viewer out rather than 401 forever.
        if (res.status === 401 && token) { token = null; clearStore(TOKEN_KEY); }
        var err = new Error((parsed && parsed.error && parsed.error.message) || ('HTTP ' + res.status));
        err.status = res.status;
        err.code = parsed && parsed.error && parsed.error.code;
        err.details = parsed && parsed.error && parsed.error.details;
        throw err;
      });
    });
  }

  var get = function (p, o) { return request('GET', p, null, o); };
  var post = function (p, b, o) { return request('POST', p, b || {}, o); };
  var put = function (p, b, o) { return request('PUT', p, b || {}, o); };
  var del = function (p, o) { return request('DELETE', p, null, o); };

  function keepSession(res) {
    if (res && res.session && res.session.token) {
      token = res.session.token;
      writeStore(TOKEN_KEY, token);
    }
    return res;
  }

  var NeuTV = {
    baseUrl: BASE,
    viewerId: viewerId,
    isSignedIn: function () { return Boolean(token); },
    token: function () { return token; },

    /**
     * Build window.CentralData from the API.
     *
     * This used to merge over a 34KB blob bundled into the page, which meant
     * the site rendered a hardcoded copy of the catalog whether or not the
     * backend agreed with it - and an operator could publish a video in the
     * back office and never see it appear. There is no second copy now: the
     * catalog service supplies the editorial content and the admin library
     * supplies the videos, and both arrive over the wire.
     *
     * Resolves to { live: boolean }; it never rejects, so a caller can render
     * an honest error state instead of handling a throw.
     */
    hydrate: function () {
      return get('/catalog/bootstrap', { auth: false })
        .then(function (data) {
          // The library is what the back office publishes. It is fetched
          // alongside the catalog rather than after it, and a failure here is
          // not fatal: the page still has its editorial content.
          return get('/videos?limit=200', { auth: false })
            .catch(function () { return { videos: [] }; })
            .then(function (library) {
              var videos = (library && library.videos) || [];
              window.CentralData = Object.assign({}, data, {
                LIBRARY: videos,
                // On-demand shelves render straight from the published library,
                // so publishing a video in the back office puts it on the site.
                // The catalog's own VOD list is the fallback only while the
                // library is empty - a fresh database, before it is seeded.
                VOD_LIBRARY: videos.length ? videos.map(NeuTV.toVodItem) : (data.VOD_LIBRARY || []),
              });
              window.NEUTV_LIVE = true;
              return { live: true, checksum: data.checksum, library: videos.length };
            });
        })
        .catch(function (err) {
          window.NEUTV_LIVE = false;
          if (window.console) console.error('[NeuTV] the API is unreachable:', err.message);
          return { live: false, error: err.message };
        });
    },

    /**
     * A library video in the shape the on-demand shelves render.
     *
     * The admin store speaks in playbackUrl/posterUrl/durationSeconds; the
     * player reads videoUrl/thumbnail/duration. This is the one place that
     * translation happens.
     */
    toVodItem: function (video) {
      var seconds = video.durationSeconds || 0;
      var minutes = Math.floor(seconds / 60);
      return {
        id: video.id,
        title: video.title,
        description: video.description || '',
        platformId: video.productId,
        productId: video.productId,
        duration: seconds
          ? String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
          : '',
        thumbnail: video.posterUrl || '',
        videoUrl: video.playbackUrl || '',
        youtubeId: video.youtubeId || null,
      };
    },

    health: function () { return fetch((window.NEUTV_API_BASE || '') + '/health').then(function (r) { return r.json(); }); },

    catalog: {
      bootstrap: function () { return get('/catalog/bootstrap', { auth: false }); },
      products: function () { return get('/catalog/products', { auth: false }); },
      hubs: function () { return get('/catalog/hubs', { auth: false }); },
      hub: function (id) { return get('/catalog/hubs/' + encodeURIComponent(id), { auth: false }); },
      spotlights: function () { return get('/catalog/spotlights', { auth: false }); },
      mediaRows: function () { return get('/catalog/media-rows', { auth: false }); },
      platforms: function () { return get('/catalog/platforms', { auth: false }); },
      schedule: function () { return get('/catalog/schedule', { auth: false }); },
      vod: function () { return get('/catalog/vod', { auth: false }); },
      trending: function () { return get('/catalog/trending', { auth: false }); },
      hashtags: function () { return get('/catalog/hashtags', { auth: false }); },
      search: function (q, limit) {
        return get('/catalog/search?q=' + encodeURIComponent(q) + (limit ? '&limit=' + limit : ''), { auth: false });
      },
    },

    identity: {
      providers: function () { return get('/identity/providers', { auth: false }); },
      consent: function (productId) { return get('/identity/consent/' + encodeURIComponent(productId), { auth: false }); },
      sso: function (productId, username, password) {
        return post('/identity/sso', { productId: productId, username: username, password: password }, { auth: false }).then(keepSession);
      },
      signup: function (form) { return post('/identity/signup', form, { auth: false }).then(keepSession); },
      signin: function (email, password) {
        return post('/identity/signin', { email: email, password: password }, { auth: false }).then(keepSession);
      },
      me: function () { return get('/identity/me'); },
      session: function () { return get('/identity/session'); },
      logout: function () {
        return post('/identity/logout').then(function (res) {
          token = null; clearStore(TOKEN_KEY);
          return res;
        });
      },
    },

    wallet: {
      balance: function () { return get('/wallet'); },
      gifts: function () { return get('/wallet/gifts', { auth: false }); },
      ledger: function (limit) { return get('/wallet/ledger' + (limit ? '?limit=' + limit : '')); },
      /** reference makes a retry safe: the same gift is never charged twice. */
      tip: function (giftId, target, opts) {
        var body = { giftId: giftId, target: target };
        var o = opts || {};
        body.reference = o.reference || (giftId + '-' + target.type + '-' + target.id + '-' + Date.now());
        if (o.message) body.message = o.message;
        return post('/wallet/tip', body);
      },
      credit: function (amount, opts) { return post('/wallet/credit', Object.assign({ amount: amount }, opts || {})); },
    },

    social: {
      feed: function (opts) {
        var o = opts || {};
        var q = [];
        if (o.product && o.product !== 'all') q.push('product=' + encodeURIComponent(o.product));
        if (o.cursor) q.push('cursor=' + encodeURIComponent(o.cursor));
        if (o.limit) q.push('limit=' + o.limit);
        return get('/social/posts' + (q.length ? '?' + q.join('&') : ''));
      },
      post: function (id) { return get('/social/posts/' + encodeURIComponent(id)); },
      create: function (body) { return post('/social/posts', body); },
      upvote: function (id) { return post('/social/posts/' + encodeURIComponent(id) + '/upvote'); },
      save: function (id) { return post('/social/posts/' + encodeURIComponent(id) + '/save'); },
      share: function (id) { return post('/social/posts/' + encodeURIComponent(id) + '/share', { origin: window.location.origin }); },
      comments: function (id) { return get('/social/posts/' + encodeURIComponent(id) + '/comments'); },
      comment: function (id, text) { return post('/social/posts/' + encodeURIComponent(id) + '/comments', { text: text }); },
      follow: function (handle) { return post('/social/follows/' + encodeURIComponent(handle)); },
      follows: function () { return get('/social/follows'); },
    },

    live: {
      state: function () { return get('/live/state?viewerId=' + viewerId()); },
      telemetry: function () { return get('/live/telemetry', { auth: false }); },

      /** What is on the stage now, and what it returns to. */
      stage: function () { return get('/live/stage?viewerId=' + viewerId()); },

      /**
       * Click a video: it takes over the main stage and reverts to the main
       * broadcast on its own when it ends. Pass scope 'broadcast' to promote it
       * to every viewer (requires broadcast rights).
       */
      takeStage: function (videoId, opts) {
        var o = opts || {};
        return post('/live/stage', {
          videoId: videoId,
          viewerId: viewerId(),
          scope: o.scope || 'viewer',
          durationMs: o.durationMs,
        });
      },

      /** Call on the player's 'ended' event, or when the viewer closes it. */
      revertStage: function (scope) { return post('/live/stage/revert', { viewerId: viewerId(), scope: scope || 'viewer' }); },

      like: function () { return post('/live/tv/like', { viewerId: viewerId() }); },
      comments: function (limit) { return get('/live/comments' + (limit ? '?limit=' + limit : ''), { auth: false }); },
      comment: function (text) { return post('/live/comments', { text: text }); },
      react: function (emoji) { return post('/live/reactions', { emoji: emoji }); },
      reactions: function () { return get('/live/reactions', { auth: false }); },
      chat: function (serverId, channelId) {
        return get('/live/chat/' + encodeURIComponent(serverId) + '/' + encodeURIComponent(channelId));
      },
      sendChat: function (serverId, channelId, text) {
        return post('/live/chat/' + encodeURIComponent(serverId) + '/' + encodeURIComponent(channelId), { text: text });
      },
      leaderboard: function () { return get('/live/leaderboard', { auth: false }); },
      presence: function () { return post('/live/presence', { viewerId: viewerId() }); },

      /**
       * Subscribe to the broadcast event stream.
       * handlers: { comment, reaction, gift, chat, stage, telemetry }
       * Returns a function that closes the connection.
       */
      subscribe: function (handlers) {
        var source = new EventSource((window.NEUTV_API_BASE || '') + '/api/v1/live/stream');
        Object.keys(handlers || {}).forEach(function (type) {
          source.addEventListener(type, function (event) {
            try { handlers[type](JSON.parse(event.data), event); } catch (e) { /* a bad frame must not kill the stream */ }
          });
        });
        return function () { source.close(); };
      },

      /** Heartbeat that keeps this viewer inside the live count. */
      startPresence: function (intervalMs) {
        var timer = setInterval(function () { NeuTV.live.presence().catch(function () {}); }, intervalMs || 20000);
        NeuTV.live.presence().catch(function () {});
        return function () { clearInterval(timer); };
      },
    },

    admin: {
      videos: function (query) { return get('/admin/videos' + (query ? '?' + query : '')); },
      video: function (id) { return get('/admin/videos/' + encodeURIComponent(id)); },
      createVideo: function (body) { return post('/admin/videos', body); },
      updateVideo: function (id, body) { return put('/admin/videos/' + encodeURIComponent(id), body); },
      archiveVideo: function (id) { return del('/admin/videos/' + encodeURIComponent(id)); },

      /** Raw binary upload. `file` is a File or Blob from an <input type=file>. */
      uploadVideo: function (id, file, onProgress) {
        return new Promise(function (resolve, reject) {
          var xhr = new XMLHttpRequest();
          xhr.open('PUT', BASE + '/admin/videos/' + encodeURIComponent(id) + '/file');
          xhr.setRequestHeader('content-type', file.type || 'video/mp4');
          if (token) xhr.setRequestHeader('authorization', 'Bearer ' + token);
          if (onProgress) {
            xhr.upload.onprogress = function (e) {
              if (e.lengthComputable) onProgress(e.loaded / e.total, e.loaded, e.total);
            };
          }
          xhr.onload = function () {
            var parsed = null;
            try { parsed = JSON.parse(xhr.responseText); } catch (e) { /* non-JSON error body */ }
            if (xhr.status >= 200 && xhr.status < 300) return resolve(parsed);
            var err = new Error((parsed && parsed.error && parsed.error.message) || ('HTTP ' + xhr.status));
            err.status = xhr.status;
            reject(err);
          };
          xhr.onerror = function () { reject(new Error('Upload failed.')); };
          xhr.send(file);
        });
      },

      programme: function () { return get('/admin/programme'); },
      /** Set the video that owns the main page. */
      setProgramme: function (videoId, note) { return put('/admin/programme', { videoId: videoId, note: note || '' }); },
      crm: function () { return get('/admin/crm/overview'); },
      crmViewers: function (limit) { return get('/admin/crm/viewers' + (limit ? '?limit=' + limit : '')); },
      moderationQueue: function (limit) { return get('/admin/crm/moderation' + (limit ? '?limit=' + limit : '')); },
    },

    /** Public: the published library. Drafts and archived videos never appear. */
    videos: {
      list: function (opts) {
        var o = opts || {};
        var q = [];
        if (o.productId) q.push('productId=' + encodeURIComponent(o.productId));
        if (o.limit) q.push('limit=' + o.limit);
        return get('/videos' + (q.length ? '?' + q.join('&') : ''), { auth: false });
      },
      get: function (id) { return get('/videos/' + encodeURIComponent(id), { auth: false }); },
    },

    /** Public: what the stage reverts to. */
    programme: function () { return get('/programme/current', { auth: false }); },

    /** Public: the live event on air, if any. Never carries a stream key. */
    liveEvent: function () { return get('/live-event/current', { auth: false }); },
  };

  window.NeuTV = NeuTV;
})();
