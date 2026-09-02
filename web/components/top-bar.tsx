'use client';

// The main column's header: tab strip, search, quality selector.

import { useState } from 'react';
import { Bookmark, Flame, Search, Tv, Users } from 'lucide-react';
import type { MainTab } from './rail';

type TopBarProps = {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  search: string;
  onSearch: (q: string) => void;
};

const TABS: { tab: MainTab; label: string }[] = [
  { tab: 'tv', label: 'NEU Network Live' },
  { tab: 'foryou', label: 'For You Feed' },
  { tab: 'following', label: 'Following' },
  { tab: 'saved', label: 'Saved' },
];

function tabIcon(tab: MainTab) {
  switch (tab) {
    case 'tv':
      return <Tv className="w-4 h-4" />;
    case 'foryou':
      return <Flame className="w-4 h-4 text-red-500 fill-red-500 stroke-red-500" />;
    case 'following':
      return <Users className="w-4 h-4" />;
    case 'saved':
      return <Bookmark className="w-4 h-4" />;
  }
}

export function TopBar({ activeTab, onSelectTab, search, onSearch }: TopBarProps) {
  const [quality, setQuality] = useState('1080p');

  return (
    <header className="flex items-center justify-between gap-4 pb-4 border-b border-white/10 relative z-10">
      <div className="flex items-center gap-3 md:gap-5 text-xs font-bold overflow-x-auto no-scrollbar">
        {TABS.map(({ tab, label }) => {
          const active = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onSelectTab(tab)}
              aria-current={active ? 'true' : undefined}
              className={`pb-1.5 transition flex items-center gap-1.5 whitespace-nowrap ${
                active ? 'text-white border-b-2 border-white/30' : 'text-white/60 hover:text-white'
              }`}
            >
              {tabIcon(tab)}
              {label}
            </button>
          );
        })}
      </div>

      <div className="relative max-w-sm flex-1 hidden md:block">
        <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search NEU Network broadcasts, signals & videos..."
          aria-label="Search NEU Network broadcasts"
          className="w-full bg-[#141418]/70 border border-white/15 rounded-full pl-9 pr-4 py-1.5 text-xs text-white placeholder-white/40 outline-none focus:border-white/25 focus:bg-[#141418] transition"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearch('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white text-xs"
          >
            ✕
          </button>
        ) : null}
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          aria-label="Stream quality"
          className="bg-[#141418] border border-white/20 rounded-full px-3 py-1.5 text-xs text-white outline-none font-bold cursor-pointer focus:border-white/30"
        >
          <option value="1080p" className="bg-[#0A0A0C] text-white">1080p HD Ultra</option>
          <option value="auto" className="bg-[#0A0A0C] text-white">Auto (720p)</option>
          <option value="lowdata" className="bg-[#0A0A0C] text-white">Low Data (240p)</option>
        </select>
      </div>
    </header>
  );
}
