'use client';

// The live stage: control bar on top, the broadcast below, overlays riding on
// the video. Player selection mirrors the backend's stage machine — segmented
// studio broadcasts, HLS, plain sources, YouTube — and live TV cannot be
// scrubbed.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Expand,
  Flame,
  Globe,
  Heart,
  Maximize,
  Minimize,
  Shrink,
  Tv,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { LiveComment, StageCard } from '@/lib/types';
import { playSegments, segmentPlaybackSupported } from '@/lib/segment-player';

declare global {
  interface Window {
    Hls?: any;
  }
}

const AUDIO_LANGUAGES = [
  'English (Original)',
  'Spanish (Español)',
  'French (Français)',
  'German (Deutsch)',
  'Portuguese (Português)',
  'Swahili (Kiswahili)',
  'Yoruba (Èdè Yorùbá)',
  'Arabic (العربية)',
];

const SUBTITLE_OPTIONS = [
  'Subtitles Off',
  'English CC',
  'Spanish (Español) CC',
  'French (Français) CC',
  'German (Deutsch) CC',
  'Portuguese CC',
];

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
  giftBanner: { sender: string; giftName: string; cost: number; emoji?: string } | null;
  hearts: { id: number; emoji: string; right: number }[];
  signedIn: boolean;
  theater: boolean;
  onToggleTheater: () => void;
};

const isHls = (url: string | null | undefined) => Boolean(url && url.includes('.m3u8'));

