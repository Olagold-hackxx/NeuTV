'use client';

/**
 * Broadcast studio.
 *
 * Captures camera or screen in this tab, records it in short chunks with
 * MediaRecorder, and posts each chunk to the API. Viewers fetch those chunks
 * and append them through MediaSource.
 *
 * Latency is roughly one chunk plus a little: a segment cannot be sent until it
 * has been recorded. That is a broadcast, not a conversation. Sub-second needs
 * an SFU, which is what the mux/cloudflare ingest drivers are for.
 *
 * Chunks upload in order and one at a time. Overlapping them would let segment
 * 7 land before segment 6, and a container appended out of order does not
 * decode.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { startLiveEvent, stopLiveEvent } from '@/lib/actions';
import type { LiveEvent } from '@/lib/types';
import { publishWhip, type Publisher } from '@/lib/whip';

const CHUNK_MS = 2000;

type Source = 'camera' | 'screen';

export function Studio({ event }: { event: LiveEvent }) {
  const router = useRouter();
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const publisherRef = useRef<Publisher | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Serialises uploads: every chunk waits for the one before it.
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const statsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initSentRef = useRef(false);

  const [source, setSource] = useState<Source>('camera');
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sent, setSent] = useState(0);
  const [dropped, setDropped] = useState(0);
  const [kbps, setKbps] = useState(0);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  }, []);

  useEffect(() => () => {
    // Leaving the page must not leave the camera light on.
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    stopTracks();
  }, [stopTracks]);

  const upload = useCallback(async (blob: Blob, isInit: boolean) => {
    const res = await fetch(`/api/live-segment/${event.id}${isInit ? '?init=1' : ''}`, {
      method: 'PUT',
      headers: { 'content-type': blob.type || 'video/webm' },
      body: blob,
    });
    if (!res.ok) throw new Error(`segment rejected (${res.status})`);
    setSent((n) => n + 1);
    setKbps(Math.round((blob.size * 8) / CHUNK_MS));
  }, [event.id]);

  // Going on air is not re-entrant.
  //
  // `recording` only becomes true once capture, the handshake and the go-live
  // call have all finished, so a second click during the permission prompt used
  // to start a second capture and a second peer connection. Both published to
  // the same path, the newer one evicted the older - "closing existing
  // publisher" - and the restart broke the muxer's continuity mid-broadcast.
  const startingRef = useRef(false);

  const begin = async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    setError(null);
    setNotice(null);
    try {
      const stream = source === 'screen'
        ? await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: true })
        : await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: 30 },
            audio: true,
          });

      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play().catch(() => { /* autoplay policy */ });
      }

      // WHIP first. A peer connection sends frames as they are captured, so
      // ingest is sub-second; MediaRecorder cannot send a chunk until it has
      // finished recording it, which put a three-second floor under the old
      // path. The segment path stays below as the fallback for a deployment
      // with no WebRTC ingest configured.
      // WHIP is preferred, but never required.
      //
      // This used to be an unguarded `await`. When WHIP was configured and the
      // ingest server could not actually take it — WebRTC disabled, UDP blocked,
      // the endpoint 404ing — the throw skipped straight to the outer catch and
      // the segment path below was never reached. The broadcast did not degrade,
      // it simply did not happen: nothing on air, nothing uploaded, zero bytes.
      // A broken fast path must fall back to the slow one, not replace it.
      if (event.whipUrl) {
        try {
          const publisher = await publishWhip(event.whipUrl, stream, (state) => {
            if (state === 'failed' || state === 'disconnected') {
              setError('The connection to the broadcast server dropped.');
            }
          });
          publisherRef.current = publisher;
          setRecording(true);
          if (!event.isLive) await startLiveEvent(event.id);
          router.refresh();

          // Stats come from the peer connection rather than from chunk sizes.
          const timer = setInterval(async () => {
            try {
              const s = await publisher.stats();
              setKbps(s.kbps);
              setSent(s.frames);
            } catch { /* the connection is closing */ }
          }, 1000);
          statsRef.current = timer;
          return;
        } catch (err) {
          // Say which path is carrying the broadcast, so a silent downgrade to
          // three-second latency is not mistaken for the sub-second one.
          console.warn('WHIP ingest unavailable, falling back to segments:', err);
          setNotice(
            'The low-latency route was unavailable, so this is broadcasting over '
            + 'the segment path instead. Viewers will see it a few seconds behind.',
          );
        }
      }

      // Pick a container the browser will actually produce.
      const candidates = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t));
      if (!mimeType) throw new Error('This browser cannot record WebM. Try Chrome, Edge or Firefox.');

      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      recorderRef.current = recorder;
      initSentRef.current = false;

      recorder.ondataavailable = (ev) => {
        if (!ev.data || ev.data.size === 0) return;
        const isInit = !initSentRef.current;
        initSentRef.current = true;
        // Chain rather than fire-and-forget, so order is guaranteed.
        queueRef.current = queueRef.current
          .then(() => upload(ev.data, isInit))
          .catch((err) => {
            setDropped((n) => n + 1);
            setError(err instanceof Error ? err.message : 'A segment failed to upload.');
          });
      };

      // On air BEFORE the first chunk exists.
      //
      // This used to record first and go live afterwards, so every segment
      // recorded in between was posted to an event that was still scheduled.
      // The API now refuses those, but the ordering was the actual bug: if
      // going live fails - an event with no playback URL, another broadcast
      // already on air - there must be no recorder running and no camera light
      // on, and the operator has to be told rather than left watching a preview
      // of a broadcast that never started.
      if (!event.isLive) {
        const res = await startLiveEvent(event.id);
        if (!res.ok) throw new Error(res.error ?? 'Could not put the event on air.');
      }

      // The stream ending at the source (the user clicks "Stop sharing") has to
      // end the broadcast too, or we keep uploading nothing.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => { void end(); });

      recorder.start(CHUNK_MS);
      setRecording(true);
      router.refresh();
    } catch (err) {
      // Whatever failed, leave nothing running behind it.
      recorderRef.current?.state === 'recording' && recorderRef.current.stop();
      recorderRef.current = null;
      stopTracks();
      setRecording(false);
      setError(err instanceof Error ? err.message : 'Could not start capture.');
    } finally {
      startingRef.current = false;
    }
  };

  const end = async () => {
    if (statsRef.current) { clearInterval(statsRef.current); statsRef.current = null; }
    if (publisherRef.current) {
      await publisherRef.current.stop();
      publisherRef.current = null;
      stopTracks();
      setRecording(false);
      await stopLiveEvent(event.id);
      router.refresh();
      return;
    }
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
    stopTracks();
    setRecording(false);
    // Let the last queued chunk land before taking the event off air.
    await queueRef.current.catch(() => {});
    await stopLiveEvent(event.id);
    router.refresh();
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Studio</h2>
        {recording ? (
          <span className="pill pill-live"><span className="live-dot" /> broadcasting</span>
        ) : <span className="pill">idle</span>}
      </div>
      <div className="panel-body">
        {error ? <div className="alert alert-error">{error}</div> : null}
        {notice ? <div className="alert">{notice}</div> : null}

        <div className="preview-frame">
          <video
            ref={previewRef} muted playsInline
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
          {!recording ? (
            <div className="preview-empty">Preview appears here once you go on air.</div>
          ) : null}
        </div>

        {!recording ? (
          <div className="field">
            <label htmlFor="source">Capture</label>
            <select id="source" value={source} onChange={(e) => setSource(e.target.value as Source)}>
              <option value="camera">Camera and microphone</option>
              <option value="screen">Screen or window</option>
            </select>
            <p className="hint">
              Your browser will ask permission. Screen capture includes system audio
              only where the browser supports it.
            </p>
          </div>
        ) : (
          <div className="grid grid-3" style={{ marginBottom: 14 }}>
            <div><div className="stat-label">Segments sent</div><div className="stat-value">{sent}</div></div>
            <div><div className="stat-label">Bitrate</div><div className="stat-value">{kbps} kbps</div></div>
            <div><div className="stat-label">Dropped</div><div className={`stat-value${dropped ? ' text-danger' : ''}`}>{dropped}</div></div>
          </div>
        )}

        <div className="actions">
          {recording ? (
            <button type="button" className="btn btn-danger" onClick={() => { if (confirm('End the broadcast?')) void end(); }}>
              End broadcast
            </button>
          ) : (
            <button
              type="button" className="btn btn-primary"
              disabled={starting}
              onClick={() => { setStarting(true); void begin().finally(() => setStarting(false)); }}
            >
              {starting ? 'Going on air…' : 'Go on air from this browser'}
            </button>
          )}
        </div>

        <p className="hint" style={{ marginTop: 12 }}>
          {event.whipUrl
            ? 'Viewers see this about a second behind. '
            : `Viewers see this with roughly ${CHUNK_MS / 1000}–${(CHUNK_MS / 1000) * 3} seconds `}
          of delay: a segment cannot be sent until it has been recorded. Keep this
          tab open and visible; browsers throttle recording in background tabs.
        </p>
      </div>
    </div>
  );
}
