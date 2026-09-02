'use client';

// One submit: create the video on your channel and stream the file to it.
// Same shape as the back office's form, against the creator routes.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createVideo, setVideoStatus } from '@/lib/actions';
import { uploadVideo } from '@/lib/upload';
import { FileDrop } from './file-drop';

type Phase =
  | { step: 'idle' }
  | { step: 'creating' }
  | { step: 'uploading'; videoId: string; progress: number }
  | { step: 'done'; published: boolean }
  | { step: 'error'; message: string };

export function NewVideoForm({ products }: { products: { id: string; name: string }[] }) {
  const [kind, setKind] = useState<'upload' | 'external'>('upload');
  const [publishNow, setPublishNow] = useState(true);
  const [phase, setPhase] = useState<Phase>({ step: 'idle' });
  const router = useRouter();

  const busy = phase.step === 'creating' || phase.step === 'uploading';

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const data = new FormData(formEl);
    const file = data.get('file');
    data.delete('file');

    setPhase({ step: 'creating' });
    const result = await createVideo(null, data);
    if (!result.ok || !result.videoId) {
      setPhase({ step: 'error', message: result.error ?? 'That did not work.' });
      return;
    }
    const videoId = result.videoId;

    try {
      if (kind === 'upload' && file instanceof File && file.size > 0) {
        setPhase({ step: 'uploading', videoId, progress: 0 });
        await uploadVideo(videoId, file, (p) => setPhase({ step: 'uploading', videoId, progress: p }));
      }
      let published = false;
      if (publishNow) {
        const pub = await setVideoStatus(videoId, 'published');
        published = pub.ok;
        if (!pub.ok) {
          setPhase({ step: 'error', message: pub.error ?? 'Uploaded, but publishing failed.' });
          router.refresh();
          return;
        }
      }
      setPhase({ step: 'done', published });
      formEl.reset();
      setKind('upload');
      router.refresh();
    } catch (err) {
      setPhase({ step: 'error', message: err instanceof Error ? err.message : 'The upload failed.' });
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit}>
      {phase.step === 'error' ? <div className="alert alert-error">{phase.message}</div> : null}
      {phase.step === 'done' ? (
        <div className="alert alert-ok">
          {phase.published ? 'Published. Your spotlight card is live.' : 'Saved to your channel.'}
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" name="title" required minLength={2} maxLength={160} disabled={busy} />
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
          <FileDrop name="file" disabled={busy} prompt="Drop your video here" />
          {phase.step === 'uploading' ? (
            <div style={{ marginTop: 8 }}>
              <div className="bar"><span style={{ width: `${Math.round(phase.progress * 100)}%` }} /></div>
              <p className="hint num">{Math.round(phase.progress * 100)}% uploaded. Leave this tab open.</p>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="field">
            <label htmlFor="sourceUrl">Source URL</label>
            <input id="sourceUrl" name="sourceUrl" type="url" disabled={busy} />
          </div>
          <div className="field">
            <label htmlFor="youtubeId">YouTube id</label>
            <input id="youtubeId" name="youtubeId" maxLength={40} disabled={busy} />
          </div>
        </>
      )}

      <div className="field">
        <label htmlFor="productId">Ecosystem product</label>
        <select id="productId" name="productId" defaultValue="neutv" disabled={busy}>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label htmlFor="duration">Length</label>
        <input id="duration" name="duration" placeholder="04:12" maxLength={20} disabled={busy} />
      </div>

      <div className="field">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" maxLength={2000} disabled={busy} />
      </div>

      <label className="row" style={{ marginBottom: 15, cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={publishNow}
          onChange={(e) => setPublishNow(e.target.checked)}
          disabled={busy}
          style={{ width: 'auto' }}
        />
        <span className="hint" style={{ marginTop: 0 }}>Publish to the spotlight as soon as it lands</span>
      </label>

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {phase.step === 'creating' ? 'Creating' : phase.step === 'uploading' ? 'Uploading' : 'Add to my channel'}
      </button>
    </form>
  );
}
