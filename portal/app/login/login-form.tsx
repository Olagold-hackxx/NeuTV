'use client';

// Two ways in, because there are two kinds of passport. An email signup has
// an email; an ecosystem (SSO) account has a product and a username and NO
// email on file - feeding its handle to the email form can only ever produce
// "email and password do not match", which is exactly the confusion this
// toggle removes.

import { useActionState, useState } from 'react';
import { signIn, signInSso } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';

type Product = { id: string; name: string };

export function LoginForm({ products }: { products: Product[] }) {
  const [mode, setMode] = useState<'email' | 'sso'>('email');
  const [emailState, emailAction, emailPending] = useActionState<ActionResult | null, FormData>(signIn, null);
  const [ssoState, ssoAction, ssoPending] = useActionState<ActionResult | null, FormData>(signInSso, null);

  const state = mode === 'email' ? emailState : ssoState;
  const pending = mode === 'email' ? emailPending : ssoPending;

  return (
    <div>
      <div className="row" style={{ marginBottom: 15, gap: 7 }}>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'email' ? 'btn-primary' : ''}`}
          onClick={() => setMode('email')}
        >
          Email
        </button>
        <button
          type="button"
          className={`btn btn-sm ${mode === 'sso' ? 'btn-primary' : ''}`}
          onClick={() => setMode('sso')}
        >
          Ecosystem account
        </button>
      </div>

      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}

      {mode === 'email' ? (
        <form action={emailAction}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Signing in' : 'Sign in'}
          </button>
          <p className="hint">
            Signed up through WorldStreet, KashPlus or another ecosystem
            product? Those accounts have no email here — use the
            ecosystem tab instead.
          </p>
        </form>
      ) : (
        <form action={ssoAction}>
          <div className="field">
            <label htmlFor="sso-product">Ecosystem product</label>
            <select id="sso-product" name="productId" defaultValue={products[0]?.id}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="sso-username">Username</label>
            <input id="sso-username" name="username" autoComplete="username" required minLength={2} placeholder="the handle you signed up with" />
          </div>
          <div className="field">
            <label htmlFor="sso-password">Password</label>
            <input id="sso-password" name="password" type="password" autoComplete="current-password" required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Signing in' : 'Sign in with ecosystem account'}
          </button>
          <p className="hint">
            The same product, username and password you use on the main NEU
            Network site. Mind the spelling — the network signs handles in
            rather than rejecting them.
          </p>
        </form>
      )}
    </div>
  );
}
