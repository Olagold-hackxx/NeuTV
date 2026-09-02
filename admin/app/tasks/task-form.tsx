'use client';

import { useActionState } from 'react';
import { createTask } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';
import type { Product } from '@/lib/types';

export function TaskForm({ products }: { products: Product[] }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createTask, null);

  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}
      {state?.ok ? <div className="alert alert-ok">Brief posted. Creators see it immediately.</div> : null}

      <div className="field">
        <label htmlFor="task-title">Title</label>
        <input id="task-title" name="title" required minLength={2} maxLength={160} placeholder="Cover the WorldStreet keynote" />
      </div>
      <div className="field">
        <label htmlFor="task-brief">Brief</label>
        <textarea id="task-brief" name="brief" maxLength={4000} placeholder="What the delivery should cover, length, tone." />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="task-bounty">Bounty (KASH)</label>
          <input id="task-bounty" name="bounty" type="number" min={1} max={1000000} required defaultValue={200} />
          <p className="hint">Paid to the creator when the delivery is approved.</p>
        </div>
        <div className="field">
          <label htmlFor="task-product">Ecosystem product</label>
          <select id="task-product" name="productId" defaultValue="neutv">
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? 'Posting' : 'Post brief'}
      </button>
    </form>
  );
}
