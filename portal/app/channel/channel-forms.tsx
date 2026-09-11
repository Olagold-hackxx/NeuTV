'use client';

import { useActionState, useState } from 'react';
import { buyChannel, updateChannel, type ActionResult } from '@/lib/actions';

const pad = (n: number) => String(n).padStart(3, '0');

export function BuyChannelForm({
  price, floor, ceiling, nextFree, taken, balance,
}: { price: number; floor: number; ceiling: number; nextFree: number | null; taken: number[]; balance: number }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(buyChannel, null);
  const [number, setNumber] = useState(nextFree ? String(nextFree) : '');
  const chosen = Number(number);
  const isTaken = Number.isInteger(chosen) && taken.includes(chosen);
  const short = balance < price;

  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}
      {state?.ok ? <div className="alert alert-ok">Bought. Your number is live in the channels area.</div> : null}

      <div className="field">
        <label htmlFor="number">Decoder number</label>
        <input
          id="number"
          name="number"
          type="number"
          min={floor}
          max={ceiling}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder={nextFree ? String(nextFree) : 'none free'}
          disabled={pending}
        />
        <p className={`hint ${isTaken ? 'text-amber' : ''}`}>
          {isTaken
            ? `Ch ${pad(chosen)} is taken. ${nextFree ? `Ch ${pad(nextFree)} is the next free one.` : ''}`
            : `Pick any number from ${floor} to ${ceiling}, or leave it and take the next free one. Numbers below ${floor} are the network's.`}
        </p>
      </div>
      <div className="field">
        <label htmlFor="name">Channel name</label>
        <input id="name" name="name" minLength={2} maxLength={60} placeholder="Defaults to your display name" disabled={pending} />
      </div>
      <div className="field">
        <label htmlFor="tagline">Tagline</label>
        <input id="tagline" name="tagline" maxLength={160} placeholder="What viewers get when they flip to you" disabled={pending} />
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending || isTaken || short}>
        {pending ? 'Buying' : `Buy for ${price.toLocaleString()} KASH`}
      </button>
      <p className={`hint ${short ? 'text-amber' : ''}`}>
        {short
          ? `Your balance is ${balance.toLocaleString()} KASH; the number costs ${price.toLocaleString()}. Top up through KashPlus first.`
          : `Charged from your KashCoin balance of ${balance.toLocaleString()} KASH. The purchase is the network's revenue, and a share of it comes back through the viewers' choice.`}
      </p>
    </form>
  );
}

export function EditChannelForm({ name, tagline }: { name: string; tagline: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(updateChannel, null);
  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}
      {state?.ok ? <div className="alert alert-ok">Saved.</div> : null}
      <div className="field">
        <label htmlFor="name">Channel name</label>
        <input id="name" name="name" required minLength={2} maxLength={60} defaultValue={name} disabled={pending} />
      </div>
      <div className="field">
        <label htmlFor="tagline">Tagline</label>
        <input id="tagline" name="tagline" maxLength={160} defaultValue={tagline} disabled={pending} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? 'Saving' : 'Save'}</button>
    </form>
  );
}
