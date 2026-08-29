'use client';

import { useActionState, useState } from 'react';
import { scheduleLiveEvent } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import type { LiveEvent, Product } from '@/lib/types';

export function ScheduleForm({ products }: { products: Product[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(scheduleLiveEvent, null);
  const [source, setSource] = useState<'browser' | 'external'>('browser');
  const created = state?.ok ? (state.details as LiveEvent) : null;

  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}
      {created ? <div className="alert alert-ok">Scheduled <strong>{created.title}</strong>. Its ingest details are on the left.</div> : null}

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required minLength={2} maxLength={160} placeholder="Market Open Special" />
      </div>

      <div className="field">
        <label htmlFor="source">How are you broadcasting?</label>
        <select id="source" name="source" value={source} onChange={(e) => setSource(e.target.value as 'browser' | 'external')}>
          <option value="browser">From this browser (camera or screen)</option>
          <option value="external">From an external stream (OBS, YouTube Live)</option>
        </select>
        <p className="hint">
          {source === 'browser'
            ? 'The studio below captures this tab and pushes it to viewers. Nothing to install.'
            : 'Stream wherever you already do, then paste the public playback URL below.'}
        </p>
      </div>

      <div className="field" style={{ display: source === 'external' ? 'block' : 'none' }}>
        <label htmlFor="playbackUrl">Playback source</label>
        <input id="playbackUrl" name="playbackUrl" placeholder="https://…/live.m3u8  or  a YouTube id" maxLength={600} />
        <p className="hint">
          An HLS <code>.m3u8</code> URL, or a YouTube Live video id. With a hosted
          ingest driver configured this is filled in for you.
        </p>
      </div>

      <div className="field">
        <label htmlFor="productId">Ecosystem product</label>
        <select id="productId" name="productId" defaultValue="worldstreet">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="posterUrl">Poster URL</label>
        <input id="posterUrl" name="posterUrl" type="url" placeholder="https://…" maxLength={600} />
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" maxLength={2000} />
      </div>

      <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Scheduling…' : 'Schedule event'}
      </button>
    </form>
  );
}
