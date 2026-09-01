'use client';

// The front door: the full-screen NEU TV auth gate, with the live broadcast
// playing behind the hero copy. Signed-out visitors land here; "Explore as
// Guest" drops them straight onto the stage in read-only mode.

import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Car,
  CheckCircle2,
  CreditCard,
  Eye,
  MessageSquare,
  Radio,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Tv,
  Users,
  Zap,
} from 'lucide-react';
import type { Product, SessionUser, StageCard } from '@/lib/types';
import { NeuTVClient, sync } from '@/lib/client';

const POP_EMOJIS = ['🔥', '🚀', '💎', '🎉', '⚡', '👏', '💖', '⭐'];

type PopEmoji = { id: number; emoji: string; leftPos: number; size: number };

type GateProps = {
  products: Product[];
  client: NeuTVClient;
  card: StageCard;
  viewers: number | null;
  onGuest: () => void;
  onSignedIn: (user: SessionUser, platformName: string) => void;
};

function ssoIcon(productId: string) {
  const cls = 'w-6 h-6';
  switch (productId) {
    case 'worldstreet':
      return <TrendingUp className={cls} />;
    case 'market':
      return <ShoppingBag className={cls} />;
    case 'linkpay':
      return <CreditCard className={cls} />;
    case 'ark':
      return <ShieldCheck className={cls} />;
    default:
      return <Car className={cls} />;
  }
}

