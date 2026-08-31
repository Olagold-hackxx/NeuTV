'use client';

import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import type { Product, SessionUser } from '@/lib/types';
import { NeuTVClient, sync } from '@/lib/client';

type SignInFormsProps = {
  products: Product[];
  client: NeuTVClient;
  onSignedIn: (user: SessionUser) => void;
};

// The shared sign-in flow: five ecosystem SSO entries plus email. Used by the
// landing screen and the in-app gate, so the consent copy — which never
// claims a verification that has not happened — lives in exactly one place.
export function SignInForms({ products, client, onSignedIn }: SignInFormsProps) {
  const [sso, setSso] = useState<Product | null>(null);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const finish = (res: { user: SessionUser } | null, fallbackError: string) => {
    setPending(false);
    if (!res) {
      setError((prev) => prev ?? fallbackError);
      return;
    }
    onSignedIn(res.user);
  };

  const submitSso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sso) return;
    if (!handle.trim() || !password) {
      setError('Enter your ecosystem handle and password.');
      return;
    }
    setError(null);
    setPending(true);
    void sync(
      () => client.sso(sso.id, handle.trim(), password),
      (err) => setError(err.status === 401 ? 'That handle and password do not match.' : err.message),
    ).then((res) => finish(res, 'Could not reach the network. Try again.'));
  };

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setPending(true);
    const displayName = name.trim() || email.split('@')[0];
    void sync(
      () =>
        mode === 'signup'
          ? client.signup({ name: displayName, email: email.trim(), password, platform: 'neutv' })
          : client.signin(email.trim(), password),
      (err) => setError(err.status === 401 ? 'That email and password do not match.' : err.message),
    ).then((res) => finish(res, 'Could not reach the network. Try again.'));
  };

  if (sso) {
    return (
      <form onSubmit={submitSso}>
        <button
          type="button"
          onClick={() => {
            setSso(null);
            setError(null);
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-dim hover:text-ink"
        >
          <ArrowLeft size={14} /> All sign-in options
        </button>

        <h2 className="mt-3 text-[15px] font-bold">Sign in with {sso.name}</h2>
        <p className="mt-1 text-xs text-dim">Use the credentials you already have on {sso.name}.</p>

        <label className="mt-4 block text-xs font-semibold text-dim" htmlFor="sso-handle">
          {sso.name} handle
        </label>
        <input
          id="sso-handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          autoComplete="username"
          className="mt-1.5 w-full rounded-control border border-line bg-base px-3 py-2.5 text-[13px] focus:border-line-strong focus:outline-none"
        />
        <label className="mt-3 block text-xs font-semibold text-dim" htmlFor="sso-password">
          Password
        </label>
        <input
          id="sso-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-control border border-line bg-base px-3 py-2.5 text-[13px] focus:border-line-strong focus:outline-none"
        />

        <ul className="mt-4 space-y-1.5 rounded-control border border-line bg-base p-3 text-xs text-dim">
          {[
            `Links your ${sso.name} membership to NEU TV`,
            'Lets you comment, chat and send gifts on broadcasts',
            'Your wallet starts at 0 KashCoin; there is no sign-up bonus',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <Check size={13} className="mt-0.5 shrink-0 text-cyan" />
              {line}
            </li>
          ))}
        </ul>

        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-control bg-cyan px-3 py-2.5 text-xs font-bold text-deep transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? 'Signing in' : `Sign in with ${sso.name}`}
        </button>
      </form>
    );
  }

  return (
    <div>
      <h2 className="text-[15px] font-bold">{mode === 'signup' ? 'Create your NEU Passport' : 'Welcome back'}</h2>
      <p className="mt-1 text-xs text-dim">One account across the five New Economy products.</p>

      <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="Sign in with an ecosystem account">
        {products
          .filter((p) => p.id !== 'neutv')
          .map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSso(p);
                setError(null);
              }}
              className="flex items-center gap-2 rounded-control border border-line bg-base px-3 py-2.5 text-left text-xs font-bold transition hover:border-line-strong hover:bg-obsidian"
            >
              {p.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.logo} alt="" className="h-5 w-5 rounded-chip object-cover opacity-80" />
              ) : (
                <span className="grid h-5 w-5 place-items-center rounded-chip bg-obsidian text-[9px] font-extrabold text-dim">
                  {p.name.slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="truncate">{p.name}</span>
            </button>
          ))}
      </div>

      <div className="my-4 flex items-center gap-3 text-[11px] font-semibold text-faint">
        <span className="h-px flex-1 bg-line" aria-hidden />
        or with email
        <span className="h-px flex-1 bg-line" aria-hidden />
      </div>

      <form onSubmit={submitEmail}>
        {mode === 'signup' ? (
          <>
            <label className="block text-xs font-semibold text-dim" htmlFor="gate-name">
              Name
            </label>
            <input
              id="gate-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="mt-1.5 mb-3 w-full rounded-control border border-line bg-base px-3 py-2.5 text-[13px] focus:border-line-strong focus:outline-none"
            />
          </>
        ) : null}
        <label className="block text-xs font-semibold text-dim" htmlFor="gate-email">
          Email
        </label>
        <input
          id="gate-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="mt-1.5 w-full rounded-control border border-line bg-base px-3 py-2.5 text-[13px] focus:border-line-strong focus:outline-none"
        />
        <label className="mt-3 block text-xs font-semibold text-dim" htmlFor="gate-password">
          Password
        </label>
        <input
          id="gate-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          className="mt-1.5 w-full rounded-control border border-line bg-base px-3 py-2.5 text-[13px] focus:border-line-strong focus:outline-none"
        />

        {error ? <p className="mt-3 text-xs text-danger">{error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-4 w-full rounded-control bg-cyan px-3 py-2.5 text-xs font-bold text-deep transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? 'One moment' : mode === 'signup' ? 'Create passport' : 'Sign in'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === 'signup' ? 'signin' : 'signup'));
          setError(null);
        }}
        className="mt-3 w-full text-center text-xs font-semibold text-dim hover:text-ink"
      >
        {mode === 'signup' ? 'Already have an account? Sign in' : 'New here? Create a passport'}
      </button>
    </div>
  );
}
