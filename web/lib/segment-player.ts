'use client';

// Player for browser-originated broadcasts — a typed port of
// frontend/src/segment-player.js. The studio records with MediaRecorder and
// posts chunks; this fetches them and appends them through MediaSource so they
// play as one continuous stream.
//
// Three things this has to get right:
//   1. The init segment first, always — a viewer joining an hour in still
//      needs the WebM header to decode anything.
//   2. One append at a time — SourceBuffer rejects concurrent appends.
//   3. Stay near the edge — a player that falls behind drifts further every
//      poll, so jump forward instead of accumulating delay.

const MIME = 'video/webm; codecs="vp9,opus"';
// How much of the buffer a joining viewer takes before following live.
const JOIN_TAIL = 2;

const FALLBACK_MIME = 'video/webm; codecs="vp8,opus"';

function pickMime(): string | null {
  if (typeof window === 'undefined' || !window.MediaSource) return null;
  if (window.MediaSource.isTypeSupported(MIME)) return MIME;
  if (window.MediaSource.isTypeSupported(FALLBACK_MIME)) return FALLBACK_MIME;
  return null;
}

export function segmentPlaybackSupported(): boolean {
  return Boolean(pickMime());
}

export function playSegments(
  video: HTMLVideoElement,
  eventId: string,
  options: { base: string; pollMs?: number; onError?: (err: Error) => void },
): () => void {
  const base = options.base + '/api/v1';
  const pollMs = options.pollMs ?? 1500;
  const onError = options.onError;

  const mime = pickMime();
  if (!mime) {
    onError?.(new Error('This browser cannot play WebM broadcasts.'));
    return () => {};
  }

  const mediaSource = new MediaSource();
  let sourceBuffer: SourceBuffer | null = null;
  let queue: ArrayBuffer[] = [];
  let appending = false;
  let lastSeq = -1;
  // A viewer joining a broadcast already in progress starts at the live edge.
  // Replaying the whole rolling window first meant fetching up to 60 segments
  // serially - two minutes of video, tens of megabytes - before a single frame
  // appeared. That was the ~30s hang on joining a live stream.
  let joined = false;
  let haveInit = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  video.src = URL.createObjectURL(mediaSource);

  function drain() {
    if (stopped || appending || !sourceBuffer || sourceBuffer.updating || queue.length === 0) return;
    appending = true;
    const chunk = queue.shift()!;
    try {
      sourceBuffer.appendBuffer(chunk);
    } catch (err) {
      appending = false;
      // QuotaExceededError means the buffer is full: drop what has already
      // been played and try again rather than dying.
      if (err instanceof Error && err.name === 'QuotaExceededError' && video.currentTime > 10) {
        try {
          sourceBuffer.remove(0, video.currentTime - 5);
        } catch {
          /* ignore */
        }
        queue.unshift(chunk);
      } else if (err instanceof Error) {
        onError?.(err);
      }
    }
  }

  function fetchSegment(seq: number): Promise<ArrayBuffer | null> {
    return fetch(`${base}/live-event/${encodeURIComponent(eventId)}/segment/${seq}`).then((res) => {
      // A segment that has rolled out of the window is gone for good; skip it
      // rather than stalling forever.
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`segment ${seq} failed (${res.status})`);
      return res.arrayBuffer();
    });
  }

  function poll() {
    if (stopped) return;
    fetch(`${base}/live-event/${encodeURIComponent(eventId)}/manifest?after=${lastSeq}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((manifest: { segments: { seq: number }[]; head: number } | null) => {
        if (stopped || !manifest) return;
        let wanted = manifest.segments.filter((s) => s.seq > lastSeq);

        if (!joined) {
          joined = true;
          // Keep the init segment - nothing decodes without it - and only the
          // newest couple of media segments, so playback starts at live rather
          // than at the far end of the buffer.
          const edge = Math.max(manifest.head - JOIN_TAIL, 0);
          wanted = wanted.filter((s) => s.seq === 0 || s.seq >= edge);
        }

        // The header comes first even if the window has moved past it.
        let chain: Promise<unknown> = Promise.resolve();
        if (!haveInit && !wanted.some((s) => s.seq === 0)) {
          chain = fetchSegment(0).then((buf) => {
            if (buf) {
              queue.push(buf);
              haveInit = true;
              drain();
            }
          });
        }

        return chain.then(() =>
          wanted.reduce(
            (p, seg) =>
              p.then(() =>
                fetchSegment(seg.seq).then((buf) => {
                  if (stopped || !buf) return;
                  if (seg.seq === 0) haveInit = true;
                  queue.push(buf);
                  lastSeq = Math.max(lastSeq, seg.seq);
                  drain();
                }),
              ),
            Promise.resolve(),
          ),
        );
      })
      .catch((err: Error) => onError?.(err))
      .then(() => {
        if (!stopped) timer = setTimeout(poll, pollMs);
      });
  }

  mediaSource.addEventListener('sourceopen', () => {
    try {
      sourceBuffer = mediaSource.addSourceBuffer(mime);
    } catch (err) {
      if (err instanceof Error) onError?.(err);
      return;
    }
    sourceBuffer.mode = 'sequence';
    sourceBuffer.addEventListener('updateend', () => {
      appending = false;
      // Never let the delay grow: if buffered well ahead of playback, skip
      // forward to the edge.
      try {
        if (sourceBuffer!.buffered.length) {
          const end = sourceBuffer!.buffered.end(sourceBuffer!.buffered.length - 1);
          if (end - video.currentTime > 6) video.currentTime = end - 1.5;
        }
      } catch {
        /* buffered can throw while updating */
      }
      drain();
    });
    poll();
  });

  return function stop() {
    stopped = true;
    if (timer) clearTimeout(timer);
    queue = [];
    try {
      if (mediaSource.readyState === 'open') mediaSource.endOfStream();
    } catch {
      /* ignore */
    }
    try {
      URL.revokeObjectURL(video.src);
    } catch {
      /* ignore */
    }
    video.removeAttribute('src');
    video.load();
  };
}
