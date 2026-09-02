'use client';

// The NEU Network shell: splash → auth gate → the three-column app. Layout and
// behaviour follow the original Central Stream frontend; underneath, the
// stage is server-owned, the SSE stream drives the live surfaces, and every
// optimistic action reconciles against the API.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { AppData, Gift, LiveComment, LiveEvent, Post, SessionUser, Spotlight, StageCard } from '@/lib/types';
import { NeuTVClient, sync } from '@/lib/client';
import { Rail, type MainTab } from './rail';
import { TopBar } from './top-bar';
import { Stage } from './stage';
import { Reel } from './reel';
import { Feed } from './feed';
import { ChatRail } from './chat-rail';
import { GiftPalette } from './gift-palette';
import { Gate } from './gate';
import { Celebration } from './celebration';
import { Splash } from './splash';
import { VideoModal, type ModalVideo } from './video-modal';

// How many floating comments sit over the stage at once. Two is enough to show
// the room is live without covering the video, which is the subject.
const TICKER_LIMIT = 2;

/**
 * Which player a live event needs.
 *
 * This used to be `source === 'browser'`, which read "the operator is
 * broadcasting from a browser" and meant "the video arrives as HTTP segments".
 * Those were the same thing until WHIP, which sends a browser broadcast over
 * WebRTC and plays it back as HLS. Viewers kept being sent to the segment
 * player for a broadcast that had no segments, and every one of them got
 * "No segment 0 for that broadcast".
 *
 * The server now reports the transport the studio actually used. `transport`
 * is absent only on events that went on air before it existed, so those fall
 * back to the old reading - but prefer HLS when there is a manifest to play.
 */
function isSegmentedEvent(event: { transport?: string | null; source?: string; playbackUrl?: string | null }) {
  if (event.transport) return event.transport === 'segments';
  return event.source === 'browser' && !(event.playbackUrl ?? '').includes('.m3u8');
}

type Heart = { id: number; emoji: string; right: number };
type GiftBanner = { sender: string; giftName: string; cost: number; emoji?: string };

function toStageCard(raw: Record<string, unknown> | undefined | null, fallback?: StageCard): StageCard | null {
  if (!raw) return null;
  const r = raw as Record<string, any>;
  return {
    id: r.id,
    title: r.videoTitle || r.title || r.content || fallback?.title || 'Broadcast',
    description: r.content || r.description || '',
    youtubeId: r.youtubeId ?? (typeof r.videoUrl === 'string' && !r.videoUrl.includes('/') ? r.videoUrl : null),
    videoUrl: r.videoMp4 || (typeof r.videoUrl === 'string' && r.videoUrl.includes('/') ? r.videoUrl : null) || r.playbackUrl || null,
    posterUrl: r.mediaUrl || r.thumbnail || r.posterUrl || null,
    productId: r.productId ?? fallback?.productId,
    viewers: r.viewers ?? fallback?.viewers,
    likes: r.likes ?? fallback?.likes,
  };
}

