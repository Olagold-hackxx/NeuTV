'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { Spotlight } from '@/lib/types';

type ReelProps = {
  spotlights: Spotlight[];
  onPromote: (card: Record<string, unknown>) => void;
  skeleton: boolean;
};

// A continuously panning row of creator cards — one of the page's two allowed
// self-movers. Hover, focus, or the buttons pause it; reduced motion stops it.
export function Reel({ spotlights, onPromote, skeleton }: ReelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const nudge = (dir: -1 | 1) => {
    setPaused(true);
    scrollerRef.current?.scrollBy({ left: dir * 300, behavior: 'smooth' });
  };

  if (skeleton) {
    return (
      <section className="mt-6" aria-label="Creator spotlights (loading)">
        <div className="skeleton mb-3 h-5 w-44" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-40 w-64 shrink-0 rounded-panel" />
          ))}
        </div>
      </section>
    );
  }

  if (spotlights.length === 0) return null;

  // Cards are doubled so the pan loops seamlessly; the duplicates are hidden
  // from assistive tech and the tab order.
  const panning = !paused && !reduced;

  return (
    <section className="mt-6" aria-label="Creator spotlights">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Creator spotlights</h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => nudge(-1)}
            aria-label="Scroll back"
            className="grid h-7 w-7 place-items-center rounded-control text-dim transition hover:bg-obsidian hover:text-ink"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            onClick={() => nudge(1)}
            aria-label="Scroll forward"
            className="grid h-7 w-7 place-items-center rounded-control text-dim transition hover:bg-obsidian hover:text-ink"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="snap-x snap-mandatory overflow-x-auto pb-1 [scrollbar-width:thin]"
        onPointerDown={() => setPaused(true)}
      >
        <div
          ref={trackRef}
          className={panning ? 'reel-track flex w-max gap-3' : 'flex w-max gap-3'}
          data-paused={paused || undefined}
          style={{ ['--reel-duration' as string]: `${Math.max(30, spotlights.length * 8)}s` }}
        >
          {spotlights.map((s) => (
            <SpotlightCard key={s.id} spotlight={s} onPromote={onPromote} reduced={reduced} />
          ))}
          {panning
            ? spotlights.map((s) => (
                <div key={`dup-${s.id}`} aria-hidden className="contents">
                  <SpotlightCard spotlight={s} onPromote={onPromote} reduced={reduced} inert />
                </div>
              ))
            : null}
        </div>
      </div>
    </section>
  );
}

function SpotlightCard({
  spotlight,
  onPromote,
  reduced,
  inert,
}: {
  spotlight: Spotlight;
  onPromote: (card: Record<string, unknown>) => void;
  reduced: boolean;
  inert?: boolean;
}) {
  const s = spotlight;
  return (
    <button
      type="button"
      tabIndex={inert ? -1 : 0}
      onClick={() => onPromote({ ...s, youtubeId: s.videoUrl, videoMp4: s.videoMp4 })}
      className="group w-64 shrink-0 snap-start overflow-hidden rounded-panel border border-line bg-midnight text-left transition hover:border-line-strong"
    >
      <div className="relative aspect-video bg-black">
        {s.videoMp4 && !reduced ? (
          <video src={s.videoMp4} muted loop autoPlay playsInline className="h-full w-full object-cover" />
        ) : s.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.thumbnail} alt="" className="h-full w-full object-cover" />
        ) : null}
        {s.duration ? (
          <span className="num absolute right-2 bottom-2 rounded-chip bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">
            {s.duration}
          </span>
        ) : null}
        {/* The click's outcome, stated before the click. */}
        <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100 group-focus-visible:bg-black/40 group-focus-visible:opacity-100">
          <span className="flex items-center gap-1.5 rounded-control bg-cyan px-3 py-1.5 text-xs font-bold text-deep">
            <Play size={12} fill="currentColor" /> Watch on the stage
          </span>
        </span>
      </div>
      <div className="p-3">
        <div className="truncate text-[13px] font-bold">{s.title}</div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs text-dim">
          <span className="truncate">{s.name}</span>
          {s.views ? <span className="num shrink-0 text-faint">{s.views} views</span> : null}
        </div>
      </div>
    </button>
  );
}
