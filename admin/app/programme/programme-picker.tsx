'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setProgramme } from '@/lib/actions';
import { duration } from '@/lib/format';
import type { Video } from '@/lib/types';

export function ProgrammePicker({ videos, currentId }: { videos: Video[]; currentId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState(currentId ?? videos[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (videos.length === 0) {
    return (
      <div className="empty">
        Nothing is eligible yet. A video needs an uploaded file or a source URL,
        and must not be archived.
      </div>
    );
  }

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await setProgramme(selected, note.trim());
      if (res.ok) { setNote(''); router.refresh(); } else { setError(res.error ?? 'That did not work.'); }
    });
  };

  return (
    <>
      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="field">
        <label htmlFor="video">Video</label>
        <select id="video" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={pending}>
          {videos.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title} ({v.productId}, {duration(v.durationSeconds)})
              {v.id === currentId ? ' (on air)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="note">Note</label>
        <input
          id="note" value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="evening block" maxLength={200} disabled={pending}
        />
        <p className="hint">Recorded in the history so a schedule change can be explained later.</p>
      </div>

      <button
        type="button" className="btn btn-primary btn-block"
        disabled={pending || selected === currentId}
        onClick={submit}
      >
        {pending ? 'Switching…' : selected === currentId ? 'Already on air' : 'Put on air'}
      </button>

      <p className="hint" style={{ marginTop: 12 }}>
        Takes effect immediately for every viewer, and publishes the video if it
        was not published already.
      </p>
    </>
  );
}
