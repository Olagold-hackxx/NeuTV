'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVideo } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import type { Product, Video } from '@/lib/types';

export function NewVideoForm({ products }: { products: Product[] }) {
  const [kind, setKind] = useState<'upload' | 'external'>('upload');
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createVideo, null);
  const router = useRouter();

  const created = state?.ok ? (state.details as Video) : null;

  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}
      {created ? (
        <div className="alert alert-ok">
          Created <strong>{created.title}</strong>.{' '}
          {created.kind === 'upload'
            ? <button type="button" className="btn btn-sm" onClick={() => router.push(`/videos/${created.id}`)}>Upload the file</button>
            : 'It is ready to broadcast.'}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required minLength={2} maxLength={160} placeholder="Daily New Economy Briefing" />
      </div>

      <div className="field">
        <label htmlFor="kind">Source</label>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'upload' | 'external')}>
          <option value="upload">Upload a file</option>
          <option value="external">External URL or YouTube</option>
        </select>
        <p className="hint">
          {kind === 'upload'
            ? 'Creates a draft and gives you an upload target. The video is playable once the file lands.'
            : 'Playable immediately. Nothing is stored on our disk.'}
        </p>
      </div>

      {kind === 'external' ? (
        <>
          <div className="field">
            <label htmlFor="sourceUrl">Source URL</label>
            <input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://cdn.example.com/clip.mp4" />
          </div>
          <div className="field">
            <label htmlFor="youtubeId">or YouTube id</label>
            <input id="youtubeId" name="youtubeId" placeholder="xHU5MHuUSKI" maxLength={40} />
          </div>
        </>
      ) : null}

      <div className="field">
        <label htmlFor="productId">Ecosystem product</label>
        <select id="productId" name="productId" defaultValue="worldstreet">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="duration">Length</label>
          <input id="duration" name="duration" placeholder="04:12" maxLength={20} />
          <p className="hint">Sets how long a takeover holds the stage.</p>
        </div>
        <div className="field">
          <label htmlFor="posterUrl">Poster URL</label>
          <input id="posterUrl" name="posterUrl" type="url" placeholder="https://…" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" maxLength={2000} />
      </div>

      <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Creating…' : 'Create video'}
      </button>
    </form>
  );
}
