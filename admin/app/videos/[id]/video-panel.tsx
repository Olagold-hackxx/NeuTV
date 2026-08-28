'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { archiveVideo, setProgramme, updateVideo } from '@/lib/actions';
import type { Product, Video, VideoStatus } from '@/lib/types';

const ACCEPT = 'video/mp4,video/webm,video/quicktime,video/x-matroska';

export function VideoPanel({ video, products, isOnAir }: { video: Video; products: Product[]; isOnAir: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    setError(null); setNotice(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) { setNotice(ok); router.refresh(); } else { setError(res.error ?? 'That did not work.'); }
    });
  };

  // XHR rather than fetch: it is still the only way to get upload progress
  // events in a browser, and a multi-gigabyte upload with no progress bar is
  // indistinguishable from a hung one.
  const upload = (file: File) => {
    setError(null); setNotice(null); setProgress(0);
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/upload/${video.id}`);
    xhr.setRequestHeader('content-type', file.type || 'video/mp4');
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(e.loaded / e.total); };
    xhr.onload = () => {
      setProgress(null);
      if (xhr.status >= 200 && xhr.status < 300) {
        setNotice('File uploaded. The video is ready to broadcast.');
        router.refresh();
      } else {
        let message = `Upload failed (${xhr.status}).`;
        try { message = JSON.parse(xhr.responseText)?.error?.message ?? message; } catch { /* non-JSON body */ }
        setError(message);
      }
    };
    xhr.onerror = () => { setProgress(null); setError('Upload failed: the connection dropped.'); };
    xhr.send(file);
  };

  const playable = video.hasFile || Boolean(video.playbackUrl);

  return (
    <div className="panel">
      <div className="panel-head"><h2>Manage</h2></div>
      <div className="panel-body">
        {error ? <div className="alert alert-error">{error}</div> : null}
        {notice ? <div className="alert alert-ok">{notice}</div> : null}

        {video.kind === 'upload' && !video.hasFile ? (
          <div className="alert alert-warn">
            This video has no file yet. It cannot be published or put on air until
            one is uploaded.
          </div>
        ) : null}

        {video.kind === 'upload' ? (
          <div className="field">
            <label htmlFor="file">{video.hasFile ? 'Replace the file' : 'Upload the file'}</label>
            <input
              id="file" type="file" accept={ACCEPT} disabled={progress !== null}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
            <p className="hint">MP4, WebM, MOV or MKV. Streams straight through to storage, so large files are fine.</p>
            {progress !== null ? (
              <div style={{ marginTop: 10 }}>
                <div className="bar"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                <p className="hint">{Math.round(progress * 100)}% uploaded — leave this tab open.</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="field">
          <label htmlFor="status">Status</label>
          <select
            id="status" defaultValue={video.status} disabled={pending}
            onChange={(e) => run(() => updateVideo(video.id, { status: e.target.value as VideoStatus }), 'Status updated.')}
          >
            <option value="draft">draft</option>
            <option value="ready">ready</option>
            <option value="published" disabled={!playable}>published</option>
            <option value="archived" disabled={isOnAir}>archived</option>
          </select>
          {isOnAir ? <p className="hint">This is the main broadcast, so it cannot be archived. Set another programme first.</p> : null}
        </div>

        <div className="field">
          <label htmlFor="product">Ecosystem product</label>
          <select
            id="product" defaultValue={video.productId} disabled={pending}
            onChange={(e) => run(() => updateVideo(video.id, { productId: e.target.value }), 'Product updated.')}
          >
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="actions" style={{ marginTop: 18 }}>
          <button
            type="button" className="btn btn-primary" disabled={pending || isOnAir || !playable}
            onClick={() => run(() => setProgramme(video.id, 'set from the video page'), 'This is now the main broadcast.')}
          >
            {isOnAir ? 'Already on air' : 'Make this the main broadcast'}
          </button>
          <button
            type="button" className="btn btn-danger" disabled={pending || isOnAir || video.status === 'archived'}
            onClick={() => {
              if (!confirm(`Archive "${video.title}"? The file is kept; the video stops being reachable.`)) return;
              run(() => archiveVideo(video.id), 'Archived.');
            }}
          >
            Archive
          </button>
        </div>

        {!playable ? (
          <p className="hint" style={{ marginTop: 12 }}>
            A video with no file and no source URL cannot be published or broadcast.
          </p>
        ) : null}
      </div>
    </div>
  );
}
