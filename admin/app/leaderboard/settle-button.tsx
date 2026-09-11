'use client';

import { useState, useTransition } from 'react';
import { settleQuarter } from '@/lib/actions';

export function SettleButton({ quarter, prize, winner }: { quarter: string; prize: number; winner: string | null }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="stack" style={{ alignItems: 'flex-end' }}>
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const res = await settleQuarter(quarter);
          if (!res.ok) setError(res.error ?? 'That did not work.');
        })}
      >
        {pending
          ? 'Settling'
          : winner
            ? `Settle and pay ${winner} ${prize.toLocaleString()} KASH`
            : `Close ${quarter} with no winner`}
      </button>
      {error ? <span className="hint text-danger">{error}</span> : null}
    </div>
  );
}
