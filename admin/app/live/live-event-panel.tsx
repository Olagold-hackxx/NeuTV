'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cancelLiveEvent, rotateStreamKey, startLiveEvent, stopLiveEvent, updateLiveEvent } from '@/lib/actions';
import type { LiveEvent } from '@/lib/types';

export function LiveEventPanel({ event, compact = false }: { event: LiveEvent; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The key is a bearer credential for an encoder, so it stays hidden until
  // someone deliberately reveals it.
  const [keyVisible, setKeyVisible] = useState(false);
  // How this event is fed, and where viewers watch. Editable because an event
  // scheduled without a playback source is otherwise stuck: it cannot start,
  // and it could not be repaired.
  const [source, setSource] = useState<'browser' | 'external'>(event.source);
  const [playback, setPlayback] = useState(event.playbackUrl ?? event.youtubeId ?? '');

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? 'That did not work.');
    });
  };

  const body = (
    <>
      {error ? <div className="alert alert-error">{error}</div> : null}

      {!compact ? (
        <>
          {event.ingestUrl ? (
            <div className="field">
              <label>RTMP ingest URL</label>
              <input readOnly value={event.ingestUrl} onFocus={(e) => e.currentTarget.select()} />
            </div>
          ) : (
            <div className="alert alert-warn">
              This event uses the <strong>manual</strong> ingest driver: stream wherever you
              already do, and NEU TV broadcasts the playback URL below. Configure
              <code> NEUTV_LIVE_DRIVER</code> to have an RTMP endpoint minted for you.
            </div>
          )}

          <div className="field">
            <label htmlFor={`key-${event.id}`}>Stream key</label>
            <div className="row">
              <input
                id={`key-${event.id}`}
                readOnly
                type={keyVisible ? 'text' : 'password'}
                value={event.streamKey}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className="btn btn-sm" onClick={() => setKeyVisible((v) => !v)}>
                {keyVisible ? 'Hide' : 'Reveal'}
              </button>
            </div>
            <p className="hint">Treat this like a password. Rotating it stops the old one working immediately.</p>
          </div>

          <div className="field">
            <label htmlFor={`source-${event.id}`}>How is this fed?</label>
            <select
              id={`source-${event.id}`} value={source} disabled={pending || event.isLive}
              onChange={(e) => setSource(e.target.value as 'browser' | 'external')}
            >
              <option value="browser">From this browser (the studio below)</option>
              <option value="external">From an external stream</option>
            </select>
            <p className="hint">
              {source === 'browser'
                ? 'No playback URL needed: the studio captures this tab and pushes it to viewers.'
                : 'Stream wherever you already do, then paste the public playback URL below.'}
            </p>
          </div>

          {source === 'external' ? (
            <div className="field">
              <label htmlFor={`playback-${event.id}`}>Playback source</label>
              <input
                id={`playback-${event.id}`} value={playback} disabled={pending || event.isLive}
                placeholder="https://…/live.m3u8  or  a YouTube video id"
                onChange={(e) => setPlayback(e.target.value)}
              />
              <p className="hint">
                An HLS <code>.m3u8</code> URL from your encoder or CDN, or an
                11-character YouTube Live video id. Set <code>NEUTV_LIVE_DRIVER</code>
                to <code>mux</code> or <code>cloudflare</code> and this is minted for you.
              </p>
            </div>
          ) : null}

          {!event.isLive
            && (source !== event.source || playback !== (event.playbackUrl ?? event.youtubeId ?? '')) ? (
              <button
                type="button" className="btn btn-sm" disabled={pending} style={{ marginBottom: 14 }}
                onClick={() => run(() => updateLiveEvent(event.id, {
                  source,
                  ...(source === 'external' && playback.trim() ? { playbackUrl: playback.trim() } : {}),
                }))}
              >
                {pending ? 'Saving…' : 'Save playback settings'}
              </button>
            ) : null}
        </>
      ) : (
        <div className="stat-note" style={{ marginBottom: 12 }}>
          {event.productId} · {event.playbackUrl ? 'playback set' : 'no playback source yet'}
        </div>
      )}

      <div className="actions">
        {event.isLive ? (
          <button
            type="button" className="btn btn-danger" disabled={pending}
            onClick={() => {
              if (!confirm(`End "${event.title}"? The stage returns to the programmed video.`)) return;
              run(() => stopLiveEvent(event.id));
            }}
          >
            {pending ? 'Ending…' : 'End broadcast'}
          </button>
        ) : (
          <button
            type="button" className="btn btn-primary"
            disabled={pending || (event.source !== 'browser' && !event.playbackUrl && !event.youtubeId)}
            onClick={() => run(() => startLiveEvent(event.id))}
          >
            {pending ? 'Going live…' : 'Go on air'}
          </button>
        )}

        <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run(() => rotateStreamKey(event.id))}>
          Rotate key
        </button>

        {!event.isLive ? (
          <button
            type="button" className="btn btn-sm btn-danger" disabled={pending}
            onClick={() => { if (confirm(`Cancel "${event.title}"?`)) run(() => cancelLiveEvent(event.id)); }}
          >
            Cancel
          </button>
        ) : null}
      </div>

      {event.source !== 'browser' && !event.playbackUrl && !event.youtubeId ? (
        <p className="hint" style={{ marginTop: 10 }}>
          This event has no playback source, so it cannot go on air. Paste one
          above, or switch it to a browser broadcast and use the studio.
        </p>
      ) : null}
    </>
  );

  if (compact) {
    return (
      <div className="panel" style={{ background: 'rgba(0,0,0,0.2)' }}>
        <div className="panel-body">
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{event.title}</div>
          {body}
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>{event.isLive ? 'On air' : event.title}</h2>
        <span className={`pill ${event.isLive ? 'pill-published' : 'pill-draft'}`}>
          {event.isLive ? <span className="live-dot" /> : null}{event.status}
        </span>
      </div>
      <div className="panel-body">{body}</div>
    </div>
  );
}
