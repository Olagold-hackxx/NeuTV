'use client';

// The Live Gift Store. Costs are the server's; an unaffordable tile stays
// pressable and answers with the shortfall, because balances open at zero and
// that is the common case, not the edge case.

import type { Gift } from '@/lib/types';

type GiftPaletteProps = {
  gifts: Gift[];
  balance: number;
  onClose: () => void;
  onSend: (gift: Gift) => void;
};

export function GiftPalette({ gifts, balance, onClose, onSend }: GiftPaletteProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-label="Live Gift Store"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="glass-card rounded-3xl w-full max-w-lg p-6 space-y-6 border border-white/20 shadow-2xl bg-neutral-950 text-white">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-2xl bg-[#0070F3] text-white flex items-center justify-center text-xl shadow-xl" aria-hidden>
              🎁
            </span>
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Live Gift Store</h2>
              <p className="text-xs text-[#38B6FF] font-bold num">Your Balance: {balance.toLocaleString()} KashCoins</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white text-sm font-bold">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          {gifts.map((gift) => {
            const affordable = balance >= gift.cost;
            return (
              <button
                key={gift.id}
                type="button"
                onClick={() => onSend(gift)}
                className={`p-4 rounded-2xl border text-center transition flex flex-col items-center justify-between space-y-2 ${
                  affordable
                    ? 'bg-white/5 border-white/15 hover:border-[#0070F3] hover:bg-[#0070F3]/20 cursor-pointer shadow-md'
                    : 'bg-white/[0.02] border-white/5 opacity-40 cursor-not-allowed'
                }`}
              >
                <span className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shadow-inner" aria-hidden>
                  {gift.emoji || '🎁'}
                </span>
                <span className="font-bold text-xs text-white">{gift.name}</span>
                <span className="text-[11px] text-[#38B6FF] font-black mt-0.5 font-mono num">
                  {gift.label ?? `${gift.cost.toLocaleString()} Coins`}
                </span>
              </button>
            );
          })}
        </div>

        <div className="pt-2 border-t border-white/10 text-center text-xs text-white/50">
          Sending gifts supports creators &amp; triggers live animated alerts on screen!
        </div>
      </div>
    </div>
  );
}
