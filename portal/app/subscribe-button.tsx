'use client';

import { useState, useTransition } from 'react';
import { subscribeCreator } from '@/lib/actions';

export function SubscribeButton({ renew = false }: { renew?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => start(async () => {
          setError(null);
          const res = await subscribeCreator();
          if (!res.ok) setError(res.error ?? 'That did not work.');
        })}
      >
        {pending ? 'Subscribing' : renew ? 'Renew for 250 KASH' : 'Subscribe — 250 KASH / month'}
      </button>
    </div>
  );
}
