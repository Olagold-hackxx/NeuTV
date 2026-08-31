'use client';

import { useEffect, useRef, useState } from 'react';
import { Menu, Search, X, LogOut, Coins } from 'lucide-react';
import type { SessionUser } from '@/lib/types';
import { coins, compact } from '@/lib/format';

type TopBarProps = {
  search: string;
  onSearch: (q: string) => void;
  viewers: number | null;
  liveNow: boolean;
  balance: number;
  user: SessionUser | null;
  onOpenGate: () => void;
  onSignOut: () => void;
  onOpenDrawer: () => void;
  onOpenGifts: () => void;
};

export function TopBar({
  search,
  onSearch,
  viewers,
  liveNow,
  balance,
  user,
  onOpenGate,
  onSignOut,
  onOpenDrawer,
  onOpenGifts,
}: TopBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-colors duration-(--duration-base) ${
        scrolled ? 'border-line bg-midnight' : 'border-transparent bg-base'
      }`}
    >
      <div className="mx-auto flex h-14 w-full max-w-[1440px] items-center gap-3 px-4 md:px-6">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open navigation"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-dim hover:bg-obsidian hover:text-ink md:hidden"
        >
          <Menu size={18} />
        </button>

        {/* Search: filters the announcements feed as you type. */}
        <div className={`relative min-w-0 ${mobileSearch ? 'flex-1' : 'hidden md:block md:w-72'}`}>
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search broadcasts and announcements"
            aria-label="Search broadcasts and announcements"
            className="w-full rounded-control border border-line bg-midnight py-2 pr-8 pl-9 text-[13px] text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
          />
          {search ? (
            <button
              type="button"
              onClick={() => onSearch('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-chip text-faint hover:text-ink"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>
        {!mobileSearch ? (
          <button
            type="button"
            onClick={() => setMobileSearch(true)}
            aria-label="Search"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-control text-dim hover:bg-obsidian hover:text-ink md:hidden"
          >
            <Search size={17} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMobileSearch(false);
              onSearch('');
            }}
            className="shrink-0 text-xs font-semibold text-dim md:hidden"
          >
            Cancel
          </button>
        )}

        <div className="flex-1" />

        {/* Live telemetry. Red belongs to a genuinely live event only. */}
        <div className={`items-center gap-2 text-xs font-semibold text-dim ${mobileSearch ? 'hidden' : 'hidden sm:flex'}`}>
          {liveNow ? <span className="live-dot" aria-hidden /> : null}
          <span className="num">{viewers === null ? '—' : compact(viewers)} watching</span>
          <span className="text-faint">1080p</span>
        </div>

        <button
          type="button"
          onClick={onOpenGifts}
          title="Open the gift palette"
          className={`items-center gap-1.5 rounded-control border border-line bg-midnight px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-obsidian ${
            mobileSearch ? 'hidden' : 'hidden sm:flex'
          }`}
        >
          <Coins size={14} className="text-cyan" />
          <span className="num">{coins(balance)}</span>
          <span className="text-faint">KashCoin</span>
        </button>

        {user ? (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-control px-1.5 py-1 hover:bg-obsidian"
            >
              {user.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-full bg-obsidian text-xs font-extrabold text-cyan">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden max-w-28 truncate text-[13px] font-semibold lg:block">{user.name}</span>
            </button>
            {menuOpen ? (
              <div
                role="menu"
                className="absolute top-11 right-0 w-52 rounded-panel border border-line bg-obsidian p-1.5 shadow-overlay"
              >
                <div className="px-2.5 py-2">
                  <div className="truncate text-[13px] font-bold">{user.name}</div>
                  {user.badge ? <div className="text-xs text-dim">{user.badge}</div> : null}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onSignOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-control px-2.5 py-2 text-left text-[13px] font-semibold text-dim hover:bg-midnight hover:text-ink"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenGate}
            className="shrink-0 rounded-control bg-cyan px-3.5 py-2 text-xs font-bold text-deep transition hover:brightness-110"
          >
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
