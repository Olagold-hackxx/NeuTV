'use client';

import { useState, useTransition } from 'react';
import { setVideoStatus } from '@/lib/actions';
import type { CreatorVideo } from '@/lib/types';

export function VideoRowActions({ video }: { video: CreatorVideo }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const playable = video.hasFile || video.playbackUrl || video.youtubeId;

  const change = (status: string) =>
    start(async () => {
      setError(null);
      const res = await setVideoStatus(video.id, status);
      if (!res.ok) setError(res.error ?? 'That did not work.');
    });

  return (
    <div className="stack" style={{ alignItems: 'flex-end' }}>
      <div className="actions">
        {video.status !== 'published' && video.status !== 'archived' ? (
          <button type="button" className="btn btn-primary btn-sm" disabled={pending || !playable}
            title={playable ? undefined : 'Upload the file first'}
            onClick={() => change('published')}>
            {pending ? 'Working' : 'Publish'}
          </button>
        ) : null}
        {video.status === 'published' ? (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => change('ready')}>
            Unpublish
          </button>
        ) : null}
        {video.status !== 'archived' ? (
          <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => change('archived')}>
            Archive
          </button>
        ) : null}
      </div>
      {error ? <span className="hint text-danger">{error}</span> : null}
    </div>
  );
}
