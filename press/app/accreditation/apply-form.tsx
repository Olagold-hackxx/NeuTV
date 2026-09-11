'use client';

import { useActionState } from 'react';
import { applyPress, type ActionResult } from '@/lib/actions';

type Defaults = { outlet: string; title: string; beat: string; website: string; note: string };

export function ApplyForm({ defaults }: { defaults?: Defaults }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(applyPress, null);

  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}
      {state?.ok ? <div className="alert alert-ok">Filed. The desk reviews applications as they come in.</div> : null}

      <div className="field">
        <label htmlFor="outlet">Outlet</label>
        <input id="outlet" name="outlet" required minLength={2} maxLength={120} defaultValue={defaults?.outlet} placeholder="The publication, station or agency" />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="title">Your title</label>
          <input id="title" name="title" required minLength={2} maxLength={80} defaultValue={defaults?.title} placeholder="Correspondent" />
        </div>
        <div className="field">
          <label htmlFor="beat">Beat</label>
          <input id="beat" name="beat" maxLength={120} defaultValue={defaults?.beat} placeholder="Fintech, markets, culture" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="url" maxLength={300} defaultValue={defaults?.website} placeholder="https://" />
      </div>
      <div className="field">
        <label htmlFor="note">Note to the desk</label>
        <textarea id="note" name="note" maxLength={1000} defaultValue={defaults?.note} placeholder="How to verify you: an editor's contact, a byline, a staff page." />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? 'Filing' : 'Apply for accreditation'}
      </button>
      <p className="hint">
        Verification is done by the network. A verified card grants the press
        standing on this passport and is good for a year.
      </p>
    </form>
  );
}
