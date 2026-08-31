'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Maximize, Heart, Flame, Gift as GiftIcon, Undo2, Send } from 'lucide-react';
import type { LiveComment, StageCard } from '@/lib/types';
import { playSegments, segmentPlaybackSupported } from '@/lib/segment-player';
import { compact, coins } from '@/lib/format';

declare global {
  interface Window {
    Hls?: any;
  }
}

type StageProps = {
  card: StageCard;
  isLiveEvent: boolean;
  isTakeover: boolean;
  muted: boolean;
  onToggleMuted: () => void;
  onRevert: () => void;
  onEnded: () => void;
  liveError: string | null;
  onLiveError: (msg: string | null) => void;
  apiBase: string;
  viewers: number | null;
  likes: number;
  liked: boolean;
  onLike: () => void;
  onReact: (emoji: string) => void;
  onOpenGifts: () => void;
  onSendComment: (text: string) => void;
  ticker: LiveComment[];
  giftBanner: { sender: string; giftName: string; cost: number } | null;
  particles: { id: number; emoji: string; right: number }[];
  signedIn: boolean;
  skeleton: boolean;
};

const isHls = (url: string | null | undefined) => Boolean(url && url.includes('.m3u8'));

// hls.js is only needed for a live event with an HLS source, so it loads
// lazily, once, from the CDN.
function attachHls(el: HTMLVideoElement, url: string, onError: (msg: string) => void) {
  if (el.canPlayType('application/vnd.apple.mpegurl')) {
    el.src = url;
    return () => {};
  }
  let destroyed = false;
  let hls: any = null;
  const start = () => {
    if (destroyed || !window.Hls) return;
    hls = new window.Hls({ lowLatencyMode: true });
    hls.on(window.Hls.Events.ERROR, (_e: unknown, data: { fatal?: boolean }) => {
      if (data?.fatal) {
        el.src = url;
        onError('The live stream hiccupped; retrying directly.');
      }
    });
    hls.loadSource(url);
    hls.attachMedia(el);
  };
  const existing = document.getElementById('neutv-hls') as HTMLScriptElement | null;
  if (window.Hls) start();
  else if (existing) existing.addEventListener('load', start);
  else {
    const script = document.createElement('script');
    script.id = 'neutv-hls';
    script.src = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js';
    script.addEventListener('load', start);
    script.addEventListener('error', () => onError('This broadcast could not be played here.'));
    document.head.appendChild(script);
  }
  return () => {
    destroyed = true;
    hls?.destroy?.();
  };
}

function youTubeSrc(id: string, muted: boolean, takeover: boolean) {
  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted ? '1' : '0',
    loop: takeover ? '0' : '1',
    playlist: id,
    controls: takeover ? '1' : '0',
    disablekb: '1',
    modestbranding: '1',
    rel: '0',
    iv_load_policy: '3',
    playsinline: '1',
  });
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

