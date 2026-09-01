'use client';

// The right community rail: the join card for hubs the viewer has not joined,
// and the live chat room once they have. Messages are real — they come from
// and go to the API, and moderation can withdraw one after it posts.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCircle2, Lock, UserPlus, Users } from 'lucide-react';
import type { CommunityHub, Product, SessionUser } from '@/lib/types';
import { NeuTVClient, sync, type ChatMessage } from '@/lib/client';
import { brandTheme } from '@/lib/brand';

const DEFAULT_PERKS = [
  'Real-time verified creator signals & trade setups',
  'Instant access to community chat and discussions',
  'Send and receive live KashCoin gifts on broadcasts',
];

const COVER_BG: Record<string, string> = {
  worldstreet: 'bg-[#181408]',
  ark: 'bg-[#14081E]',
  market: 'bg-[#121214]',
  tsioncars: 'bg-[#1C080A]',
  linkpay: 'bg-[#081814]',
};

type ChatRailProps = {
  hubs: Record<string, CommunityHub>;
  products: Product[];
  activeProduct: string;
  client: NeuTVClient;
  user: SessionUser | null;
  onRequireSignIn: () => void;
  showToast: (msg: string) => void;
};

export function ChatRail({ hubs, products, activeProduct, client, user, onRequireSignIn, showToast }: ChatRailProps) {
  const hubId = useMemo(() => {
    if (hubs[activeProduct]) return activeProduct;
    return Object.keys(hubs)[0] ?? null;
  }, [hubs, activeProduct]);

  const [joined, setJoined] = useState<Record<string, boolean>>({});

  if (!hubId) return null;
  const hub = hubs[hubId];
  const product = products.find((p) => p.id === hubId);

  return (
    <aside className="w-80 md:w-96 h-screen flex-shrink-0 border-l border-white/10 hidden xl:flex flex-col bg-[#0A0A0C]/95 backdrop-blur-2xl z-40 sticky top-0 shadow-2xl overflow-hidden">
      {joined[hubId] ? (
        <ChatRoom
          key={hubId}
          hubId={hubId}
          hub={hub}
          client={client}
          user={user}
          onRequireSignIn={onRequireSignIn}
          showToast={showToast}
          onLeave={() => setJoined((m) => ({ ...m, [hubId]: false }))}
        />
      ) : (
        <JoinCard
          hubId={hubId}
          hub={hub}
          product={product}
          onJoin={() => setJoined((m) => ({ ...m, [hubId]: true }))}
        />
      )}
    </aside>
  );
}

