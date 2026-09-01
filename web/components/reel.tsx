'use client';

// Creator spotlights: the continuously panning marquee of autoplaying creator
// cards, each themed to its ecosystem product.

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Eye, Play } from 'lucide-react';
import type { Spotlight } from '@/lib/types';
import { brandTheme } from '@/lib/brand';

type ReelProps = {
  spotlights: Spotlight[];
  onSelect: (spotlight: Spotlight) => void;
};

export function Reel({ spotlights, onSelect }: ReelProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (spotlights.length === 0) return null;

  const nudge = (dir: -1 | 1) => {
    scrollerRef.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <section className="w-full space-y-3 pt-2" aria-label="Creator spotlights">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/70 animate-pulse" aria-hidden />
          <h2 className="text-base font-black text-white tracking-tight">Creator Spotlights</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            title="Previous"
            onClick={() => nudge(-1)}
            className="w-8 h-8 rounded-full bg-[#141418] hover:bg-[#1E1E24] text-white/80 hover:text-white border border-white/15 flex items-center justify-center transition shadow-md hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            title="Next"
            onClick={() => nudge(1)}
            className="w-8 h-8 rounded-full bg-[#141418] hover:bg-[#1E1E24] text-white/80 hover:text-white border border-white/15 flex items-center justify-center transition shadow-md hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="w-full overflow-x-auto no-scrollbar py-2 px-1 relative select-none cursor-grab active:cursor-grabbing"
      >
        <div className="animate-marquee-left gap-4 flex items-center">
          {[...spotlights, ...spotlights].map((cr, idx) => {
            const dup = idx >= spotlights.length;
            const theme = brandTheme(cr.productId);
            return (
              <button
                key={`${cr.id}-${idx}`}
                type="button"
                tabIndex={dup ? -1 : 0}
                aria-hidden={dup || undefined}
                onClick={() => onSelect(cr)}
                className="w-56 md:w-60 flex-shrink-0 relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/15 bg-neutral-950 group cursor-pointer shadow-xl transition-all duration-500 hover:border-white/40 hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)] hover:-translate-y-1.5 text-left"
              >
                {cr.videoMp4 ? (
                  <video
                    src={cr.videoMp4}
                    poster={cr.thumbnail || undefined}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition duration-700 pointer-events-none"
                  />
                ) : cr.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cr.thumbnail}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-85 group-hover:opacity-100 group-hover:scale-105 transition duration-700 pointer-events-none"
                  />
                ) : null}

                <span className="absolute inset-0 bg-gradient-to-t from-black via-black/25 to-black/70 pointer-events-none z-10" />

                <span className="absolute top-3 left-3 right-3 flex items-center justify-between z-20">
                  <span className="flex items-center gap-2 min-w-0">
                    {cr.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cr.avatar} alt="" className="w-7 h-7 rounded-full object-cover border-2 border-white/20 flex-shrink-0" />
                    ) : null}
                    <span className="font-extrabold text-xs text-white truncate drop-shadow">{cr.name}</span>
                  </span>
                  {cr.product ? (
                    <span
                      className={`px-2 py-0.5 rounded-full bg-black/80 border ${theme.borderColor} text-[9px] font-bold ${theme.accentText} shadow flex-shrink-0`}
                    >
                      {cr.product}
                    </span>
                  ) : null}
                </span>

                <span className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                  <span className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md border border-white/30 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black group-hover:scale-110 transition duration-300 shadow-2xl">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </span>
                </span>

                <span className="absolute bottom-3 left-3 right-3 space-y-1 z-20 block">
                  {cr.tag ? (
                    <span className={`inline-block px-2 py-0.5 rounded-md bg-black/85 border border-white/15 text-[9px] font-extrabold ${theme.accentText}`}>
                      {cr.tag}
                    </span>
                  ) : null}
                  <span className="block text-xs md:text-sm font-black text-white leading-snug line-clamp-2 drop-shadow">{cr.title}</span>
                  <span className="flex items-center justify-between text-[10px] text-white/80 font-mono pt-0.5">
                    <span className="flex items-center gap-1 text-white font-bold">
                      <Eye className="w-3 h-3" /> {cr.views}
                    </span>
                    {cr.duration ? (
                      <span className="px-1.5 py-0.5 rounded bg-black/70 border border-white/15 font-bold text-white/90">{cr.duration}</span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
