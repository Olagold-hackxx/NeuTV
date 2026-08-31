'use client';

import { X } from 'lucide-react';
import type { Product, SessionUser } from '@/lib/types';
import { NeuTVClient } from '@/lib/client';
import { SignInForms } from './sign-in';

type GateProps = {
  products: Product[];
  client: NeuTVClient;
  onClose: () => void;
  onSignedIn: (user: SessionUser) => void;
};

// The in-app sign-in gate: the shared forms in a modal, for a guest who hits
// something that needs an account mid-session.
export function Gate({ products, client, onClose, onSignedIn }: GateProps) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label="Sign in">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md overflow-hidden rounded-panel border border-line bg-midnight shadow-overlay">
        {/* The screen's one non-wordmark gradient: the gate's header rule. */}
        <div className="identity-rule" aria-hidden />

        <header className="flex items-center justify-between px-5 pt-4">
          <span className="text-lg font-extrabold italic tracking-tight">
            <span className="wordmark-gradient">NEU</span>
            <span className="ml-1 text-xs font-extrabold not-italic text-sky">TV</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-control text-dim hover:bg-obsidian hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>

        <div className="p-5">
          <SignInForms products={products} client={client} onSignedIn={onSignedIn} />
        </div>
      </div>
    </div>
  );
}
