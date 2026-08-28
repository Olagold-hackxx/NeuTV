'use client';

import { useActionState } from 'react';
import { signIn } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(signIn, null);

  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}

      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>

      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
