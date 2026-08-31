'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppData, Gift, LiveComment, LiveEvent, SessionUser, StageCard } from '@/lib/types';
import { NeuTVClient, sync } from '@/lib/client';
import { Rail } from './rail';
import { TopBar } from './top-bar';
import { Stage } from './stage';
import { Reel } from './reel';
import { Feed } from './feed';
import { ChatRail } from './chat-rail';
import { GiftPalette } from './gift-palette';
import { Gate } from './gate';

const EMOJIS = ['❤️', '🔥', '👏', '🎉', '🚀', '⭐', '💖', '💎'];

type Particle = { id: number; emoji: string; right: number };
type GiftBanner = { sender: string; giftName: string; cost: number };

function toStageCard(raw: Record<string, unknown> | undefined | null, fallback?: StageCard): StageCard | null {
  if (!raw) return null;
  const r = raw as Record<string, any>;
  return {
    id: r.id,
    title: r.videoTitle || r.title || r.content || fallback?.title || 'Broadcast',
    description: r.content || r.description || '',
    youtubeId: r.youtubeId ?? null,
    videoUrl: r.videoMp4 || r.videoUrl || r.playbackUrl || null,
    posterUrl: r.mediaUrl || r.thumbnail || r.posterUrl || null,
    productId: r.productId ?? fallback?.productId,
    viewers: r.viewers ?? fallback?.viewers,
    likes: r.likes ?? fallback?.likes,
  };
}

function eventToCard(event: LiveEvent, client: NeuTVClient): StageCard {
  return {
    id: event.id,
    title: event.title,
    description: event.description ?? '',
    youtubeId: event.youtubeId ?? null,
    videoUrl: client.absoluteMedia(event.playbackUrl) ?? null,
    posterUrl: event.posterUrl ?? null,
    productId: event.productId,
    isLiveEvent: true,
    isSegmented: event.source === 'browser',
  };
}

