'use client';

// Viewers choice: the quarterly leaderboard, public to everyone. Each viewer
// gets one vote a quarter and can move it until the quarter closes. The
// winner takes a fixed share of the quarter's network revenue, so the prize
// on the board is the network's real number, not a promise.

import { useCallback, useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import type { Leaderboard } from '@/lib/types';
import { NeuTVClient, sync } from '@/lib/client';

type ViewersChoiceProps = {
  client: NeuTVClient;
  signedIn: boolean;
  onRequireSignIn: () => void;
  showToast: (msg: string) => void;
};

const closesIn = (endsAt: number, now: number) => {
  const days = Math.max(0, Math.ceil((endsAt - now) / 86_400_000));
  return days === 1 ? 'closes tomorrow' : `closes in ${days} days`;
};

export function ViewersChoice({ client, signedIn, onRequireSignIn, showToast }: ViewersChoiceProps) {
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    client.viewersChoice()
      .then((res) => { if (!cancelled) setBoard(res); })
      .catch(() => { /* the board is optional on a cold API */ });
    return () => { cancelled = true; };
  }, [client]);

  useEffect(load, [load, signedIn]);

  const vote = (handle: string, userId: string) => {
    if (!signedIn) {
      onRequireSignIn();
      return;
    }
    setBusy(userId);
    void sync(
      async () => {
        const res = await client.vote(handle);
        showToast(res.moved ? `Your vote moved to ${res.vote.handle}` : `You voted for ${res.vote.handle}`);
        load();
        return res;
      },
      (err) => showToast(err.message || 'That vote did not go through.'),
    ).finally(() => setBusy(null));
  };

  if (!board) return null;

  return (
    <section className="w-full space-y-3 pt-2" aria-label="Viewers choice">
      <div className="flex items-end justify-between gap-4 px-1">
        <div>
          <h2 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <Trophy className="w-4 h-4 text-white" />
            Viewers&apos; Choice
          </h2>
          <p className="text-xs text-white/50 mt-0.5">
            Best creator of {board.quarter}, decided by you. One vote each, {closesIn(board.endsAt, Date.now())}.
          </p>
        </div>
        <div className="text-right whitespace-nowrap">
          <div className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Winner takes {board.sharePct}%</div>
          <div className="text-sm font-black text-white num">{board.prize.toLocaleString()} KASH</div>
          <div className="text-[10px] text-white/40 num">of {board.revenue.toLocaleString()} KASH network revenue so far</div>
        </div>
      </div>

      {board.standings.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#141418]/60 px-5 py-6 text-center">
          <p className="text-sm text-white/70 font-semibold">No votes yet this quarter.</p>
          <p className="text-xs text-white/40 mt-1">The board fills in as creators earn votes on the Creators Network.</p>
        </div>
      ) : (
        <ol className="rounded-2xl border border-white/10 bg-[#141418]/60 divide-y divide-white/[0.06]">
          {board.standings.map((row) => {
            const mine = board.myVote === row.userId;
            return (
              <li key={row.userId} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-6 text-center font-mono text-xs font-black text-white/50 num">{row.rank}</span>
                {row.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
                    {row.name.replace(/^[@$]/, '').slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white truncate">{row.name}</div>
                  <div className="text-[11px] text-white/50 truncate">
                    {row.handle}
                    {row.channelNumber ? <span className="font-mono num"> · Ch {String(row.channelNumber).padStart(3, '0')}</span> : null}
                  </div>
                </div>
                <span className="text-xs font-black text-white num whitespace-nowrap">
                  {row.votes.toLocaleString()} {row.votes === 1 ? 'vote' : 'votes'}
                </span>
                <button
                  type="button"
                  onClick={() => vote(row.handle, row.userId)}
                  disabled={busy !== null || mine}
                  aria-pressed={mine}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black transition whitespace-nowrap ${
                    mine
                      ? 'bg-[#00F6A7]/15 border border-[#00F6A7]/50 text-[#00F6A7]'
                      : 'bg-white text-black hover:bg-neutral-200 disabled:opacity-60'
                  }`}
                >
                  {mine ? 'Your vote' : busy === row.userId ? 'Voting' : 'Vote'}
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {board.lastAward?.winner ? (
        <p className="text-[11px] text-white/40 px-1 num">
          {board.lastAward.quarter}: {board.lastAward.winner.name} won with {board.lastAward.votes.toLocaleString()} votes and took {board.lastAward.prize.toLocaleString()} KASH.
        </p>
      ) : null}
    </section>
  );
}
