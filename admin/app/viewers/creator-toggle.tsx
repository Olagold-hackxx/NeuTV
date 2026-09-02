'use client';

import { useState, useTransition } from 'react';
import { setCreatorRole } from '@/lib/actions';

export function CreatorToggle({ userId, role }: { userId: string; role: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Admin accounts are deployment config; there is nothing to toggle.
  if (role === 'admin') return null;

  const isCreator = role === 'creator';
  return (
    <div className="stack" style={{ alignItems: 'flex-start' }}>
      <button
        type="button"
        className={`btn btn-sm ${isCreator ? '' : 'btn-primary'}`}
        disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const res = await setCreatorRole(userId, isCreator ? 'viewer' : 'creator');
          if (!res.ok) setError(res.error ?? 'That did not work.');
        })}
      >
        {pending ? 'Working' : isCreator ? 'Revoke creator' : 'Make creator'}
      </button>
      {error ? <span className="hint text-danger">{error}</span> : null}
    </div>
  );
}
