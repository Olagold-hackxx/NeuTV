'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVideo } from '@/lib/actions';
import type { Product, Video } from '@/lib/types';
import { FileDrop } from './file-drop';

type Phase =
  | { step: 'idle' }
  | { step: 'creating' }
  | { step: 'uploading'; video: Video; progress: number }
  | { step: 'done'; video: Video }
  | { step: 'created-no-file'; video: Video } // record exists, upload failed or skipped
  | { step: 'error'; message: string };

// One submit does the whole thing: create the record, then stream the chosen
// file straight to it. The old flow made the operator create first and find
// the upload field on the detail page — two trips for one intention.
export function NewVideoForm({ products }: { products: Product[] }) {
  const [kind, setKind] = useState<'upload' | 'external'>('upload');
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  const busy = phase.step === 'creating' || phase.step === 'uploading';

  function upload(video: Video, file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      // XHR rather than fetch: it is still the only way to get upload
      // progress events.
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `/api/upload/${video.id}`);
      xhr.setRequestHeader('content-type', file.type || 'video/mp4');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPhase({ step: 'uploading', video, progress: e.loaded / e.total });
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve();
        let message = `Upload failed (${xhr.status}).`;
        try {
          message = JSON.parse(xhr.responseText)?.error?.message ?? message;
        } catch {
          /* non-JSON error body */
        }
        reject(new Error(message));
      };
      xhr.onerror = () => reject(new Error('Upload failed: the connection dropped.'));
      xhr.send(file);
    });
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const data = new FormData(formEl);
    const file = data.get('file');
    data.delete('file'); // the action only wants the metadata

    setPhase({ step: 'creating' });
    const result = await createVideo(null, data);
    if (!result.ok) {
      setPhase({ step: 'error', message: result.error ?? 'That did not work.' });
      return;
    }
    const video = result.details as Video;

    if (kind === 'upload' && file instanceof File && file.size > 0) {
      setPhase({ step: 'uploading', video, progress: 0 });
      try {
        await upload(video, file);
        setPhase({ step: 'done', video });
      } catch (err) {
        setPhase({ step: 'created-no-file', video });
        // The record exists; the alert below says how to finish the job.
        console.error(err);
        router.refresh();
        return;
      }
    } else {
      setPhase(kind === 'upload' ? { step: 'created-no-file', video } : { step: 'done', video });
    }
    formEl.reset();
    setKind('upload');
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={submit}>
      {phase.step === 'error' ? <div className="alert alert-error">{phase.message}</div> : null}
      {phase.step === 'done' ? (
        <div className="alert alert-ok">
          <strong>{phase.video.title}</strong> is ready to broadcast.{' '}
          <button type="button" className="btn btn-sm" onClick={() => router.push(`/videos/${phase.video.id}`)}>
            Open it
          </button>
        </div>
      ) : null}
      {phase.step === 'created-no-file' ? (
        <div className="alert alert-warn">
          <strong>{phase.video.title}</strong> was created but has no file yet.{' '}
          <button type="button" className="btn btn-sm" onClick={() => router.push(`/videos/${phase.video.id}`)}>
            Upload it there
          </button>
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required minLength={2} maxLength={160} placeholder="Daily New Economy Briefing" disabled={busy} />
      </div>

      <div className="field">
        <label htmlFor="kind">Source</label>
        <select id="kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'upload' | 'external')} disabled={busy}>
          <option value="upload">Upload a file</option>
          <option value="external">External URL or YouTube</option>
        </select>
      </div>

      {kind === 'upload' ? (
        <div className="field">
          <label htmlFor="file">Video file</label>
          <FileDrop name="file" disabled={busy} prompt="Drop the video here" />
          <p className="hint">
            Creating and uploading happen in one step; leave this empty to
            create the record now and add the file later.
          </p>
          {phase.step === 'uploading' ? (
            <div style={{ marginTop: 8 }}>
              <div className="bar">
                <span style={{ width: `${Math.round(phase.progress * 100)}%` }} />
              </div>
              <p className="hint num">{Math.round(phase.progress * 100)}% uploaded. Leave this tab open.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="sourceUrl">Source URL</label>
            <input id="sourceUrl" name="sourceUrl" type="url" placeholder="https://cdn.example.com/clip.mp4" disabled={busy} />
          </div>
          <div className="field">
            <label htmlFor="youtubeId">YouTube id</label>
            <input id="youtubeId" name="youtubeId" placeholder="xHU5MHuUSKI" maxLength={40} disabled={busy} />
            <p className="hint">Playable immediately. Nothing is stored on this server.</p>
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="productId">Ecosystem product</label>
        <select id="productId" name="productId" defaultValue="worldstreet" disabled={busy}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="duration">Length</label>
          <input id="duration" name="duration" placeholder="04:12" maxLength={20} disabled={busy} />
          <p className="hint">Sets how long a takeover holds the stage.</p>
        </div>
        <div className="field">
          <label htmlFor="posterUrl">Poster URL</label>
          <input id="posterUrl" name="posterUrl" type="url" placeholder="https://…" disabled={busy} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" maxLength={2000} disabled={busy} />
      </div>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {phase.step === 'creating'
          ? 'Creating'
          : phase.step === 'uploading'
            ? 'Uploading'
            : kind === 'upload'
              ? 'Create and upload'
              : 'Create video'}
      </button>
    </form>
  );
}