function JoinCard({
  hubId,
  hub,
  product,
  onJoin,
}: {
  hubId: string;
  hub: CommunityHub;
  product?: Product;
  onJoin: () => void;
}) {
  const firstChannel = hub.channels[0];
  return (
    <div className={`flex-1 overflow-y-auto p-6 flex flex-col justify-between space-y-6 no-scrollbar ${COVER_BG[hubId] ?? 'bg-[#0A0A0C]'}`}>
      <div className="text-center space-y-3 pt-2">
        <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-white/20 flex items-center justify-center mx-auto p-2 overflow-hidden shadow-xl">
          {product?.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.logo} alt="" className="w-full h-full object-contain" />
          ) : (
            <span className="text-2xl font-black italic text-white">{(hub.name || 'NEU')[0]}</span>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="text-base md:text-lg font-black text-white tracking-tight">{hub.name} Hub</h2>
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/10 text-white font-extrabold border border-white/15">Official</span>
          </div>
          <p className="text-xs text-white/70 font-medium max-w-xs mx-auto leading-relaxed">
            {hub.tagline || 'The official community room for The New Economy.'}
          </p>
          <div className="text-[10px] text-white/70 font-semibold mt-1 flex items-center justify-center gap-2">
            <span className="flex items-center gap-1 text-white/80">
              <Users className="w-3 h-3 text-white" />
              {hub.memberCount || '40,000+ Members'}
            </span>
            <span className="text-white/30">•</span>
            <span className="flex items-center gap-1 text-white font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
              {firstChannel?.activeNow || 100}+ online
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-2xl bg-[#141418]/60 border border-white/10 space-y-2.5 shadow-inner">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/40 flex items-center justify-between">
          <span>Community Channels</span>
          <span className="text-[9px] text-amber-400 font-bold flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Locked (Join to Chat)
          </span>
        </div>
        {hub.channels.map((chan) => (
          <div key={chan.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-white/[0.04] border border-white/5">
            <span className="flex items-center gap-2 text-white/80 font-semibold">
              <Lock className="w-3 h-3 text-white/40" />
              <span className="text-white/40">#</span>
              <span>{chan.name.replace('#', '')}</span>
            </span>
            <span className="text-[10px] text-white font-medium num">{chan.activeNow || 0} active</span>
          </div>
        ))}
      </div>

      <div className="space-y-2 px-1">
        <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/40">Member Benefits</div>
        {(hub.perks?.length ? hub.perks : DEFAULT_PERKS).map((perk) => (
          <div key={perk} className="flex items-start gap-2 text-xs text-white/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-white flex-shrink-0 mt-0.5" />
            <span className="leading-snug">{perk}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2.5 pt-2">
        <button
          type="button"
          onClick={onJoin}
          className="w-full py-3.5 rounded-2xl bg-white hover:bg-neutral-200 text-black font-black text-xs transition shadow-2xl flex items-center justify-center gap-2 transform active:scale-95"
        >
          <UserPlus className="w-4 h-4" />
          Join {hub.name} Community
        </button>
        {hub.officialUrl ? (
          <a
            href={hub.officialUrl}
            target="_blank"
            rel="noreferrer"
            className="w-full py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
          >
            Learn More on {hub.name} Site ↗
          </a>
        ) : null}
      </div>
    </div>
  );
}

function ChatRoom({
  hubId,
  hub,
  client,
  user,
  onRequireSignIn,
  showToast,
  onLeave,
}: {
  hubId: string;
  hub: CommunityHub;
  client: NeuTVClient;
  user: SessionUser | null;
  onRequireSignIn: () => void;
  showToast: (msg: string) => void;
  onLeave: () => void;
}) {
  const [channelId, setChannelId] = useState(hub.channels[0]?.id ?? '');
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const channel = hub.channels.find((c) => c.id === channelId) ?? hub.channels[0];
  const channelName = channel?.name.replace('#', '') ?? hub.name;

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
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const shown: ChatMessage[] =
    messages && messages.length > 0
      ? messages
      : messages
        ? [
            {
              id: 'welcome',
              author: hub.admins?.[0]?.name ?? 'Admin',
              role: 'Admin',
              timestamp: '',
              text: `Welcome to #${channelName}! Join the conversation.`,
            },
          ]
        : [];

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
      timestamp: 'Just now',
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
          showToast(err.message || 'That message was blocked by moderation.');
        }
      },
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3.5 border-b border-white/10 bg-neutral-900/60 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-white/40 text-base font-normal">#</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm truncate">{channelName}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" aria-hidden />
            </div>
            <p className="text-[10px] text-white/50 truncate">
              {hub.name} Community • {channel?.activeNow || 0} online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onLeave}
            title="Leave this community"
            className="px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-rose-500/20 hover:text-rose-400 text-[10px] font-bold border border-emerald-500/30 transition flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            Joined
          </button>
          {hub.officialUrl ? (
            <a
              href={hub.officialUrl}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold border border-white/15 transition flex items-center gap-1"
            >
              Site ↗
            </a>
          ) : null}
        </div>
      </div>

      {hub.channels.length > 1 ? (
        <div className="px-4 py-2 border-b border-white/[0.08] bg-black/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0" role="tablist">
          {hub.channels.map((c) => {
            const active = c.id === channelId;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setChannelId(c.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                  active ? 'bg-white/20 text-white font-bold border border-white/20' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <span className="text-white/40 font-normal">#</span>
                {c.name.replace('#', '')}
                <span className={`text-[9px] num ${active ? 'text-emerald-400 font-bold' : 'text-white/30'}`}>
                  {c.activeNow || 0}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="flex-1 flex flex-col overflow-hidden bg-neutral-950/60">
        {channel?.topic ? (
          <div className="px-4 py-2 border-b border-white/[0.06] bg-neutral-900/30 flex-shrink-0 flex items-center justify-between text-[11px]">
            <p className="text-white/50 truncate flex-1">Topic: {channel.topic}</p>
            <span className="text-white/30 text-[10px] ml-2 flex-shrink-0 num">{channel.activeNow || 0} online</span>
          </div>
        ) : null}

        <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {messages === null ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-2/3" />
            </div>
          ) : (
            shown.map((m) => (
              <div key={String(m.id)} className={`flex gap-3 items-start group hover:bg-white/[0.03] -mx-2 px-2 py-1.5 rounded-xl transition ${m.optimistic ? 'opacity-60' : ''}`}>
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white/20 flex-shrink-0 mt-0.5 shadow-sm" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-black text-white flex-shrink-0 mt-0.5">
                    {m.author.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 text-[11px]">
                    <span className="font-bold text-white">{m.author}</span>
                    {m.role ? (
                      <span className="px-1.5 py-px rounded bg-white/10 text-emerald-400 font-semibold text-[9px]">{m.role}</span>
                    ) : null}
                    {m.flagged ? (
                      <span className="px-1.5 py-px rounded bg-amber-400/15 text-amber-400 font-semibold text-[9px]">in review</span>
                    ) : null}
                    {m.timestamp ? <span className="text-white/30 ml-auto text-[10px]">{m.timestamp}</span> : null}
                  </div>
                  <div className="p-2.5 rounded-2xl bg-white/[0.06] text-neutral-100 border border-white/10 text-[11px] leading-relaxed break-words">
                    {m.text}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={send} className="p-3 border-t border-white/10 flex-shrink-0 bg-neutral-900/50">
          <div className="flex items-center gap-2 bg-white/5 border border-white/15 rounded-2xl px-4 py-2.5 shadow-inner">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={user ? `Message #${channelName}...` : 'Sign in to chat in community...'}
              aria-label={`Message #${channelName}`}
              className="flex-1 bg-transparent text-xs text-white placeholder-white/40 outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-3 py-1 rounded-xl bg-white hover:bg-white/90 text-black font-extrabold text-xs transition shadow-md disabled:opacity-60"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
