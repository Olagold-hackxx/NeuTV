'use client';

// The file upload, on its own so the edit form and anything else that needs it
// share one implementation.
//
// It deliberately does not go through a server action: the bytes stream to
// /api/upload/[videoId], which pipes them to the API without buffering. A
// server action would have to materialise the whole file first, which is not a
// thing to do with a two-hour broadcast recording.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Video } from '@/lib/types';

const ACCEPT = 'video/mp4,video/webm,video/quicktime,video/x-matroska';

export function UploadField({ video }: { video: Video }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

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

  return (
    <>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {notice ? <div className="alert alert-ok">{notice}</div> : null}

      {!video.hasFile ? (
        <div className="alert alert-warn">
          This video has no file yet. It cannot be published or put on air until
          one is uploaded.
        </div>
      ) : null}

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
    </>
  );
}
