'use client';

import { useActionState } from 'react';
import { createLiveSession, type ActionResult } from '@/lib/actions';

export function LiveForm({ products }: { products: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createLiveSession, null);

  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}
      {state?.ok ? <div className="alert alert-ok">Session created. The studio below broadcasts it.</div> : null}
      <div className="field">
        <label htmlFor="live-title">Session title</label>
        <input id="live-title" name="title" required minLength={2} maxLength={160} placeholder="Friday desk session" />
      </div>
      <div className="field">
        <label htmlFor="live-product">Ecosystem product</label>
        <select id="live-product" name="productId" defaultValue="neutv">
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? 'Creating' : 'Create live session'}
      </button>
      <p className="hint">
        Goes live on your spotlight channel only. The network broadcast is
        never interrupted by a creator session.
      </p>
    </form>
  );
}
