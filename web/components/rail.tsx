'use client';

// The left sidebar: brand header, KashCoin wallet badge, primary navigation
// and the communities directory — the CDN app's layout, faithfully.

import { BookOpen, Bookmark, Coins, Flame, LogIn, LogOut, PanelLeftClose, PanelLeftOpen, Tv, Users } from 'lucide-react';
import type { Product, SessionUser } from '@/lib/types';

export type MainTab = 'tv' | 'foryou' | 'following' | 'saved' | 'magazine';

type RailProps = {
  products: Product[];
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  activeProduct: string;
  onSelectProduct: (id: string) => void;
  balance: number;
  user: SessionUser | null;
  onOpenGifts: () => void;
  onOpenGate: () => void;
  onSignOut: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const NAV: { tab: MainTab; label: string }[] = [
  { tab: 'tv', label: 'NEU Network Live' },
  { tab: 'foryou', label: 'For You' },
  { tab: 'following', label: 'Following' },
  { tab: 'saved', label: 'Saved Videos' },
  { tab: 'magazine', label: 'E-Magazine' },
];

function navIcon(tab: MainTab) {
  switch (tab) {
    case 'tv':
      return <Tv className="w-4.5 h-4.5 text-white" />;
    case 'foryou':
      return <Flame className="w-4.5 h-4.5 fill-red-500 text-red-500 stroke-red-500" />;
    case 'following':
      return <Users className="w-4.5 h-4.5 text-white" />;
    case 'saved':
      return <Bookmark className="w-4.5 h-4.5 text-white" />;
    case 'magazine':
      return <BookOpen className="w-4.5 h-4.5 text-white" />;
  }
}

export function Rail({
  products,
  activeTab,
  onSelectTab,
  activeProduct,
  onSelectProduct,
  balance,
  user,
  onOpenGifts,
  onOpenGate,
  onSignOut,
  collapsed,
  onToggleCollapsed,
}: RailProps) {
  // Collapsed: an icon rail. Everything stays reachable; labels come back
  // when the sidebar expands again.
  if (collapsed) {
    return (
      <aside className="w-20 h-screen flex-shrink-0 hidden md:flex flex-col items-center justify-between py-6 px-3 border-r border-white/10 bg-[#0A0A0C]/95 backdrop-blur-2xl z-40 overflow-y-auto no-scrollbar shadow-2xl sticky top-0">
        <div className="flex flex-col items-center gap-5">
          <button
            type="button"
            onClick={() => {
              onSelectTab('tv');
              onSelectProduct('all');
            }}
            title="NEU Network Live"
            className="w-10 h-10 flex items-center justify-center hover:scale-105 transition duration-300"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/neu-cube-e.png" alt="NEU Network" className="w-full h-full object-contain drop-shadow" />
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Expand sidebar"
            aria-expanded={false}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onOpenGifts}
            title={`KashCoin Balance: ${balance.toLocaleString()} KASH — send a gift`}
            className="w-10 h-10 rounded-xl bg-[#0070F3]/20 border border-[#0070F3]/40 hover:bg-[#0070F3]/40 flex items-center justify-center text-[#38B6FF] transition"
          >
            <Coins className="w-4.5 h-4.5" />
          </button>

          <nav className="flex flex-col items-center gap-2 pt-2 border-t border-white/10 w-full" aria-label="Main">
            {NAV.map(({ tab, label }) => {
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onSelectTab(tab)}
                  title={label}
                  aria-current={active ? 'true' : undefined}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition ${
                    active ? 'bg-white/10 border border-white/20 shadow-md scale-105' : 'hover:bg-white/5'
                  }`}
                >
                  {navIcon(tab)}
                </button>
              );
            })}
          </nav>

          <div className="flex flex-col items-center gap-2 pt-2 border-t border-white/10 w-full">
            {products.map((prod) => {
              const isActive = activeProduct === prod.id;
              return (
                <button
                  key={prod.id}
                  type="button"
                  onClick={() => onSelectProduct(prod.id)}
                  title={prod.name}
                  className={`w-10 h-10 rounded-xl p-1.5 flex items-center justify-center transition ${
                    isActive ? 'bg-white shadow-md scale-105' : 'bg-white/5 border border-white/10 hover:bg-white/15'
                  }`}
                >
                  {prod.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={prod.logo} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className={`text-[10px] font-black ${isActive ? 'text-black' : 'text-white'}`}>
                      {prod.name.slice(0, 2)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-white/10 w-full flex justify-center">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              title={`${user.name} — log out`}
              className="w-9 h-9 rounded-full overflow-hidden border border-white/30 hover:border-rose-400 transition"
            >
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full bg-white/10 flex items-center justify-center text-xs font-black text-white">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenGate}
              title="Sign In to NEU Network"
              className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 transition shadow-lg"
            >
              <LogIn className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 md:w-72 h-screen flex-shrink-0 hidden md:flex flex-col justify-between p-6 border-r border-white/10 bg-[#0A0A0C]/95 backdrop-blur-2xl z-40 overflow-y-auto no-scrollbar shadow-2xl sticky top-0 space-y-6">
      <div className="space-y-6">
        {/* Brand header */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              onSelectTab('tv');
              onSelectProduct('all');
            }}
            className="flex items-center gap-3 cursor-pointer py-1 group select-none flex-1 min-w-0 text-left"
          >
            <div className="h-10 flex-shrink-0 group-hover:scale-105 transition duration-300">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/neu-brand-banner.png" alt="NEU Network" className="h-full w-auto object-contain drop-shadow" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 leading-none">
                <span className="text-white text-[11px] font-black tracking-widest">NETWORK</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1 shadow-[0_0_8px_rgba(52,211,153,0.5)]" aria-hidden />
              </div>
              <p className="text-[8px] font-mono tracking-wider text-white/50 uppercase mt-1 font-bold truncate">
                NEW ECONOMY UNVEIL NETWORK
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title="Collapse sidebar"
            aria-expanded
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition flex-shrink-0"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Wallet */}
        <div className="p-3.5 rounded-2xl bg-[#141418]/80 border border-white/10 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0070F3]/20 border border-[#0070F3]/40 flex items-center justify-center text-[#38B6FF]">
              <Coins className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-[9px] text-white/50 font-extrabold uppercase tracking-wider">KashCoin Balance</div>
              <div className="text-xs md:text-sm font-black text-white num">{balance.toLocaleString()} KASH</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenGifts}
            className="px-3 py-1.5 rounded-full bg-[#0070F3] hover:bg-[#0060DF] text-white text-[11px] font-black transition shadow-lg flex items-center gap-1.5 transform active:scale-95"
          >
            <span className="text-sm" aria-hidden>🎁</span>
            <span>Gift</span>
          </button>
        </div>

        {/* Primary nav */}
        <nav className="space-y-1.5" aria-label="Main">
          <div className="text-[10px] font-extrabold tracking-widest text-white/40 uppercase mb-2 px-3">NAVIGATION</div>
          {NAV.map(({ tab, label }) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onSelectTab(tab)}
                aria-current={active ? 'true' : undefined}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition duration-200 ${
                  active
                    ? 'bg-white/10 text-white font-black border border-white/20 shadow-md scale-[1.02]'
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  {navIcon(tab)}
                  {label}
                </span>
                {tab === 'tv' ? (
                  <span
                    className={`text-[9px] px-2 py-0.5 rounded-full font-extrabold ${
                      active ? 'bg-red-500 text-white' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    ON AIR
                  </span>
                ) : tab === 'foryou' ? (
                  <span className="text-[9px] px-2 py-0.5 rounded-full font-black bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1">
                    🔥 Hot
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        {/* Communities & sites */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-extrabold tracking-widest text-white/40 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-white/40" /> COMMUNITIES &amp; SITES
            </span>
            {activeProduct !== 'all' ? (
              <button
                type="button"
                onClick={() => onSelectProduct('all')}
                className="text-[10px] text-white/60 hover:text-white underline font-semibold"
              >
                All Feeds
              </button>
            ) : null}
          </div>
          <div className="space-y-1.5">
            {products.map((prod) => {
              const isActive = activeProduct === prod.id;
              return (
                <div key={prod.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSelectProduct(prod.id)}
                    className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-between shadow-sm ${
                      isActive
                        ? 'bg-white text-black font-extrabold shadow-md scale-[1.02]'
                        : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/15 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      {prod.logo ? (
                        <span className={`w-5 h-5 rounded-md ${isActive ? 'bg-black/10' : 'bg-white/10'} p-0.5 flex items-center justify-center flex-shrink-0`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={prod.logo} alt="" className="w-full h-full object-contain" />
                        </span>
                      ) : (
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-black' : 'bg-emerald-400'}`} aria-hidden />
                      )}
                      <span className="truncate">{prod.name}</span>
                    </span>
                    {prod.badge ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-black text-white' : 'bg-white/10 text-white/60'}`}>
                        {prod.badge}
                      </span>
                    ) : null}
                  </button>
                  {prod.officialUrl ? (
                    <a
                      href={prod.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      title={`Visit ${prod.name} Official Website`}
                      className="px-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/20 text-white text-[10px] font-bold border border-white/10 transition flex items-center justify-center flex-shrink-0"
                    >
                      Site ↗
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* User footer */}
      <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-2">
        {user ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5 min-w-0">
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/30 shadow-md flex-shrink-0" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-white/10 border border-white/30 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{user.name}</div>
                {user.badge ? <div className="text-[9px] text-emerald-400 font-bold truncate">{user.badge}</div> : null}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={onSignOut}
                title="Log out & return to Sign In screen"
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-rose-500/20 text-white/50 hover:text-rose-400 flex items-center justify-center transition border border-white/10"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenGate}
            className="w-full py-2.5 rounded-full bg-white text-black font-extrabold text-xs hover:bg-white/90 transition shadow-lg text-center flex items-center justify-center gap-2"
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In to NEU Network
          </button>
        )}
      </div>
    </aside>
  );
}