export function App({ data }: { data: AppData }) {
  const { bootstrap, libraryPosts, apiBase, now } = data;
  const client = useMemo(() => new NeuTVClient(apiBase), [apiBase]);

  const seedCard: StageCard = useMemo(
    () => ({
      id: bootstrap.INITIAL_CENTRAL_TV?.id,
      title: bootstrap.INITIAL_CENTRAL_TV?.title ?? 'Central Stream',
      description: bootstrap.INITIAL_CENTRAL_TV?.description,
      youtubeId: bootstrap.INITIAL_CENTRAL_TV?.youtubeId ?? null,
      videoUrl: bootstrap.INITIAL_CENTRAL_TV?.videoUrl ?? null,
      posterUrl: bootstrap.INITIAL_CENTRAL_TV?.posterUrl ?? null,
      productId: bootstrap.INITIAL_CENTRAL_TV?.productId,
      viewers: bootstrap.INITIAL_CENTRAL_TV?.viewers,
      likes: bootstrap.INITIAL_CENTRAL_TV?.likes,
    }),
    [bootstrap],
  );

  // The stage is server-owned: these three decide what renders, and the server
  // is re-read on mount so a reload mid-takeover recovers.
  const [mainBroadcast, setMainBroadcast] = useState<StageCard>(seedCard);
  const [liveEvent, setLiveEvent] = useState<StageCard | null>(null);
  const [override, setOverride] = useState<StageCard | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [balance, setBalance] = useState(0);
  const [gateOpen, setGateOpen] = useState(false);

  const [viewers, setViewers] = useState<number | null>(seedCard.viewers ?? null);
  const [tvLikes, setTvLikes] = useState<number>(seedCard.likes ?? 0);
  const [tvLiked, setTvLiked] = useState(false);

  const [ticker, setTicker] = useState<LiveComment[]>([]);
  const [giftBanner, setGiftBanner] = useState<GiftBanner | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [giftsOpen, setGiftsOpen] = useState(false);

  const [activeProduct, setActiveProduct] = useState('all');
  const [search, setSearch] = useState('');
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const [skeletonPreview, setSkeletonPreview] = useState(false);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // SSE handlers read current state through this ref, so a frame that arrives
  // an hour in still sees today's mainBroadcast — the CDN app got this wrong.
  const stateRef = useRef({ mainBroadcast, override, user });
  useEffect(() => {
    stateRef.current = { mainBroadcast, override, user };
  }, [mainBroadcast, override, user]);

  const spawnParticle = useCallback((emoji?: string) => {
    const id = Date.now() + Math.random();
    setParticles((prev) => [
      ...prev.slice(-14),
      { id, emoji: emoji ?? EMOJIS[Math.floor(Math.random() * EMOJIS.length)], right: 24 + Math.random() * 50 },
    ]);
    setTimeout(() => setParticles((prev) => prev.filter((p) => p.id !== id)), 1300);
  }, []);

  const applyLiveEvent = useCallback(
    (event: LiveEvent) => {
      setLiveError(null);
      setLiveEvent(eventToCard(event, client));
    },
    [client],
  );

  // Mount: adopt the server's stage, restore the session, start presence and
  // the event stream.
  useEffect(() => {
    let cancelled = false;

    void sync(async () => {
      const res = await client.liveState();
      if (cancelled) return null;
      const main = toStageCard(res.stage.mainBroadcast ?? res.stage.revertsTo, seedCard);
      if (main) {
        if (res.telemetry?.baselineViewers) main.viewers = res.telemetry.baselineViewers;
        setMainBroadcast(main);
        setViewers(main.viewers ?? null);
      }
      if (res.stage.isOverride && res.stage.current) {
        const card = toStageCard(res.stage.current, main ?? seedCard);
        if (card) setOverride({ ...card, isTakeover: true });
      }
      if (res.likes) {
        setTvLikes(res.likes.seeded + res.likes.total);
        setTvLiked(res.likes.liked);
      }
      return res;
    });

    void sync(async () => {
      const res = await client.liveEvent();
      if (!cancelled && res.event?.isLive) applyLiveEvent(res.event);
      return res;
    });

    if (client.isSignedIn()) {
      void sync(async () => {
        const [{ user: me }, wallet] = await Promise.all([client.me(), client.balance()]);
        if (!cancelled) {
          setUser(me);
          setBalance(wallet.balance);
        }
        return me;
      });
    }

    void sync(async () => {
      const res = await client.gifts();
      if (!cancelled) setGifts(res.gifts ?? []);
      return res;
    });

    const stopPresence = client.startPresence();

    const stopStream = client.subscribe({
      'live-event': (payload: { status: string; event?: LiveEvent }) => {
        if (payload.status === 'started' && payload.event) {
          applyLiveEvent(payload.event);
          showToast(`${payload.event.title} is live`);
        } else if (payload.status === 'ended') {
          setLiveEvent(null);
          setLiveError(null);
          setOverride(null);
          showToast('The live broadcast has ended');
        }
      },
      comment: (payload: { comment?: LiveComment } & LiveComment) => {
        const comment = payload.comment ?? payload;
        if (!comment?.text) return;
        setTicker((prev) => [{ ...comment, id: `${comment.id}-${Date.now()}` }, ...prev].slice(0, 3));
      },
      gift: (payload: { sender?: string; giftName?: string; name?: string; cost?: number }) => {
        // Someone else's gift landing on the broadcast, live.
        if (stateRef.current.user && payload.sender === stateRef.current.user.name) return;
        setGiftBanner({
          sender: payload.sender ?? 'A viewer',
          giftName: payload.giftName ?? payload.name ?? 'a gift',
          cost: payload.cost ?? 0,
        });
        setTimeout(() => setGiftBanner(null), 3500);
      },
      reaction: (payload: { emoji?: string }) => {
        spawnParticle(payload.emoji);
      },
      telemetry: (payload: { viewers?: number; baselineViewers?: number }) => {
        const count = payload.viewers ?? payload.baselineViewers;
        if (typeof count === 'number') setViewers(count);
      },
      stage: (payload: { mainBroadcast?: Record<string, unknown> }) => {
        // An operator promoted a different broadcast for everyone.
        const card = toStageCard(payload.mainBroadcast, stateRef.current.mainBroadcast);
        if (card) setMainBroadcast(card);
      },
      chat: () => {
        setChatUnread((n) => n + 1);
      },
    });

    return () => {
      cancelled = true;
      stopPresence();
      stopStream();
    };
  }, [client, seedCard, applyLiveEvent, showToast, spawnParticle]);

  // --- stage actions -------------------------------------------------------

  const takeStage = useCallback(
    (raw: Record<string, unknown>) => {
      const card = toStageCard(raw, stateRef.current.mainBroadcast);
      if (!card?.videoUrl && !card?.youtubeId) return;
      setOverride({ ...card, isTakeover: true });
      setMuted(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (card.id) void sync(() => client.takeStage(card.id!));
    },
    [client],
  );

  const revertStage = useCallback(
    (announce: boolean) => {
      setOverride(null);
      if (announce) showToast('Back to the live broadcast');
      void sync(() => client.revertStage());
    },
    [client, showToast],
  );

  const likeTv = useCallback(() => {
    setTvLiked((liked) => {
      setTvLikes((n) => n + (liked ? -1 : 1));
      return !liked;
    });
    spawnParticle('❤️');
    void sync(async () => {
      const res = await client.likeTv();
      if (typeof res.total === 'number') setTvLikes(res.total);
      if (typeof res.liked === 'boolean') setTvLiked(res.liked);
      return res;
    });
  }, [client, spawnParticle]);

  const sendReaction = useCallback(
    (emoji: string) => {
      spawnParticle(emoji);
      void sync(() => client.react(emoji));
    },
    [client, spawnParticle],
  );

  const sendLiveComment = useCallback(
    (text: string) => {
      const me = stateRef.current.user;
      if (!me) {
        setGateOpen(true);
        return;
      }
      const optimistic: LiveComment = {
        id: `local-${Date.now()}`,
        author: me.name,
        avatar: me.avatar,
        badge: me.badge,
        text,
        optimistic: true,
      };
      setTicker((prev) => [optimistic, ...prev].slice(0, 3));
      void sync(
        () => client.liveComment(text),
        (err) => {
          if (err.status === 400) {
            setTicker((prev) => prev.filter((c) => c.id !== optimistic.id));
            showToast(err.message || 'That message was held by moderation.');
          }
        },
      );
    },
    [client, showToast],
  );

  const sendGift = useCallback(
    (gift: Gift) => {
      const me = stateRef.current.user;
      if (!me) {
        setGateOpen(true);
        return false;
      }
      // The palette itself renders the insufficient-funds state; this is the
      // server-authoritative path for a gift that should go through.
      setBalance((b) => b - gift.cost);
      setGiftBanner({ sender: me.name, giftName: gift.name, cost: gift.cost });
      setTimeout(() => setGiftBanner(null), 3500);
      for (let i = 0; i < 8; i++) setTimeout(() => spawnParticle(gift.emoji), i * 100);
      showToast(`Sent ${gift.name}`);
      void sync(
        async () => {
          const res = await client.tip(gift.id, {
            type: 'stream',
            id: stateRef.current.mainBroadcast.id ?? 'main',
          });
          setBalance(res.balance);
          return res;
        },
        (err) => {
          setBalance((b) => b + gift.cost);
          setGiftBanner(null);
          showToast(err.message || 'That gift did not go through.');
        },
      );
      return true;
    },
    [client, showToast, spawnParticle],
  );

  const signOut = useCallback(() => {
    void client.logout();
    setUser(null);
    setBalance(0);
    showToast('Signed out');
  }, [client, showToast]);

  const onSignedIn = useCallback(
    (me: SessionUser) => {
      setUser(me);
      setGateOpen(false);
      showToast(`Signed in as ${me.name}`);
      void sync(async () => {
        const res = await client.balance();
        setBalance(res.balance);
        return res;
      });
    },
    [client, showToast],
  );

  const stageCard = override ?? liveEvent ?? mainBroadcast;

  return (
    <div className="flex min-h-dvh bg-base">
      <Rail
        products={bootstrap.PRODUCTS ?? []}
        hubs={bootstrap.PRODUCT_COMMUNITY_HUBS ?? {}}
        activeProduct={activeProduct}
        onSelectProduct={setActiveProduct}
        collapsed={railCollapsed}
        onToggleCollapsed={() => setRailCollapsed((c) => !c)}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
        skeletonPreview={skeletonPreview}
        onToggleSkeletons={() => setSkeletonPreview((s) => !s)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          search={search}
          onSearch={setSearch}
          viewers={viewers}
          liveNow={Boolean(liveEvent)}
          balance={balance}
          user={user}
          onOpenGate={() => setGateOpen(true)}
          onSignOut={signOut}
          onOpenDrawer={() => setDrawerOpen(true)}
          onOpenGifts={() => setGiftsOpen(true)}
        />

        <div className="mx-auto flex w-full max-w-[1440px] min-w-0 flex-1 items-start gap-6 px-4 py-5 md:px-6">
          <main className="min-w-0 flex-1">
            <div className="settle">
              <Stage
                card={stageCard}
                isLiveEvent={Boolean(liveEvent) && !override}
                isTakeover={Boolean(override)}
                muted={muted}
                onToggleMuted={() => setMuted((m) => !m)}
                onRevert={() => revertStage(true)}
                onEnded={() => revertStage(false)}
                liveError={liveError}
                onLiveError={setLiveError}
                apiBase={apiBase}
                viewers={viewers}
                likes={tvLikes}
                liked={tvLiked}
                onLike={likeTv}
                onReact={sendReaction}
                onOpenGifts={() => setGiftsOpen(true)}
                onSendComment={sendLiveComment}
                ticker={ticker}
                giftBanner={giftBanner}
                particles={particles}
                signedIn={Boolean(user)}
                skeleton={skeletonPreview}
              />
            </div>

            <div className="settle-late">
              <Reel spotlights={bootstrap.CREATOR_SPOTLIGHTS ?? []} onPromote={takeStage} skeleton={skeletonPreview} />

              <Feed
                posts={[...libraryPosts, ...(bootstrap.INITIAL_POSTS ?? [])]}
                products={bootstrap.PRODUCTS ?? []}
                activeProduct={activeProduct}
                onSelectProduct={setActiveProduct}
                search={search}
                now={now}
                client={client}
                signedIn={Boolean(user)}
                onRequireSignIn={() => setGateOpen(true)}
                onPromote={takeStage}
                onOpenGifts={() => setGiftsOpen(true)}
                showToast={showToast}
                skeleton={skeletonPreview}
              />
            </div>
          </main>

          <ChatRail
            hubs={bootstrap.PRODUCT_COMMUNITY_HUBS ?? {}}
            products={bootstrap.PRODUCTS ?? []}
            activeProduct={activeProduct}
            client={client}
            user={user}
            onRequireSignIn={() => setGateOpen(true)}
            showToast={showToast}
            sheetOpen={chatOpen}
            onToggleSheet={() => {
              setChatOpen((open) => !open);
              setChatUnread(0);
            }}
            unread={chatUnread}
            skeleton={skeletonPreview}
          />
        </div>
      </div>

      {giftsOpen ? (
        <GiftPalette
          gifts={gifts}
          balance={balance}
          signedIn={Boolean(user)}
          onClose={() => setGiftsOpen(false)}
          onSend={(gift) => {
            if (sendGift(gift)) setGiftsOpen(false);
          }}
          onRequireSignIn={() => {
            setGiftsOpen(false);
            setGateOpen(true);
          }}
          products={bootstrap.PRODUCTS ?? []}
        />
      ) : null}

      {gateOpen ? (
        <Gate products={bootstrap.PRODUCTS ?? []} client={client} onClose={() => setGateOpen(false)} onSignedIn={onSignedIn} />
      ) : null}

      {toast ? (
        <output
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-control border border-line bg-obsidian px-4 py-2.5 text-sm font-semibold shadow-overlay"
          aria-live="polite"
        >
          {toast}
        </output>
      ) : null}
    </div>
  );
}