// hls.js loads lazily, once, only when a live event actually streams HLS.
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
      if (data?.fatal) el.src = url;
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
    hearts,
    signedIn,
    theater,
    onToggleTheater,
  } = props;

  const frameRef = useRef<HTMLElement>(null);
  const [comment, setComment] = useState('');
  const [audioLanguage, setAudioLanguage] = useState('English (Original)');
  const [subtitleLang, setSubtitleLang] = useState('English CC');
  const [audioOpen, setAudioOpen] = useState(false);
  const [subtitleOpen, setSubtitleOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

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
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void frameRef.current?.requestFullscreen?.().catch(() => {});
  };

  let player: React.ReactNode;
  // A segmented or HLS source can be the network's live event OR a creator's
  // spotlight session playing as a takeover - the same players serve both.
  if (card.isSegmented && (isLiveEvent || isTakeover)) {
    player = (
      <video key={`seg-${card.id}`} ref={segVideoRef} muted={muted} autoPlay playsInline className="w-full h-full object-cover border-0" />
    );
  } else if ((isLiveEvent || isTakeover) && isHls(card.videoUrl)) {
    player = (
      <video key={`hls-${card.id}`} ref={hlsVideoRef} muted={muted} autoPlay playsInline className="w-full h-full object-cover border-0" />
    );
  } else if (isLiveEvent && card.videoUrl && !card.youtubeId) {
    player = (
      <video key={`live-${card.id}`} src={card.videoUrl} muted={muted} autoPlay playsInline className="w-full h-full object-cover border-0" />
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
        className="w-full h-full object-contain bg-black border-0"
      />
    );
  } else if (card.youtubeId) {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: muted ? '1' : '0',
      loop: isTakeover ? '0' : '1',
      playlist: card.youtubeId,
      controls: isTakeover ? '1' : '0',
      disablekb: '1',
      modestbranding: '1',
      rel: '0',
      iv_load_policy: '3',
      playsinline: '1',
    });
    player = (
      <iframe
        key={`yt-${card.youtubeId}-${muted}-${isTakeover}`}
        src={`https://www.youtube-nocookie.com/embed/${card.youtubeId}?${params}`}
        title={card.title}
        allow="autoplay; encrypted-media; fullscreen"
        className={`w-full h-full object-cover border-0 scale-[1.02] ${isTakeover ? '' : 'pointer-events-none'}`}
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
        className="w-full h-full object-cover border-0"
      />
    );
  } else {
    player = (
      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-center px-6">
        <Tv className="w-8 h-8 text-white/20" />
        <div className="text-sm font-bold text-white/70">Nothing is on air</div>
        <div className="text-[11px] text-white/40 max-w-sm">
          No live event is running and no programme has been set in the back office.
        </div>
      </div>
    );
  }

  return (
    <section
      ref={frameRef}
      aria-label="Broadcast stage"
      className="relative w-full rounded-3xl border border-white/15 bg-[#0A0A0C] overflow-hidden shadow-2xl group flex flex-col z-10"
    >
      {/* Control bar */}
      <div className="p-4 md:px-6 md:py-3.5 bg-[#0A0A0C]/95 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap z-30">
        <div className="flex items-center gap-3">
          {isLiveEvent ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-black">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-live shadow-lg" aria-hidden />
              LIVE
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 text-red-400 text-xs font-black">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-live shadow-lg" aria-hidden />
              ON AIR
            </span>
          )}
          <div className="h-6 flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/neu-brand-banner.png" alt="NEU" className="h-full w-auto object-contain drop-shadow" />
          </div>
          <span className="text-xs text-white/70 font-extrabold uppercase tracking-wide hidden sm:inline">Live Stage</span>
          <span className="text-white/30 hidden sm:inline">|</span>
          <span className="text-xs text-white font-semibold hidden sm:inline num">
            {(viewers ?? 0).toLocaleString()} watching live
          </span>
        </div>

        <div className="flex items-center gap-2 relative z-50">
          <button
            type="button"
            onClick={onToggleMuted}
            aria-pressed={!muted}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition flex items-center gap-1.5 shadow-lg ${
              muted ? 'bg-white text-black font-black hover:bg-neutral-200' : 'bg-white/10 text-white border border-white/25 hover:bg-white/20'
            }`}
          >
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            {muted ? 'Unmute' : 'Mute'}
          </button>

          <div className="relative">
            <button
              type="button"
              title="Select Audio Language"
              aria-haspopup="menu"
              aria-expanded={audioOpen}
              onClick={() => {
                setAudioOpen((o) => !o);
                setSubtitleOpen(false);
              }}
              className="px-2.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white flex items-center gap-1.5 transition"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden md:inline text-[11px]">{audioLanguage.split(' ')[0]}</span>
              <ChevronDown className="w-3 h-3 text-white/60" />
            </button>
            {audioOpen ? (
              <div role="menu" className="absolute right-0 top-full mt-2 w-48 bg-neutral-900 border border-white/20 rounded-2xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-xl">
                <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-white/50 border-b border-white/10">
                  Audio Language
                </div>
                {AUDIO_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAudioLanguage(lang);
                      setAudioOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs font-bold transition flex items-center justify-between hover:bg-white/10 ${
                      audioLanguage === lang ? 'text-[#0070F3] bg-white/5' : 'text-white/80'
                    }`}
                  >
                    {lang}
                    {audioLanguage === lang ? <span className="text-[#0070F3] font-black">✓</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="relative">
            <button
              type="button"
              title="Subtitles & Captions"
              aria-haspopup="menu"
              aria-expanded={subtitleOpen}
              onClick={() => {
                setSubtitleOpen((o) => !o);
                setAudioOpen(false);
              }}
              className={`px-2.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 border ${
                subtitleLang !== 'Off'
                  ? 'bg-[#0070F3] text-white border-[#0070F3]'
                  : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20 hover:text-white'
              }`}
            >
              <span className="font-mono text-[11px] font-black">CC</span>
              <ChevronDown className="w-3 h-3 text-white/60" />
            </button>
            {subtitleOpen ? (
              <div role="menu" className="absolute right-0 top-full mt-2 w-44 bg-neutral-900 border border-white/20 rounded-2xl shadow-2xl py-1.5 z-50 animate-fadeIn backdrop-blur-xl">
                <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-white/50 border-b border-white/10">
                  Subtitles / CC
                </div>
                {SUBTITLE_OPTIONS.map((sub) => {
                  const active = subtitleLang === sub || (subtitleLang === 'Off' && sub === 'Subtitles Off');
                  return (
                    <button
                      key={sub}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSubtitleLang(sub === 'Subtitles Off' ? 'Off' : sub);
                        setSubtitleOpen(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-xs font-bold transition flex items-center justify-between hover:bg-white/10 ${
                        active ? 'text-[#0070F3] bg-white/5' : 'text-white/80'
                      }`}
                    >
                      {sub}
                      {active ? <span className="text-[#0070F3] font-black">✓</span> : null}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            title={theater ? 'Exit Expanded Player' : 'Expand Player'}
            aria-pressed={theater}
            onClick={onToggleTheater}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
              theater
                ? 'bg-white text-black border-white hover:bg-neutral-200'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            }`}
          >
            {theater ? <Shrink className="w-3.5 h-3.5" /> : <Expand className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            title="Watch Fullscreen"
            onClick={goFullscreen}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 flex items-center justify-center text-white transition"
          >
            {fullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Stage surface */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {player}

        {subtitleLang !== 'Off' && !isTakeover ? (
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-lg bg-black/85 backdrop-blur-md text-white font-sans text-xs md:text-sm font-semibold tracking-wide text-center max-w-lg border border-white/15 pointer-events-none shadow-2xl animate-fadeIn">
            <span className="text-white/60 text-[10px] font-mono mr-1.5 uppercase">[{subtitleLang}]</span>
            &quot;The New Economy provides verified sovereign liquidity across WorldStreet, mARKet and KashPlus.&quot;
          </div>
        ) : null}

        {!isTakeover && isLiveEvent ? (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/85 backdrop-blur-md border border-red-500/50 shadow-xl max-w-[92%]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live flex-shrink-0" aria-hidden />
            <span className="text-[10px] md:text-xs font-black text-red-400 tracking-wide flex-shrink-0">LIVE</span>
            <span className="text-[10px] md:text-xs font-bold text-white truncate">{card.title}</span>
          </div>
        ) : null}

        {!isTakeover && isLiveEvent && liveError ? (
          <div className="absolute inset-x-0 bottom-0 z-40 px-4 py-2.5 bg-black/85 backdrop-blur-md border-t border-red-500/40 text-center">
            <span className="text-[11px] font-semibold text-red-300">{liveError}</span>
          </div>
        ) : null}

        {isTakeover ? (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/85 backdrop-blur-md border border-[#00F6A7]/40 shadow-xl max-w-[92%]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00F6A7] flex-shrink-0" aria-hidden />
            <span className="text-[10px] md:text-xs font-bold text-white truncate">{card.title}</span>
            <button
              type="button"
              onClick={onRevert}
              className="ml-1 px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 text-[10px] font-black text-white transition flex-shrink-0"
            >
              Back to live
            </button>
          </div>
        ) : null}

        {giftBanner ? (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full bg-[#141418] text-white font-black text-xs md:text-sm flex items-center gap-3 shadow-2xl border-2 border-[#0070F3] shadow-[0_0_30px_rgba(0,112,243,0.5)] animate-bounce">
            <span className="w-9 h-9 rounded-full bg-[#0070F3] text-white flex items-center justify-center text-lg shadow-md" aria-hidden>
              {giftBanner.emoji || '🎁'}
            </span>
            <span>
              {giftBanner.sender} sent {giftBanner.giftName}!
            </span>
            <span className="px-2 py-0.5 rounded-full bg-white/10 text-[#38B6FF] text-xs font-mono font-black num">
              {giftBanner.cost} KASH
            </span>
          </div>
        ) : null}

        {hearts.map((heart) => (
          <span
            key={heart.id}
            aria-hidden
            className="flying-heart text-3xl select-none pointer-events-none"
            style={{ right: `${heart.right}px`, bottom: '5rem' }}
          >
            {heart.emoji || <span className="kash-coin" />}
          </span>
        ))}

        {ticker.length > 0 ? (
          <div className="absolute left-6 bottom-24 z-30 flex-col gap-2 max-w-sm pointer-events-none hidden md:flex" aria-live="polite">
            {ticker.map((c) => (
              <div
                key={String(c.id)}
                className="live-comment-bubble px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs backdrop-blur-md border border-white/20"
              >
                {c.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.avatar} alt="" className="w-5 h-5 rounded-full object-cover border border-white/30" />
                ) : null}
                <span className="font-semibold text-white/90">{c.author}</span>
                <span className="text-white/80 truncate">{c.text}</span>
              </div>
            ))}
          </div>
        ) : null}

        {/* Reaction rail */}
        <div className="absolute right-4 bottom-20 z-40 flex flex-col items-center gap-3">
          <button
            type="button"
            title="Send Live KashCoin Gift"
            onClick={onOpenGifts}
            className="w-12 h-12 rounded-full bg-[#0070F3] hover:bg-[#0060DF] text-white text-2xl flex items-center justify-center transition hover:scale-110 active:scale-125 shadow-2xl border-2 border-white/40"
          >
            🎁
          </button>
          <button
            type="button"
            onClick={onLike}
            aria-pressed={liked}
            className={`w-11 h-11 rounded-full border border-white/20 flex flex-col items-center justify-center backdrop-blur-md transition shadow-xl ${
              liked ? 'bg-rose-600 text-white border-rose-400 scale-110' : 'bg-black/70 text-white hover:bg-black/90'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-white' : ''}`} />
            <span className="text-[8px] font-bold mt-0.5 num">{likes.toLocaleString()}</span>
          </button>
          <button
            type="button"
            onClick={() => onReact('🔥')}
            title="React"
            className="w-11 h-11 rounded-full bg-black/75 backdrop-blur-md border border-red-500/30 text-xl flex items-center justify-center hover:bg-red-500/20 transition active:scale-125 shadow-xl text-red-500"
          >
            <Flame className="w-5 h-5 fill-red-500 text-red-500 stroke-red-500" />
          </button>
        </div>

        {/* Stage footer */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-4 md:p-6 bg-gradient-to-t from-[#000000] via-[#000000]/90 to-transparent flex flex-col md:flex-row md:items-end justify-between gap-4 pointer-events-auto">
          <div className="max-w-xl space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-mono font-black tracking-widest text-white uppercase bg-white/10 px-2.5 py-0.5 rounded-full border border-white/15">
                THE NEW ECONOMY, ON SCREEN.
              </span>
              <span className="text-[9px] text-white/50 font-bold uppercase tracking-wider">
                INNOVATIVE • BOLD • TRUSTED • INSPIRING
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-black tracking-tight text-white leading-snug">{card.title}</h1>
            {card.description ? <p className="text-xs text-white/70 line-clamp-1">{card.description}</p> : null}
          </div>

          <form
            className="flex items-center gap-2 w-full md:w-auto"
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
              placeholder={signedIn ? 'Comment on live stream...' : 'Sign in to comment...'}
              aria-label="Comment on the live stream"
              className="bg-[#141418]/80 border border-white/20 rounded-full px-4 py-2 text-xs text-white placeholder-white/50 outline-none focus:border-white/30 transition min-w-[220px] flex-1 md:flex-none"
            />
            <button
              type="submit"
              disabled={!comment.trim()}
              className="px-4 py-2 rounded-full bg-white hover:bg-neutral-200 text-black font-black text-xs transition shadow-md disabled:opacity-60"
            >
              Send
            </button>
            <button
              type="button"
              onClick={onOpenGifts}
              className="px-3.5 py-2 rounded-full bg-[#0070F3] hover:bg-[#0060DF] text-white font-extrabold text-xs transition shadow-lg whitespace-nowrap flex items-center gap-1.5"
            >
              <span className="text-sm" aria-hidden>🎁</span>
              <span>Gift</span>
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
