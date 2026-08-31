'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronUp, Send, Trophy } from 'lucide-react';
import type { CommunityHub, LeaderboardRow, Product, SessionUser } from '@/lib/types';
import { NeuTVClient, sync, type ChatMessage } from '@/lib/client';
import { coins } from '@/lib/format';

type ChatRailProps = {
  hubs: Record<string, CommunityHub>;
  products: Product[];
  activeProduct: string;
  client: NeuTVClient;
  user: SessionUser | null;
  onRequireSignIn: () => void;
  showToast: (msg: string) => void;
  sheetOpen: boolean;
  onToggleSheet: () => void;
  unread: number;
  skeleton: boolean;
};

export function ChatRail(props: ChatRailProps) {
  const { hubs, activeProduct, sheetOpen, onToggleSheet, unread } = props;

  const hubId = useMemo(() => {
    if (hubs[activeProduct]) return activeProduct;
    return Object.keys(hubs)[0] ?? null;
  }, [hubs, activeProduct]);

  if (!hubId) return null;

  return (
    <>
      {/* Desktop: a fixed-width rail, independently scrollable. */}
      <aside className="sticky top-19 hidden max-h-[calc(100dvh-5.5rem)] w-80 shrink-0 flex-col gap-4 overflow-y-auto xl:flex">
        <RailContent {...props} hubId={hubId} />
      </aside>

      {/* Below the rail breakpoint the chat becomes a bottom sheet. */}
      <div className="fixed inset-x-0 bottom-0 z-40 xl:hidden">
        {sheetOpen ? (
          <div className="mx-auto flex h-[65dvh] max-w-xl flex-col gap-4 overflow-y-auto rounded-t-panel border border-b-0 border-line bg-midnight p-4 shadow-overlay">
            <RailContent {...props} hubId={hubId} />
          </div>
        ) : null}
        <button
          type="button"
          onClick={onToggleSheet}
          aria-expanded={sheetOpen}
          className="mx-auto flex w-full max-w-xl items-center justify-center gap-2 border-t border-line bg-midnight px-4 py-2.5 text-xs font-bold text-dim"
        >
          <ChevronUp size={14} className={`transition-transform ${sheetOpen ? 'rotate-180' : ''}`} />
          {sheetOpen ? 'Hide chat' : 'Community chat'}
          {!sheetOpen && unread > 0 ? (
            <span className="num rounded-full bg-cyan px-1.5 py-0.5 text-[10px] font-extrabold text-deep">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      </div>
    </>
  );
}

function RailContent(props: ChatRailProps & { hubId: string }) {
  const { hubs, client, user, onRequireSignIn, showToast, hubId, skeleton } = props;
  const hub = hubs[hubId];
  const [channelId, setChannelId] = useState(hub.channels[0]?.id ?? '');
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const [leaders, setLeaders] = useState<LeaderboardRow[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChannelId(hub.channels[0]?.id ?? '');
  }, [hub]);

  useEffect(() => {
    if (!channelId) return;
    let cancelled = false;
    setMessages(null);
    void sync(async () => {
      const res = await client.chat(hubId, channelId);
      if (!cancelled) setMessages(res.messages ?? []);
      return res;
    }).then((res) => {
      if (!cancelled && res === null) setMessages([]);
    });
    return () => {
      cancelled = true;
    };
  }, [client, hubId, channelId]);

  useEffect(() => {
    void sync(async () => {
      const res = await client.leaderboard();
      setLeaders(res.leaderboard ?? []);
      return res;
    }).then((res) => {
      if (res === null) setLeaders([]);
    });
  }, [client]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const channel = hub.channels.find((c) => c.id === channelId) ?? hub.channels[0];

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!user) {
      onRequireSignIn();
      return;
    }
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      author: user.name,
      role: user.badge,
      avatar: user.avatar,
      timestamp: 'just now',
      text,
      optimistic: true,
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    setDraft('');
    void sync(
      async () => {
        const res = await client.sendChat(hubId, channelId, text);
        setMessages((prev) =>
          (prev ?? []).map((m) => (m.id === optimistic.id ? { ...m, ...(res.message ?? {}), optimistic: false } : m)),
        );
        return res;
      },
      (err) => {
        if (err.status === 400) {
          setMessages((prev) => (prev ?? []).filter((m) => m.id !== optimistic.id));
          showToast(err.message || 'That message was held by moderation.');
        }
      },
    );
  };

  if (skeleton) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-panel border border-line bg-midnight p-3">
          <div className="skeleton mb-3 h-4 w-32" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton mb-2 h-3.5" style={{ width: `${55 + (i % 3) * 15}%` }} />
          ))}
        </div>
        <div className="rounded-panel border border-line bg-midnight p-3">
          <div className="skeleton mb-3 h-4 w-40" />
          <div className="skeleton mb-2 h-3.5 w-3/4" />
          <div className="skeleton h-3.5 w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="flex min-h-0 flex-1 flex-col rounded-panel border border-line bg-midnight" aria-label="Community chat">
        <header className="border-b border-line px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-[13px] font-bold">{hub.name}</h2>
            {channel?.activeNow ? (
              <span className="num shrink-0 text-[11px] text-faint">{channel.activeNow} active</span>
            ) : null}
          </div>
          {hub.channels.length > 1 ? (
            <div className="mt-2 flex gap-1 overflow-x-auto" role="tablist" aria-label="Channels">
              {hub.channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={c.id === channelId}
                  onClick={() => setChannelId(c.id)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    c.id === channelId ? 'bg-obsidian text-cyan' : 'text-dim hover:text-ink'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        <div ref={listRef} className="min-h-40 flex-1 space-y-2.5 overflow-y-auto p-3">
          {messages === null ? (
            <>
              <div className="skeleton h-3.5 w-3/4" />
              <div className="skeleton h-3.5 w-1/2" />
              <div className="skeleton h-3.5 w-2/3" />
            </>
          ) : messages.length === 0 ? (
            <p className="pt-6 text-center text-xs text-faint">
              Nothing here yet. Say something and start the room.
            </p>
          ) : (
            messages.map((m) => (
              <div key={String(m.id)} className={`text-xs leading-relaxed ${m.optimistic ? 'opacity-60' : ''}`}>
                <span className="font-bold text-sky">{m.author}</span>
                {m.timestamp ? <span className="ml-1.5 text-[10px] text-faint">{m.timestamp}</span> : null}
                {m.flagged ? (
                  <span className="ml-1.5 rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold text-amber">
                    in review
                  </span>
                ) : null}
                <div className="text-dim">{m.text}</div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={send} className="flex items-center gap-2 border-t border-line p-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={user ? `Message ${channel?.name ?? hub.name}` : 'Sign in to chat'}
            aria-label={`Message ${channel?.name ?? hub.name}`}
            className="min-w-0 flex-1 rounded-control border border-line bg-base px-2.5 py-1.5 text-xs placeholder:text-faint focus:border-line-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            aria-label="Send message"
            className="grid h-8 w-8 place-items-center rounded-control bg-obsidian text-ink transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Send size={13} />
          </button>
        </form>
      </section>

      <section className="rounded-panel border border-line bg-midnight" aria-label="Gifting leaderboard">
        <header className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <Trophy size={14} className="text-cyan" />
          <h2 className="text-[13px] font-bold">Top gifters</h2>
        </header>
        <div className="p-3">
          {leaders === null ? (
            <div className="space-y-2">
              <div className="skeleton h-3.5 w-3/4" />
              <div className="skeleton h-3.5 w-2/3" />
            </div>
          ) : leaders.length === 0 ? (
            <p className="text-xs text-faint">
              No gifts yet this broadcast. The first one tops this list.
            </p>
          ) : (
            <ol className="space-y-2">
              {leaders.slice(0, 8).map((row, i) => (
                <li key={row.userId ?? row.name ?? i} className="flex items-center gap-2.5 text-xs">
                  <span className={`num w-4 text-right font-extrabold ${i === 0 ? 'text-cyan' : 'text-faint'}`}>
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{row.name ?? row.sender ?? 'Viewer'}</span>
                  <span className="num shrink-0 text-dim">{coins(row.coins ?? row.total ?? 0)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
