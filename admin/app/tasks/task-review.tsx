'use client';

import { useState, useTransition } from 'react';
import { approveTask, rejectTask } from '@/lib/actions';

export function TaskReview({ taskId }: { taskId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'That did not work.');
    });

  return (
    <div className="stack" style={{ alignItems: 'flex-end' }}>
      <div className="actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => approveTask(taskId))}>
          {pending ? 'Working' : 'Approve and pay'}
        </button>
        <button type="button" className="btn btn-sm btn-danger" disabled={pending} onClick={() => run(() => rejectTask(taskId))}>
          Reject
        </button>
      </div>
      {error ? <span className="hint text-danger">{error}</span> : null}
    </div>
  );
}