export function Stage(props: StageProps) {
  const {
    card,
    isLiveEvent,
    isTakeover,
    muted,
    onToggleMuted,
    onRevert,
    onEnded,
    liveError,
    onLiveError,
    apiBase,
    viewers,
    likes,
    liked,
    onLike,
    onReact,
    onOpenGifts,
    onSendComment,
    ticker,
    giftBanner,
    particles,
    signedIn,
    skeleton,
  } = props;

  const frameRef = useRef<HTMLDivElement>(null);
  const [comment, setComment] = useState('');

  // Segmented broadcasts: (re)start the player whenever the event changes.
  const segStop = useRef<(() => void) | null>(null);
  const segVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      segStop.current?.();
      segStop.current = null;
      if (!el || !card.id) return;
      if (!segmentPlaybackSupported()) {
        onLiveError('This browser cannot play a studio broadcast. Try Chrome, Edge or Firefox.');
        return;
      }
      segStop.current = playSegments(el, card.id, {
        base: apiBase,
        onError: () => onLiveError('The broadcast signal dropped. It reconnects on its own.'),
      });
      void el.play().catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.id, apiBase],
  );
  useEffect(() => () => segStop.current?.(), []);

  // HLS live events.
  const hlsCleanup = useRef<(() => void) | null>(null);
  const hlsVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      hlsCleanup.current?.();
      hlsCleanup.current = null;
      if (!el || !card.videoUrl) return;
      hlsCleanup.current = attachHls(el, card.videoUrl, (msg) => onLiveError(msg));
      void el.play().catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [card.id, card.videoUrl],
  );
  useEffect(() => () => hlsCleanup.current?.(), []);

  const goFullscreen = () => {
    void frameRef.current?.requestFullscreen?.().catch(() => {});
  };

  if (skeleton) {
    return (
      <section aria-label="Broadcast stage (loading)">
        <div className="skeleton aspect-video w-full rounded-stage" />
        <div className="mt-3 flex items-center gap-3">
          <div className="skeleton h-5 w-64" />
          <div className="skeleton h-5 w-24" />
        </div>
      </section>
    );
  }

  let player: React.ReactNode;
  if (isLiveEvent && card.isSegmented) {
    player = (
      <video
        key={`seg-${card.id}`}
        ref={segVideoRef}
        muted={muted}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
    );
  } else if (isLiveEvent && isHls(card.videoUrl)) {
    player = (
      <video
        key={`hls-${card.id}`}
        ref={hlsVideoRef}
        muted={muted}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
    );
  } else if (isLiveEvent && card.videoUrl && !card.youtubeId) {
    player = (
      <video
        key={`live-${card.id}`}
        src={card.videoUrl}
        muted={muted}
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
    );
  } else if (isTakeover && card.videoUrl) {
    player = (
      <video
        key={`take-${card.id}`}
        src={card.videoUrl}
        poster={card.posterUrl ?? undefined}
        muted={muted}
        autoPlay
        controls
        playsInline
        onEnded={onEnded}
        className="h-full w-full object-contain"
      />
    );
  } else if (card.youtubeId) {
    player = (
      <iframe
        key={`yt-${card.youtubeId}-${muted}-${isTakeover}`}
        src={youTubeSrc(card.youtubeId, muted, isTakeover)}
        title={card.title}
        allow="autoplay; encrypted-media; fullscreen"
        // Live television cannot be scrubbed; a takeover can.
        className={`h-full w-full ${isTakeover ? '' : 'pointer-events-none'}`}
      />
    );
  } else if (card.videoUrl) {
    player = (
      <video
        key={`loop-${card.id}`}
        src={card.videoUrl}
        poster={card.posterUrl ?? undefined}
        muted={muted}
        autoPlay
        loop
        playsInline
        className="h-full w-full object-contain"
      />
    );
  } else {
    player = (
      <div className="grid h-full w-full place-items-center p-6 text-center">
        <div>
          <div className="text-lg font-extrabold">Nothing is on air</div>
          <p className="mx-auto mt-2 max-w-sm text-sm text-dim">
            No live event is running and no programme has been set in the back office.
          </p>
        </div>
      </div>
    );
  }

  // A still frame must say which of the three states this is: red frame and
  // pill for a live event, a quiet cyan chip for the looping channel, and a
  // labelled banner with a way back for a takeover.
  return (
    <section aria-label="Broadcast stage">
      <div
        ref={frameRef}
        className={`relative aspect-video w-full overflow-hidden rounded-stage bg-black ${
          isLiveEvent ? 'ring-2 ring-live' : 'ring-1 ring-line'
        }`}
      >
        {player}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          {isLiveEvent ? (
            <span className="flex items-center gap-1.5 rounded-full bg-live px-2.5 py-1 text-[11px] font-extrabold text-white">
              <span className="live-dot" aria-hidden /> LIVE
            </span>
          ) : isTakeover ? (
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-ink">
              Playing from the feed
            </span>
          ) : (
            <span className="rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-bold text-cyan">On air</span>
          )}
        </div>

        {isTakeover ? (
          <button
            type="button"
            onClick={onRevert}
            className="absolute top-3 right-3 flex items-center gap-1.5 rounded-control bg-black/70 px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-black/90"
          >
            <Undo2 size={14} /> Back to broadcast
          </button>
        ) : null}

        {liveError ? (
          <div className="absolute right-3 bottom-16 left-3 rounded-control border border-line bg-black/80 px-3 py-2 text-xs text-amber md:left-auto md:max-w-sm">
            {liveError}
          </div>
        ) : null}

        {giftBanner ? (
          <div className="absolute top-12 left-1/2 hidden -translate-x-1/2 items-center gap-2 rounded-full border border-line-strong bg-black/80 px-4 py-2 md:flex">
            <span className="text-sm font-bold">
              {giftBanner.sender} sent {giftBanner.giftName}
            </span>
            <span className="num rounded-full bg-obsidian px-2 py-0.5 text-[11px] font-bold text-cyan">
              {coins(giftBanner.cost)} KashCoin
            </span>
          </div>
        ) : null}

        {/* Reaction particles rise from the lower right. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {particles.map((p) => (
            <span key={p.id} className="particle absolute bottom-16 text-xl" style={{ right: p.right }}>
              {p.emoji}
            </span>
          ))}
        </div>

        {/* The floating comment ticker sits on the video only where the video
            is big enough to spare the pixels. */}
        {ticker.length > 0 ? (
          <div className="absolute bottom-14 left-3 hidden w-72 flex-col gap-1.5 md:flex" aria-live="polite">
            {ticker.map((c) => (
              <TickerBubble key={String(c.id)} comment={c} />
            ))}
          </div>
        ) : null}

        {/* First-class controls: the viewer arrives muted by browser policy,
            so unmute is the first thing they do. */}
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMuted}
            aria-pressed={!muted}
            className="flex items-center gap-1.5 rounded-control bg-black/70 px-3 py-1.5 text-xs font-bold text-ink transition hover:bg-black/90"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {muted ? 'Unmute' : 'Mute'}
          </button>
        </div>
        <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onLike}
            aria-pressed={liked}
            title="Like this broadcast"
            className={`flex items-center gap-1.5 rounded-control bg-black/70 px-2.5 py-1.5 text-xs font-bold transition hover:bg-black/90 ${
              liked ? 'text-cyan' : 'text-ink'
            }`}
          >
            <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
            <span className="num">{compact(likes)}</span>
          </button>
          <button
            type="button"
            onClick={() => onReact('🔥')}
            title="React"
            className="grid h-8 w-8 place-items-center rounded-control bg-black/70 text-ink transition hover:bg-black/90"
          >
            <Flame size={14} />
          </button>
          <button
            type="button"
            onClick={onOpenGifts}
            title="Send a gift"
            className="grid h-8 w-8 place-items-center rounded-control bg-black/70 text-ink transition hover:bg-black/90"
          >
            <GiftIcon size={14} />
          </button>
          <button
            type="button"
            onClick={goFullscreen}
            title="Watch fullscreen"
            className="grid h-8 w-8 place-items-center rounded-control bg-black/70 text-ink transition hover:bg-black/90"
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>

      {/* On a phone the video is too small to cover: overlays move below it. */}
      {ticker.length > 0 ? (
        <div className="mt-2 flex flex-col gap-1.5 md:hidden" aria-hidden>
          <TickerBubble comment={ticker[0]} />
        </div>
      ) : null}
      {giftBanner ? (
        <div className="mt-2 flex items-center gap-2 rounded-control border border-line bg-midnight px-3 py-2 md:hidden">
          <span className="text-xs font-bold">
            {giftBanner.sender} sent {giftBanner.giftName}
          </span>
          <span className="num text-[11px] font-bold text-cyan">{coins(giftBanner.cost)} KashCoin</span>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-extrabold tracking-tight">{card.title}</h1>
          <div className="mt-0.5 flex items-center gap-2 text-xs text-dim">
            <span className="num">{viewers === null ? '—' : compact(viewers)} watching</span>
            {card.productId ? <span className="text-faint">{card.productId}</span> : null}
          </div>
        </div>

        <form
          className="flex w-full max-w-md items-center gap-2 sm:w-auto"
          onSubmit={(e) => {
            e.preventDefault();
            const text = comment.trim();
            if (!text) return;
            onSendComment(text);
            setComment('');
          }}
        >
          <input
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={signedIn ? 'Comment on the broadcast' : 'Sign in to comment'}
            aria-label="Comment on the broadcast"
            className="min-w-0 flex-1 rounded-control border border-line bg-midnight px-3 py-2 text-[13px] placeholder:text-faint focus:border-line-strong focus:outline-none"
          />
          <button
            type="submit"
            disabled={!comment.trim()}
            className="flex items-center gap-1.5 rounded-control bg-cyan px-3 py-2 text-xs font-bold text-deep transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Send size={13} /> Send
          </button>
        </form>
      </div>
    </section>
  );
}

function TickerBubble({ comment }: { comment: LiveComment }) {
  return (
    <div
      className={`flex max-w-full items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs ${
        comment.optimistic ? 'border-line bg-black/60 text-dim' : 'border-line bg-black/70 text-ink'
      }`}
    >
      <span className="shrink-0 font-bold text-sky">{comment.author}</span>
      <span className="truncate">{comment.text}</span>
      {comment.flagged ? (
        <span className="shrink-0 rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold text-amber">
          in review
        </span>
      ) : null}
    </div>
  );
}