function ssoHandleField(product: Product): { label: string; placeholder: string } {
  switch (product.id) {
    case 'worldstreet':
      return { label: 'WorldStreet Trader Handle*', placeholder: '@wallstreet_pro' };
    case 'market':
      return { label: 'mARKet Username / Merchant Handle*', placeholder: '@merchant_sam' };
    case 'linkpay':
      return { label: `${product.name} Cashtag / Email*`, placeholder: '$alexkash' };
    case 'ark':
      return { label: 'ARK Vault ID / Username*', placeholder: '@ark_yield' };
    default:
      return { label: `${product.name} Member ID*`, placeholder: '@tsion_driver' };
  }
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-2xl border border-white/15 focus:border-white/40 bg-white/5 focus:bg-white/10 text-xs text-white placeholder-white/40 outline-none transition';

export function Gate({ products, client, card, viewers, onGuest, onSignedIn }: GateProps) {
  const [selectedSSO, setSelectedSSO] = useState<Product | null>(null);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  const [pops, setPops] = useState<PopEmoji[]>([]);
  const spawnPop = (leftPos?: number) => {
    const id = Date.now() + Math.random();
    setPops((prev) => [
      ...prev.slice(-19),
      {
        id,
        emoji: POP_EMOJIS[Math.floor(Math.random() * POP_EMOJIS.length)],
        leftPos: leftPos ?? Math.random() * 90 + 5,
        size: 1 + Math.random() * 1.2,
      },
    ]);
    setTimeout(() => setPops((prev) => prev.filter((p) => p.id !== id)), 3200);
  };

  // Ambient reactions drift up while the gate is open.
  useEffect(() => {
    const timer = setInterval(() => spawnPop(), 500);
    return () => clearInterval(timer);
  }, []);

  const finish = (res: { user: SessionUser } | null, platformName: string) => {
    setPending(false);
    if (!res) {
      setError((prev) => prev ?? 'Could not reach the network. Try again.');
      return;
    }
    onSignedIn(res.user, platformName);
  };

  const submitSso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSSO) return;
    if (!handle.trim() || !password) {
      setError('Enter your ecosystem handle and password.');
      return;
    }
    setError(null);
    setPending(true);
    void sync(
      () => client.sso(selectedSSO.id, handle.trim(), password),
      (err) => setError(err.status === 401 ? 'That handle and password do not match.' : err.message),
    ).then((res) => finish(res, selectedSSO.name));
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
        authMode === 'signup'
          ? client.signup({ name: displayName, email: email.trim(), password, platform: 'neutv' })
          : client.signin(email.trim(), password),
      (err) => setError(err.status === 401 ? 'That email and password do not match.' : err.message),
    ).then((res) => finish(res, 'NEU TV'));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-2xl flex items-center justify-center p-3 md:p-8 overflow-y-auto no-scrollbar animate-fadeIn select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to NEU TV"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const x = (e.clientX / window.innerWidth) * 100;
          spawnPop(x - 2);
          spawnPop(x + 2);
        }
      }}
    >
      {pops.map((item) => (
        <span
          key={item.id}
          aria-hidden
          className="auth-popping-emoji"
          style={{ left: `${item.leftPos}%`, fontSize: `${item.size}rem` }}
        >
          {item.emoji}
        </span>
      ))}

      <div className="relative z-10 w-full max-w-6xl min-h-[640px] md:min-h-[720px] bg-neutral-950/95 backdrop-blur-3xl rounded-3xl overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,0.95)] border border-white/20 flex flex-col md:flex-row text-white my-auto animate-scaleUp">
        {/* Hero pane: the broadcast itself is the pitch. */}
        <div className="md:w-1/2 relative bg-black min-h-[360px] md:min-h-[720px] flex flex-col justify-between p-6 md:p-12 text-white overflow-hidden group">
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {card.youtubeId ? (
              <iframe
                title="Live NEU TV Broadcast"
                allow="autoplay; encrypted-media; fullscreen"
                className="w-full h-full object-cover scale-[1.38] opacity-80 group-hover:scale-150 transition duration-1000"
                src={`https://www.youtube-nocookie.com/embed/${card.youtubeId}?autoplay=1&mute=1&playsinline=1&controls=0&loop=1&playlist=${card.youtubeId}&modestbranding=1&rel=0`}
              />
            ) : card.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.posterUrl} alt="" className="w-full h-full object-cover opacity-80" />
            ) : null}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/35 pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent pointer-events-none" />

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/20 shadow-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-live shadow-lg" aria-hidden />
              <span className="font-black text-xs tracking-wider text-white">NEU TV</span>
              <span className="text-white/40 text-xs">|</span>
              <span className="text-[11px] text-white/90 font-extrabold uppercase tracking-wider num">
                {(viewers ?? card.viewers ?? 0).toLocaleString()} ON AIR
              </span>
            </div>
            <button
              type="button"
              onClick={onGuest}
              title="Dismiss overlay to explore stream in read-only guest mode"
              className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white text-xs font-bold transition border border-white/25 flex items-center gap-2 shadow-xl hover:scale-105"
            >
              <Eye className="w-3.5 h-3.5 text-white" />
              Explore as Guest ↗
            </button>
          </div>

          <div className="relative z-10 space-y-3.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-xs font-mono font-bold tracking-wider">
              <Radio className="w-3.5 h-3.5 text-white" />
              The Central Media &amp; Streaming Network
            </span>
            <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight leading-tight">
              Where The World Connects, Streams &amp; Broadcasts Live.
            </h3>
            <p className="text-xs md:text-sm text-white/80 leading-relaxed font-medium max-w-md">
              Step inside the central network. Stream premier 24/7 live shows, connect with visionary
              creators and industry leaders, and engage in real-time community hubs.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-white/80 font-bold">
              <span className="text-white flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-white" /> Global Creator Network
              </span>
              <span>•</span>
              <span className="text-white flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-white" /> 24/7 Central Broadcasts
              </span>
              <span>•</span>
              <span className="text-white flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-white" /> Real-Time Live Hubs
              </span>
            </div>
          </div>
        </div>

        {/* Form pane */}
        <div className="md:w-1/2 p-8 md:p-12 flex flex-col justify-between space-y-6 bg-neutral-900/70 backdrop-blur-2xl text-white border-t md:border-t-0 md:border-l border-white/10 overflow-y-auto no-scrollbar">
          {selectedSSO ? (
            <div className="space-y-5 animate-fadeIn text-left my-auto">
              <div className="flex items-center justify-between pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSSO(null);
                    setError(null);
                  }}
                  className="text-xs text-white/70 hover:text-white flex items-center gap-1.5 font-bold transition group"
                >
                  <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition" />
                  Back to all options
                </button>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-[10px] text-white/70 font-semibold">
                  <ShieldCheck className="w-3 h-3" /> NEU SSO Gateway
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/15 flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-lg flex-shrink-0">
                  {ssoIcon(selectedSSO.id)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-base text-white tracking-tight">Sign in with {selectedSSO.name}</h2>
                    <span className="px-2 py-0.5 rounded-full bg-white/10 text-[9px] font-mono text-white/80 font-bold">SSO</span>
                  </div>
                  <p className="text-xs text-white/60 font-medium mt-0.5">
                    Enter your registered {selectedSSO.name} credentials to sign in.
                  </p>
                </div>
              </div>

              <form className="space-y-4" onSubmit={submitSso}>
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-white/80 flex items-center justify-between" htmlFor="sso-handle">
                    {ssoHandleField(selectedSSO).label}
                    <span className="text-[10px] text-white/40 font-normal">Ecosystem ID</span>
                  </label>
                  <input
                    id="sso-handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder={ssoHandleField(selectedSSO).placeholder}
                    autoComplete="username"
                    className={INPUT_CLASS.replace('focus:border-white/40', 'focus:border-white/50')}
                  />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-white/80 flex items-center justify-between" htmlFor="sso-password">
                    {selectedSSO.name} Password or Security PIN*
                    <span className="text-[10px] text-white/40 font-normal">Encrypted</span>
                  </label>
                  <input
                    id="sso-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    className={INPUT_CLASS.replace('focus:border-white/40', 'focus:border-white/50')}
                  />
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1.5 text-[11px] text-white/70">
                  {[
                    `Sync ${selectedSSO.name} member status & badge`,
                    'Full HD live broadcast streaming & interactive chat',
                    `Instant access to official #${selectedSSO.id} community hub`,
                  ].map((line) => (
                    <div key={line} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white flex-shrink-0" />
                      {line}
                    </div>
                  ))}
                </div>

                {error ? (
                  <div className="px-3.5 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-300">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-3.5 rounded-full bg-white hover:bg-white/90 disabled:opacity-60 text-black font-black text-xs md:text-sm transition shadow-2xl flex items-center justify-center gap-2 transform active:scale-95 mt-2"
                >
                  {pending ? 'Verifying…' : `Authorize & Sign In with ${selectedSSO.name}`}
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-6 flex flex-col justify-between h-full">
              <div className="space-y-1.5 text-left">
                <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight font-sans">
                  {authMode === 'signup' ? 'Create NEU Passport' : 'Welcome Back to NEU TV'}
                </h2>
                <p className="text-xs md:text-sm text-white/60 font-medium">
                  {authMode === 'signup'
                    ? 'One unified login for all 5 New Economy platforms.'
                    : 'Sign in to access 24/7 live broadcasts, community hubs, and creator feeds.'}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-white/50 px-1">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-white" /> Sign In with Ecosystem Account (SSO)
                  </span>
                  <span className="text-[10px] text-white/80 font-bold">Instant Login</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {products.map((prod) => (
                    <button
                      key={prod.id}
                      type="button"
                      onClick={() => {
                        setSelectedSSO(prod);
                        setError(null);
                        setHandle('');
                        setPassword('');
                      }}
                      className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/15 hover:border-white/20 text-left transition flex items-center gap-2.5 group shadow-sm"
                    >
                      <span className="w-8 h-8 rounded-xl bg-black/50 border border-white/15 flex items-center justify-center p-1.5 flex-shrink-0 group-hover:scale-105 transition overflow-hidden shadow-inner">
                        {prod.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={prod.logo} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="font-black text-xs text-white">{prod.name.slice(0, 2)}</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-bold text-xs text-white truncate">{prod.name}</span>
                        <span className="block text-[9px] text-white/40 truncate">SSO Gateway</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative flex items-center justify-center py-0.5">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-neutral-900 px-3 text-[10px] text-white/40 font-bold uppercase absolute">
                  or with email
                </span>
              </div>

              <form className="space-y-3.5" onSubmit={submitEmail}>
                {authMode === 'signup' ? (
                  <div className="space-y-1.5 text-left">
                    <label className="text-xs font-bold text-white/70" htmlFor="auth-name">
                      Full Name / Trader Alias*
                    </label>
                    <input
                      id="auth-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Trader"
                      autoComplete="name"
                      className={INPUT_CLASS}
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-white/70" htmlFor="auth-email">
                    Email Address*
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex@neweconomy.io"
                    autoComplete="email"
                    className={INPUT_CLASS}
                  />
                </div>
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-white/70" htmlFor="auth-password">
                    Password*
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                    className={INPUT_CLASS}
                  />
                </div>

                <label className="flex items-center gap-2.5 text-xs text-white/60 cursor-pointer select-none">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded text-white accent-white cursor-pointer" />
                  <span className="text-xs leading-snug">I agree to the Terms of Service &amp; Privacy Policy.</span>
                </label>

                {error ? (
                  <div className="px-3.5 py-2.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-[11px] text-red-300">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full py-3.5 rounded-full bg-white hover:bg-white/90 disabled:opacity-60 text-black font-black text-xs md:text-sm transition shadow-2xl flex items-center justify-center gap-2 transform active:scale-95 mt-1"
                >
                  {pending ? 'Verifying…' : authMode === 'signup' ? 'Create NEU Passport' : 'Sign In to NEU TV'}
                  <ArrowRight className="w-4 h-4 stroke-[3]" />
                </button>
              </form>

              <div className="text-center pt-1 text-xs text-white/50">
                {authMode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode((m) => (m === 'signup' ? 'signin' : 'signup'));
                    setError(null);
                  }}
                  className="text-white font-bold underline hover:text-white/80 ml-1"
                >
                  {authMode === 'signup' ? 'Sign In' : 'Create Passport'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
