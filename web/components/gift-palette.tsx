'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import type { Gift, Product } from '@/lib/types';
import { coins } from '@/lib/format';

type GiftPaletteProps = {
  gifts: Gift[];
  balance: number;
  signedIn: boolean;
  onClose: () => void;
  onSend: (gift: Gift) => void;
  onRequireSignIn: () => void;
  products: Product[];
};

// Balances open at zero, so the can't-afford path is the common one, not the
// edge case: an unaffordable gift stays selectable and the palette answers
// with the exact shortfall and a way forward.
export function GiftPalette({ gifts, balance, signedIn, onClose, onSend, onRequireSignIn, products }: GiftPaletteProps) {
  const [selected, setSelected] = useState<Gift | null>(null);
  const kashplus = products.find((p) => p.id === 'linkpay' || p.name === 'KashPlus');

  const shortfall = selected ? Math.max(0, selected.cost - balance) : 0;
  const ordered = [...gifts].sort((a, b) => a.cost - b.cost);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Send a gift">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-panel border border-line bg-midnight shadow-overlay">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <h2 className="text-[15px] font-bold">Send a gift</h2>
            <div className="num text-xs text-dim">Balance: {coins(balance)} KashCoin</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-control text-dim hover:bg-obsidian hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-2 p-4">
          {ordered.map((gift) => {
            const affordable = balance >= gift.cost;
            const active = selected?.id === gift.id;
            return (
              <button
                key={gift.id}
                type="button"
                onClick={() => setSelected(gift)}
                aria-pressed={active}
                className={`flex flex-col items-center gap-1 rounded-control border px-2 py-3 transition ${
                  active
                    ? 'border-cyan bg-obsidian'
                    : affordable
                      ? 'border-line bg-base hover:border-line-strong'
                      : 'border-line bg-base opacity-60 hover:opacity-80'
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {gift.emoji}
                </span>
                <span className="text-[11px] leading-tight font-bold">{gift.name}</span>
                <span className={`num text-[11px] ${affordable ? 'text-dim' : 'text-faint'}`}>{coins(gift.cost)}</span>
              </button>
            );
          })}
        </div>

        <footer className="border-t border-line p-4">
          {!signedIn ? (
            <div>
              <p className="text-xs text-dim">Gifts come from your wallet, so sending one needs an account.</p>
              <button
                type="button"
                onClick={onRequireSignIn}
                className="mt-3 w-full rounded-control bg-cyan px-3 py-2.5 text-xs font-bold text-deep transition hover:brightness-110"
              >
                Sign in to send gifts
              </button>
            </div>
          ) : !selected ? (
            <p className="text-xs text-faint">Pick a gift. It lands on the broadcast for everyone watching.</p>
          ) : shortfall > 0 ? (
            <div>
              <p className="text-xs text-dim">
                {selected.name} costs <span className="num font-bold text-ink">{coins(selected.cost)}</span> KashCoin —
                you need <span className="num font-bold text-amber">{coins(shortfall)}</span> more.
              </p>
              {kashplus?.officialUrl ? (
                <a
                  href={kashplus.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block w-full rounded-control border border-line-strong bg-obsidian px-3 py-2.5 text-center text-xs font-bold transition hover:bg-midnight"
                >
                  Top up through KashPlus
                </a>
              ) : (
                <p className="mt-2 text-xs text-faint">Coins arrive through KashPlus top-ups.</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSend(selected)}
              className="w-full rounded-control bg-cyan px-3 py-2.5 text-xs font-bold text-deep transition hover:brightness-110"
            >
              Send {selected.name} — {coins(selected.cost)} KashCoin
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
