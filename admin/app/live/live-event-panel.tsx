'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { cancelLiveEvent, rotateStreamKey, startLiveEvent, stopLiveEvent } from '@/lib/actions';
import type { LiveEvent } from '@/lib/types';

export function LiveEventPanel({ event, compact = false }: { event: LiveEvent; compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // The key is a bearer credential for an encoder, so it stays hidden until
  // someone deliberately reveals it.
  const [keyVisible, setKeyVisible] = useState(false);

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
            <label>Playback</label>
            <input readOnly value={event.playbackUrl ?? event.youtubeId ?? '— not set, so it cannot go on air'} />
          </div>
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
            disabled={pending || (!event.playbackUrl && !event.youtubeId)}
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

      {!event.playbackUrl && !event.youtubeId ? (
        <p className="hint" style={{ marginTop: 10 }}>
          Add a playback source before going on air, or viewers would see nothing.
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
