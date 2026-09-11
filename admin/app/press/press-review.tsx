'use client';

import { useState, useTransition } from 'react';
import { reviewPress } from '@/lib/actions';

export function PressReview({ userId, status }: { userId: string; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (decision: 'verify' | 'reject' | 'revoke') =>
    start(async () => {
      setError(null);
      const res = await reviewPress(userId, decision);
      if (!res.ok) setError(res.error ?? 'That did not work.');
    });

  return (
    <div className="stack" style={{ alignItems: 'flex-end' }}>
      <div className="actions">
        {status === 'pending' ? (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run('verify')}>
              {pending ? 'Working' : 'Verify and issue card'}
            </button>
            <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => run('reject')}>
              Reject
            </button>
          </>
        ) : status === 'verified' ? (
          <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => run('revoke')}>
            {pending ? 'Working' : 'Revoke card'}
          </button>
        ) : (
          <button type="button" className="btn btn-sm" disabled={pending} onClick={() => run('verify')}>
            {pending ? 'Working' : 'Verify anyway'}
          </button>
        )}
      </div>
      {error ? <span className="hint text-danger">{error}</span> : null}
    </div>
  );
}
