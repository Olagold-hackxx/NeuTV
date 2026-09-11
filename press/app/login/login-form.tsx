'use client';

// Three ways in. A reporter new to the network registers a passport here and
// goes straight to the application. An existing email passport signs in. An
// ecosystem (SSO) account has a product and a username and no email on file,
// so it gets its own tab rather than a confusing "email does not match".

import { useActionState, useState } from 'react';
import { signIn, signInSso, signUp } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';

type Product = { id: string; name: string };
type Mode = 'register' | 'email' | 'sso';

export function LoginForm({ products }: { products: Product[] }) {
  const [mode, setMode] = useState<Mode>('register');
  const [registerState, registerAction, registerPending] = useActionState<ActionResult | null, FormData>(signUp, null);
  const [emailState, emailAction, emailPending] = useActionState<ActionResult | null, FormData>(signIn, null);
  const [ssoState, ssoAction, ssoPending] = useActionState<ActionResult | null, FormData>(signInSso, null);

  const state = mode === 'register' ? registerState : mode === 'email' ? emailState : ssoState;
  const pending = mode === 'register' ? registerPending : mode === 'email' ? emailPending : ssoPending;

  return (
    <div>
      <div className="row" style={{ marginBottom: 15, gap: 7 }}>
        {(['register', 'email', 'sso'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`btn btn-sm ${mode === m ? 'btn-primary' : ''}`}
            onClick={() => setMode(m)}
          >
            {m === 'register' ? 'Register' : m === 'email' ? 'Sign in' : 'Ecosystem account'}
          </button>
        ))}
      </div>

      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}

      {mode === 'register' ? (
        <form action={registerAction}>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" autoComplete="name" maxLength={40} placeholder="As it should read on the card" />
          </div>
          <div className="field">
            <label htmlFor="reg-email">Email</label>
            <input id="reg-email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
            {pending ? 'Registering' : 'Register and apply'}
          </button>
          <p className="hint">
            This creates a NEU Passport. The same passport signs in to the
            viewer site; press standing is added to it once you are verified.
          </p>
        </form>
      ) : mode === 'email' ? (
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
            product? Those accounts have no email here. Use the ecosystem tab.
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
            Network site. Mind the spelling: the network signs handles in
            rather than rejecting them.
          </p>
        </form>
      )}
    </div>
  );
}
