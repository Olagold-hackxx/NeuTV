'use client';

// The passport-verified celebration after a successful sign-in, confetti and
// all. Coins are not mentioned: every wallet opens at zero and the party must
// not imply otherwise.

import { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

const CONFETTI_COLORS = ['#0070F3', '#38B6FF', '#ffffff', '#FFC700', '#00D68F', '#A855F7', '#FF2A38'];

type Confetto = { id: number; left: number; color: string; size: number; delay: number; rotation: number };

export function Celebration({
  name,
  badge,
  onEnter,
}: {
  name: string;
  badge?: string;
  onEnter: () => void;
}) {
  const [confetti, setConfetti] = useState<Confetto[]>([]);

  useEffect(() => {
    setConfetti(
      Array.from({ length: 50 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + Math.random() * 6,
        delay: Math.random() * 0.8,
        rotation: Math.random() * 360,
      })),
    );
    const timer = setTimeout(() => setConfetti([]), 4200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 animate-fadeIn select-none" role="dialog" aria-modal="true">
      {confetti.map((c) => (
        <span
          key={c.id}
          aria-hidden
          className="confetti-particle rounded-xs shadow-lg"
          style={{
            left: `${c.left}%`,
            backgroundColor: c.color,
            width: `${c.size}px`,
            height: `${c.size * 1.6}px`,
            animationDelay: `${c.delay}s`,
            transform: `rotate(${c.rotation}deg)`,
          }}
        />
      ))}

      <div className="relative z-10 w-full max-w-lg bg-neutral-950 border border-white/20 rounded-3xl p-8 md:p-10 text-center text-white space-y-6 animate-scaleUp">
        <div className="relative mx-auto w-20 h-20 rounded-full bg-white/10 border border-white/25 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center font-black text-xl">
            <Sparkles className="w-7 h-7 text-black" />
          </div>
          <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-[#0070F3] text-black flex items-center justify-center font-bold text-xs border-2 border-black">
            ✓
          </span>
        </div>

        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-bold text-white uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" /> Passport Active
          </span>
          <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">Welcome, {name}!</h2>
          <p className="text-xs md:text-sm text-white/60 font-medium max-w-sm mx-auto">
            Your NEU Passport is active. You now have full access to NEU Network broadcasts and official hubs.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white/5 border border-white/15 space-y-3 text-left">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60 font-medium">Member Role:</span>
            <span className="text-xs font-extrabold text-emerald-400">{badge || 'NEU Viewer'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/60 font-medium">Central Stream Status:</span>
            <span className="text-xs font-bold text-white">Full HD &amp; Interactive Chat Unlocked</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onEnter}
          className="w-full py-4 rounded-full bg-white hover:bg-white/90 text-black font-black text-sm transition shadow-2xl flex items-center justify-center gap-2 transform active:scale-95"
        >
          Enter Central Broadcast &amp; Live Stage
          <ArrowRight className="w-4 h-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
}
