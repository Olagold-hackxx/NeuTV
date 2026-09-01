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
import { FileDrop } from '../file-drop';
import { uploadVideo } from '@/lib/upload';

export function UploadField({ video }: { video: Video }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  // XHR rather than fetch: it is still the only way to get upload progress
  // events in a browser, and a multi-gigabyte upload with no progress bar is
  // indistinguishable from a hung one.
  const upload = async (file: File) => {
    setError(null); setNotice(null); setProgress(0);
    try {
      await uploadVideo(video.id, file, setProgress);
      setProgress(null);
      setNotice('File uploaded. The video is ready to broadcast.');
      router.refresh();
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : 'The upload failed.');
    }
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
        <FileDrop
          disabled={progress !== null}
          prompt={video.hasFile ? 'Drop the replacement here' : 'Drop the video here'}
          onFile={(f) => { if (f) upload(f); }}
        />
        <p className="hint">The upload starts as soon as a file lands. It streams straight through to storage, so large files are fine.</p>
        {progress !== null ? (
          <div style={{ marginTop: 10 }}>
            <div className="bar"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <p className="hint num">{Math.round(progress * 100)}% uploaded. Leave this tab open.</p>
          </div>
        ) : null}
      </div>
    </>
  );
}
