'use client';

import { useState, useTransition } from 'react';
import { acceptTask, deliverTask } from '@/lib/actions';
import type { CreatorVideo } from '@/lib/types';

export function AcceptButton({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="stack">
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const res = await acceptTask(taskId);
          if (!res.ok) setError(res.error ?? 'That did not work.');
        })}
      >
        {pending ? 'Accepting' : 'Accept brief'}
      </button>
      {error ? <span className="hint text-danger">{error}</span> : null}
    </div>
  );
}

export function DeliverForm({ taskId, videos }: { taskId: string; videos: CreatorVideo[] }) {
  const playable = videos.filter((v) => v.hasFile || v.playbackUrl || v.youtubeId);
  const [videoId, setVideoId] = useState(playable[0]?.id ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (playable.length === 0) {
    return <span className="hint">Upload a playable video on the Publish page, then deliver it here.</span>;
  }

  return (
    <div className="stack" style={{ gap: 7 }}>
      <div className="row">
        <select value={videoId} onChange={(e) => setVideoId(e.target.value)} style={{ maxWidth: 260 }}>
          {playable.map((v) => (
            <option key={v.id} value={v.id}>{v.title}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={pending || !videoId}
          onClick={() => start(async () => {
            setError(null);
            const res = await deliverTask(taskId, videoId);
            if (!res.ok) setError(res.error ?? 'That did not work.');
          })}
        >
          {pending ? 'Delivering' : 'Deliver'}
        </button>
      </div>
      {error ? <span className="hint text-danger">{error}</span> : null}
    </div>
  );
}
