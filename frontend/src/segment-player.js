/**
 * Segment player for browser-originated broadcasts.
 *
 * The admin page records with MediaRecorder and posts chunks; this fetches them
 * and appends them through MediaSource so they play as one continuous stream.
 *
 * Three things this has to get right:
 *
 *   1. The init segment first, always. A viewer joining an hour in still needs
 *      the WebM header to decode anything, so seq 0 is fetched before any media
 *      segment regardless of where the manifest currently starts.
 *   2. One append at a time. SourceBuffer rejects an append while another is in
 *      flight, so segments queue and drain in order.
 *   3. Stay near the edge. A player that falls behind drifts further every
 *      poll, so if the buffer runs more than a few seconds ahead of playback we
 *      jump forward instead of accumulating delay.
 */
(function () {
  'use strict';

  var MIME = 'video/webm; codecs="vp9,opus"';
  var FALLBACK_MIME = 'video/webm; codecs="vp8,opus"';

  function pickMime() {
    if (!window.MediaSource) return null;
    if (window.MediaSource.isTypeSupported(MIME)) return MIME;
    if (window.MediaSource.isTypeSupported(FALLBACK_MIME)) return FALLBACK_MIME;
    return null;
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {string} eventId
   * @param {{ base?: string, pollMs?: number, onError?: (e: Error) => void }} [options]
   * @returns {() => void} stop
   */
  function play(video, eventId, options) {
    var opts = options || {};
    var base = (opts.base !== undefined ? opts.base : (window.NEUTV_API_BASE || '')) + '/api/v1';
    var pollMs = opts.pollMs || 1500;

    var mime = pickMime();
    if (!mime) {
      if (opts.onError) opts.onError(new Error('This browser cannot play WebM broadcasts.'));
      return function () {};
    }

    var mediaSource = new MediaSource();
    var sourceBuffer = null;
    var queue = [];
    var appending = false;
    var lastSeq = -1;
    // A viewer joining a broadcast already in progress starts at the live edge.
    // Replaying the whole rolling window meant fetching up to 60 segments
    // serially - two minutes of video - before the first frame. That was the
    // ~30s hang on joining a live stream.
    var joined = false;
    var haveInit = false;
    var stopped = false;
    var timer = null;

    video.src = URL.createObjectURL(mediaSource);

    function drain() {
      if (stopped || appending || !sourceBuffer || sourceBuffer.updating || queue.length === 0) return;
      appending = true;
      var chunk = queue.shift();
      try {
        sourceBuffer.appendBuffer(chunk);
      } catch (err) {
        appending = false;
        // QuotaExceededError means the buffer is full: drop what has already
        // been played and try again rather than dying.
        if (err && err.name === 'QuotaExceededError' && video.currentTime > 10) {
          try { sourceBuffer.remove(0, video.currentTime - 5); } catch (e) { /* ignore */ }
          queue.unshift(chunk);
        } else if (opts.onError) {
          opts.onError(err);
        }
      }
    }

    function fetchSegment(seq) {
      return fetch(base + '/live-event/' + encodeURIComponent(eventId) + '/segment/' + seq)
        .then(function (res) {
          // A segment that has rolled out of the window is gone for good; skip
          // it rather than stalling forever.
          if (res.status === 404) return null;
          if (!res.ok) throw new Error('segment ' + seq + ' failed (' + res.status + ')');
          return res.arrayBuffer();
        });
    }

    function poll() {
      if (stopped) return;
      fetch(base + '/live-event/' + encodeURIComponent(eventId) + '/manifest?after=' + lastSeq)
        .then(function (res) { return res.ok ? res.json() : null; })
        .then(function (manifest) {
          if (stopped || !manifest) return;
          var wanted = manifest.segments.filter(function (s) { return s.seq > lastSeq; });

          if (!joined) {
            joined = true;
            // Keep the init segment - nothing decodes without it - and only the
            // newest couple of media segments, so playback starts at live.
            var edge = Math.max(manifest.head - JOIN_TAIL, 0);
            wanted = wanted.filter(function (s) { return s.seq === 0 || s.seq >= edge; });
          }

          // The header comes first even if the window has moved past it.
          var chain = Promise.resolve();
          if (!haveInit && !wanted.some(function (s) { return s.seq === 0; })) {
            chain = fetchSegment(0).then(function (buf) {
              if (buf) { queue.push(buf); haveInit = true; drain(); }
            });
          }

          return chain.then(function () {
            return wanted.reduce(function (p, seg) {
              return p.then(function () {
                return fetchSegment(seg.seq).then(function (buf) {
                  if (stopped || !buf) return;
                  if (seg.seq === 0) haveInit = true;
                  queue.push(buf);
                  lastSeq = Math.max(lastSeq, seg.seq);
                  drain();
                });
              });
            }, Promise.resolve());
          });
        })
        .catch(function (err) { if (opts.onError) opts.onError(err); })
        .then(function () { if (!stopped) timer = setTimeout(poll, pollMs); });
    }

    mediaSource.addEventListener('sourceopen', function () {
      try {
        sourceBuffer = mediaSource.addSourceBuffer(mime);
      } catch (err) {
        if (opts.onError) opts.onError(err);
        return;
      }
      sourceBuffer.mode = 'sequence';
      sourceBuffer.addEventListener('updateend', function () {
        appending = false;

        // Never let the delay grow. If we are buffered well ahead of where we
        // are playing, skip forward to the edge.
        try {
          if (sourceBuffer.buffered.length) {
            var end = sourceBuffer.buffered.end(sourceBuffer.buffered.length - 1);
            if (end - video.currentTime > 6) video.currentTime = end - 1.5;
          }
        } catch (e) { /* buffered can throw while updating */ }

        drain();
      });
      poll();
    });

    return function stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      queue = [];
      try { if (mediaSource.readyState === 'open') mediaSource.endOfStream(); } catch (e) { /* ignore */ }
      try { URL.revokeObjectURL(video.src); } catch (e) { /* ignore */ }
      video.removeAttribute('src');
      video.load();
    };
  }

  window.NeuTVSegmentPlayer = { play: play, supported: function () { return Boolean(pickMime()); } };
})();