export function App({ data }: { data: AppData }) {
  const { bootstrap, libraryPosts, creatorSpotlights, apiBase, now } = data;
  // Real creator channels lead the rail; the seeded editorial cards follow.
  const [creatorSpots, setCreatorSpots] = useState<Spotlight[]>(creatorSpotlights ?? []);
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

  // Splash, then (for signed-out visitors) the gate.
  const [splash, setSplash] = useState(true);
  const [authResolved, setAuthResolved] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [celebration, setCelebration] = useState<{ name: string; badge?: string } | null>(null);

  // The stage is server-owned: these three decide what renders, and the
  // server is re-read on mount so a reload mid-takeover recovers.
  const [mainBroadcast, setMainBroadcast] = useState<StageCard>(seedCard);
  const [liveEvent, setLiveEvent] = useState<StageCard | null>(null);
  const [override, setOverride] = useState<StageCard | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  const [user, setUser] = useState<SessionUser | null>(null);
  const [balance, setBalance] = useState(0);

  const [viewers, setViewers] = useState<number | null>(seedCard.viewers ?? null);
  const [tvLikes, setTvLikes] = useState<number>(seedCard.likes ?? 0);
  const [tvLiked, setTvLiked] = useState(false);

  const [ticker, setTicker] = useState<LiveComment[]>([]);
  const [giftBanner, setGiftBanner] = useState<GiftBanner | null>(null);
  const [hearts, setHearts] = useState<Heart[]>([]);
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<ModalVideo | null>(null);

  const [activeTab, setActiveTab] = useState<MainTab>('tv');
  const [activeProduct, setActiveProduct] = useState('all');
  const [search, setSearch] = useState('');

  // Theater mode: the player takes the room and both rails fold away. The
  // sidebar keeps its own toggle, so it can be expanded again even mid-theater.
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [theater, setTheater] = useState(false);
  const railBeforeTheater = useRef(false);
  const toggleTheater = useCallback(() => {
    setTheater((was) => {
      if (!was) {
        railBeforeTheater.current = railCollapsed;
        setRailCollapsed(true);
      } else {
        setRailCollapsed(railBeforeTheater.current);
      }
      return !was;
    });
  }, [railCollapsed]);

  // Leaving the TV tab leaves theater too — otherwise the chat rail would
  // stay hidden with its only way back off-screen.
  const selectTab = useCallback(
    (tab: MainTab) => {
      setActiveTab(tab);
      if (tab !== 'tv') {
        setTheater((was) => {
          if (was) setRailCollapsed(railBeforeTheater.current);
          return false;
        });
      }
    },
    [],
  );

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // SSE handlers read current state through this ref, so a frame arriving an
  // hour in never closes over stale state.
  const stateRef = useRef({ mainBroadcast, override, user });
  useEffect(() => {
    stateRef.current = { mainBroadcast, override, user };
  }, [mainBroadcast, override, user]);

  // Without an explicit emoji this floats a KashCoin — the platform's own
  // token carries the ambient atmosphere; emoji are reserved for deliberate
  // reactions and gifts.
  const spawnHeart = useCallback((emoji?: string) => {
    const id = Date.now() + Math.random();
    setHearts((prev) => [...prev.slice(-14), { id, emoji: emoji ?? '', right: 30 + Math.random() * 50 }]);
    setTimeout(() => setHearts((prev) => prev.filter((p) => p.id !== id)), 2200);
  }, []);

  const applyLiveEvent = useCallback(
    (event: LiveEvent) => {
      setLiveError(null);
      setLiveEvent({
        id: event.id,
        title: event.title,
        description: event.description ?? '',
        youtubeId: event.youtubeId ?? null,
        videoUrl: client.absoluteMedia(event.playbackUrl) ?? null,
        posterUrl: event.posterUrl ?? null,
        productId: event.productId,
        isLiveEvent: true,
        isSegmented: isSegmentedEvent(event),
      });
    },
    [client],
  );

  // Splash dismisses itself.
  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 2500);
    return () => clearTimeout(timer);
  }, []);

  // Ambient hearts drift over the stage, as they always have.
  useEffect(() => {
    const timer = setInterval(() => spawnHeart(), 1400);
    return () => clearInterval(timer);
  }, [spawnHeart]);

  // The ticker carries what people have actually said, and nothing else.
  //
  // It used to rotate through SAMPLE_LIVE_COMMENTS on a timer, injecting an
  // invented message every 3.5 seconds under a real person's name and photo.
  // On a broadcast nobody is talking in, the honest overlay is an empty one.
  useEffect(() => {
    let cancelled = false;
    client.liveComments(TICKER_LIMIT)
      .then((res) => {
        if (!cancelled && res?.comments?.length) setTicker(res.comments.slice(0, TICKER_LIMIT));
      })
      .catch(() => { /* the stream fills it in as people speak */ });
    return () => { cancelled = true; };
  }, [client]);

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
      }).finally(() => {
        if (!cancelled) setAuthResolved(true);
      });
    } else {
      setAuthResolved(true);
    }

    void sync(async () => {
      const res = await client.gifts();
      if (!cancelled) setGifts(res.gifts ?? []);
      return res;
    });

    const stopPresence = client.startPresence();

    const stopStream = client.subscribe({
      'creator-live': (payload: { status: string; event?: { title?: string } }) => {
        // A creator going on or off air redraws their spotlight card - and
        // nothing else. The main stage is not involved by design.
        if (payload.status === 'started' && payload.event?.title) {
          showToast(`🔴 ${payload.event.title} is live in the spotlight`);
        }
        void sync(async () => {
          const res = await client.creatorSpotlights();
          setCreatorSpots(res.spotlights ?? []);
          return res;
        });
      },
      'live-event': (payload: { status: string; event?: LiveEvent }) => {
        if (payload.status === 'started' && payload.event) {
          applyLiveEvent(payload.event);
          showToast(`🔴 ${payload.event.title} is live`);
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
        setTicker((prev) => [{ ...comment, id: `${comment.id}-${Date.now()}` }, ...prev].slice(0, TICKER_LIMIT));
      },
      gift: (payload: { sender?: string; giftName?: string; name?: string; cost?: number; emoji?: string }) => {
        if (stateRef.current.user && payload.sender === stateRef.current.user.name) return;
        setGiftBanner({
          sender: payload.sender ?? 'A viewer',
          giftName: payload.giftName ?? payload.name ?? 'a gift',
          cost: payload.cost ?? 0,
          emoji: payload.emoji,
        });
        setTimeout(() => setGiftBanner(null), 3500);
      },
      reaction: (payload: { emoji?: string }) => spawnHeart(payload.emoji),
      telemetry: (payload: { viewers?: number; baselineViewers?: number }) => {
        const count = payload.viewers ?? payload.baselineViewers;
        if (typeof count === 'number') setViewers(count);
      },
      stage: (payload: { mainBroadcast?: Record<string, unknown> }) => {
        const card = toStageCard(payload.mainBroadcast, stateRef.current.mainBroadcast);
        if (card) setMainBroadcast(card);
      },
    });

    return () => {
      cancelled = true;
      stopPresence();
      stopStream();
    };
  }, [client, seedCard, applyLiveEvent, showToast, spawnHeart]);

  // --- stage actions -------------------------------------------------------

  const takeStage = useCallback(
    (raw: Record<string, unknown>) => {
      const card = toStageCard(raw, stateRef.current.mainBroadcast);
      if (!card) return;
      if (raw.creatorHandle) card.creatorHandle = String(raw.creatorHandle);
      if (raw.isSegmented) card.isSegmented = true;
      if (!card.videoUrl && !card.youtubeId && !card.isSegmented) return;
      setOverride({ ...card, isTakeover: true });
      setMuted(false);
      setActiveTab('tv');
      showToast('Now playing on the main stage 📺');
      // A creator live session is played directly - the server stage machine
      // only resolves videos, so there is nothing to tell it.
      if (card.id && !raw.localOnly) void sync(() => client.takeStage(card.id!));
    },
    [client, showToast],
  );

  const revertStage = useCallback(
    (announce: boolean) => {
      setOverride(null);
      if (announce) showToast('Back to the live broadcast 📡');
      void sync(() => client.revertStage());
    },
    [client, showToast],
  );

  const likeTv = useCallback(() => {
    setTvLiked((wasLiked) => {
      setTvLikes((n) => Math.max(0, n + (wasLiked ? -1 : 1)));
      return !wasLiked;
    });
    spawnHeart('❤️');
    void sync(async () => {
      const res = await client.likeTv();
      if (typeof res.total === 'number') setTvLikes(res.total);
      if (typeof res.liked === 'boolean') setTvLiked(res.liked);
      return res;
    });
  }, [client, spawnHeart]);

  const sendReaction = useCallback(
    (emoji: string) => {
      spawnHeart(emoji);
      void sync(() => client.react(emoji));
    },
    [client, spawnHeart],
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
            showToast(err.message || 'That message was blocked by moderation.');
          }
        },
      );
    },
    [client, showToast],
  );

  const openGifts = useCallback(() => {
    if (!stateRef.current.user) {
      setGateOpen(true);
      return;
    }
    setGiftsOpen(true);
  }, []);

  const sendGift = useCallback(
    (gift: Gift) => {
      const me = stateRef.current.user;
      if (!me) {
        setGiftsOpen(false);
        setGateOpen(true);
        return;
      }
      if (balance < gift.cost) {
        showToast(`Insufficient balance! You need ${gift.cost.toLocaleString()} Coins for ${gift.name}.`);
        return;
      }
      setBalance((b) => b - gift.cost);
      setGiftBanner({ sender: me.name, giftName: gift.name, cost: gift.cost, emoji: gift.emoji });
      setTimeout(() => setGiftBanner(null), 3500);
      for (let i = 0; i < 10; i++) setTimeout(() => spawnHeart(gift.emoji), i * 100);
      setGiftsOpen(false);
      showToast(`Sent ${gift.name} ${gift.emoji || '🎁'}! 🎉`);
      // Watching creator content, the gift targets the creator - that is what
      // routes their 70% share through the ledger. Otherwise it lands on the
      // broadcast stream as before.
      const watching = stateRef.current.override;
      const target = watching?.creatorHandle
        ? { type: 'creator', id: watching.creatorHandle }
        : { type: 'stream', id: stateRef.current.mainBroadcast.id ?? 'main' };
      void sync(
        async () => {
          const res = await client.tip(gift.id, target);
          setBalance(res.balance);
          return res;
        },
        (err) => {
          setBalance((b) => b + gift.cost);
          setGiftBanner(null);
          showToast(err.message || 'That gift did not go through.');
        },
      );
    },
    [balance, client, showToast, spawnHeart],
  );

  const signOut = useCallback(() => {
    void client.logout();
    setUser(null);
    setBalance(0);
    setIsGuest(true);
  }, [client]);

  const onSignedIn = useCallback(
    (me: SessionUser, _platformName: string) => {
      setUser(me);
      setGateOpen(false);
      setIsGuest(false);
      setCelebration({ name: me.name, badge: me.badge });
      void sync(async () => {
        const res = await client.balance();
        setBalance(res.balance);
        return res;
      });
    },
    [client],
  );

  const openPost = useCallback((post: Post) => {
    setSelectedVideo({
      id: post.id,
      title: post.videoTitle || post.content || 'Broadcast',
      description: post.content,
      youtubeId: post.youtubeId ?? null,
      videoUrl: post.videoMp4 ?? null,
      thumbnail: post.mediaUrl ?? null,
      productName: post.productName,
      views: post.views,
      raw: { ...post },
    });
  }, []);

  const openSpotlight = useCallback((cr: Spotlight) => {
    // A live creator channel goes straight to the stage: the broadcast is the
    // point, and a modal in front of it would only be in the way.
    if (cr.isLive && cr.liveEventId) {
      takeStage({
        id: cr.liveEventId,
        title: cr.title,
        videoUrl: cr.livePlaybackUrl ?? null,
        isSegmented: cr.liveTransport !== 'whip' && !cr.livePlaybackUrl?.includes('.m3u8'),
        posterUrl: cr.thumbnail ?? null,
        productId: cr.productId,
        creatorHandle: cr.handle,
        localOnly: true,
      });
      return;
    }
    setSelectedVideo({
      id: cr.id,
      title: cr.title,
      description: `${cr.name} (${cr.handle ?? ''}) — ${cr.tag ?? 'Creator Spotlight'}`,
      youtubeId: cr.videoMp4 ? null : (cr.videoUrl ?? null),
      videoUrl: cr.videoMp4 ?? null,
      thumbnail: cr.thumbnail ?? null,
      productName: cr.product,
      views: cr.views,
      creator: cr.name,
      raw: {
        ...cr,
        youtubeId: cr.videoMp4 ? null : cr.videoUrl,
        videoMp4: cr.videoMp4,
        ...(cr.creator ? { creatorHandle: cr.handle } : {}),
      },
    });
  }, [takeStage]);

  const stageCard = override ?? liveEvent ?? mainBroadcast;
  const gateVisible = authResolved && !celebration && ((!user && !isGuest) || gateOpen);

  return (
    <div className="h-screen w-screen overflow-hidden flex bg-black text-white relative selection:bg-white selection:text-black font-sans">
      {splash ? <Splash onDismiss={() => setSplash(false)} /> : null}

      {gateVisible && !splash ? (
        <Gate
          products={bootstrap.PRODUCTS ?? []}
          client={client}
          card={stageCard}
          viewers={viewers}
          onGuest={() => {
            setIsGuest(true);
            setGateOpen(false);
          }}
          onSignedIn={onSignedIn}
        />
      ) : null}

      {celebration ? (
        <Celebration name={celebration.name} badge={celebration.badge} onEnter={() => setCelebration(null)} />
      ) : null}

      <Rail
        products={bootstrap.PRODUCTS ?? []}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          selectTab(tab);
          setActiveProduct('all');
        }}
        activeProduct={activeProduct}
        onSelectProduct={setActiveProduct}
        balance={balance}
        user={user}
        onOpenGifts={openGifts}
        onOpenGate={() => {
          setIsGuest(false);
          setGateOpen(true);
        }}
        onSignOut={signOut}
        collapsed={railCollapsed}
        onToggleCollapsed={() => setRailCollapsed((c) => !c)}
      />

      <main className="flex-1 h-screen overflow-y-auto min-w-0 p-4 md:p-8 space-y-10 border-r border-white/10 no-scrollbar relative">
        {toast ? (
          <output
            aria-live="polite"
            className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-2.5 rounded-full bg-[#141418] border border-white/20 text-white font-bold text-xs shadow-2xl animate-bounce flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-white" />
            {toast}
          </output>
        ) : null}

        <TopBar activeTab={activeTab} onSelectTab={selectTab} search={search} onSearch={setSearch} />

        {activeTab === 'tv' ? (
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
            onOpenGifts={openGifts}
            onSendComment={sendLiveComment}
            ticker={ticker}
            giftBanner={giftBanner}
            hearts={hearts}
            signedIn={Boolean(user)}
            theater={theater}
            onToggleTheater={toggleTheater}
          />
        ) : null}

        {activeTab === 'tv' || activeTab === 'foryou' ? (
          <Reel spotlights={[...creatorSpots, ...(bootstrap.CREATOR_SPOTLIGHTS ?? [])]} onSelect={openSpotlight} />
        ) : null}

        <Feed
          posts={[...libraryPosts, ...(bootstrap.INITIAL_POSTS ?? [])]}
          products={bootstrap.PRODUCTS ?? []}
          activeProduct={activeProduct}
          onSelectProduct={setActiveProduct}
          activeTab={activeTab}
          onSelectTab={selectTab}
          search={search}
          now={now}
          client={client}
          signedIn={Boolean(user)}
          onRequireSignIn={() => setGateOpen(true)}
          onOpenGifts={openGifts}
          onSelect={openPost}
          showToast={showToast}
        />
      </main>

      {!theater ? (
        <ChatRail
          hubs={bootstrap.PRODUCT_COMMUNITY_HUBS ?? {}}
          products={bootstrap.PRODUCTS ?? []}
          activeProduct={activeProduct}
          client={client}
          user={user}
          onRequireSignIn={() => setGateOpen(true)}
          showToast={showToast}
        />
      ) : null}

      {giftsOpen ? (
        <GiftPalette gifts={gifts} balance={balance} onClose={() => setGiftsOpen(false)} onSend={sendGift} />
      ) : null}

      {selectedVideo ? (
        <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)} onPromote={takeStage} />
      ) : null}
    </div>
  );
}
