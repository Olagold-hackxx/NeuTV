/**
 * WHIP publisher.
 *
 * WHIP (WebRTC-HTTP Ingestion Protocol) is a one-request handshake: POST an SDP
 * offer, get an SDP answer, and the peer connection carries the media from
 * there. MediaMTX speaks it natively.
 *
 * This replaces recording with MediaRecorder and posting chunks. That approach
 * could not go below about three seconds, because a chunk is not sendable until
 * it has finished recording; a peer connection sends frames as they are
 * captured. Ingest becomes sub-second, and MediaMTX repackages the result as
 * low-latency HLS so viewers still get a plain URL a CDN can cache.
 */

export interface Publisher {
  /** Frames actually sent, so the UI can show that something is moving. */
  stats(): Promise<{ kbps: number; frames: number; state: RTCPeerConnectionState }>;
  stop(): Promise<void>;
}

export async function publishWhip(
  whipUrl: string,
  stream: MediaStream,
  onStateChange?: (state: RTCPeerConnectionState) => void,
): Promise<Publisher> {
  const pc = new RTCPeerConnection({
    // A public STUN server is enough to discover the browser's own reflexive
    // address. MediaMTX advertises its reachable host, so no TURN relay is
    // needed unless the viewer's network blocks both UDP and TCP to it.
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  for (const track of stream.getTracks()) pc.addTrack(track, stream);
  if (onStateChange) pc.onconnectionstatechange = () => onStateChange(pc.connectionState);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // Wait for ICE gathering, so the offer carries candidates rather than
  // trickling them afterwards - WHIP has no channel for trickle.
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const done = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', done);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', done);
    // Some networks never reach 'complete'. Two seconds of candidates is
    // plenty, and going without the stragglers beats hanging forever.
    setTimeout(resolve, 2000);
  });

  const res = await fetch(whipUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/sdp' },
    body: pc.localDescription?.sdp ?? '',
  });

  if (!res.ok) {
    pc.close();
    throw new Error(
      res.status === 404
        ? 'The broadcast endpoint is not reachable. Is the live server running?'
        : `The broadcast server refused the connection (${res.status}).`,
    );
  }

  const answer = await res.text();
  await pc.setRemoteDescription({ type: 'answer', sdp: answer });

  // WHIP returns the session's own URL in Location; DELETE on it ends the
  // publish cleanly instead of waiting for a timeout.
  const session = res.headers.get('location');
  const sessionUrl = session ? new URL(session, whipUrl).toString() : null;

  let lastBytes = 0;
  let lastAt = Date.now();

  return {
    async stats() {
      const report = await pc.getStats();
      let bytes = 0;
      let frames = 0;
      report.forEach((entry) => {
        if (entry.type === 'outbound-rtp' && entry.kind === 'video') {
          bytes += entry.bytesSent ?? 0;
          frames = entry.framesSent ?? frames;
        }
      });
      const now = Date.now();
      const elapsed = Math.max(now - lastAt, 1);
      const kbps = Math.round(((bytes - lastBytes) * 8) / elapsed);
      lastBytes = bytes;
      lastAt = now;
      return { kbps: Math.max(kbps, 0), frames, state: pc.connectionState };
    },

    async stop() {
      if (sessionUrl) {
        try { await fetch(sessionUrl, { method: 'DELETE' }); } catch { /* the close below still ends it */ }
      }
      pc.getSenders().forEach((s) => s.track?.stop());
      pc.close();
    },
  };
}
