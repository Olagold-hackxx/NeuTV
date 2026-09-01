'use client';

// Official announcements: the filter pill strip and the video card grid,
// in the original three-column layout.

import { useMemo, useState } from 'react';
import {
  Bookmark,
  Clapperboard,
  Heart,
  MessageCircle,
  MoreVertical,
  Play,
  Share2,
  Sparkles,
  Tv,
} from 'lucide-react';
import type { Post, Product } from '@/lib/types';
import { NeuTVClient, sync } from '@/lib/client';
import { relativeTime } from '@/lib/format';
import { brandTheme } from '@/lib/brand';
import type { MainTab } from './rail';

type FeedProps = {
  posts: Post[];
  products: Product[];
  activeProduct: string;
  onSelectProduct: (id: string) => void;
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  search: string;
  now: number;
  client: NeuTVClient;
  signedIn: boolean;
  onRequireSignIn: () => void;
  onOpenGifts: () => void;
  onSelect: (post: Post) => void;
  showToast: (msg: string) => void;
};

export function Feed(props: FeedProps) {
  const { posts, products, activeProduct, onSelectProduct, activeTab, onSelectTab, search } = props;

  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [upvotes, setUpvotes] = useState<Record<string, number>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const p of posts) if (p.isSaved) initial[p.id] = true;
    return initial;
  });

  const sorted = useMemo(() => [...posts].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)), [posts]);

  const filtered = useMemo(() => {
    let list = sorted;
    if (activeProduct !== 'all') list = list.filter((p) => p.productId === activeProduct);
    if (activeTab === 'following') list = list.filter((p) => p.handle === '@neutv' || p.fromLibrary);
    if (activeTab === 'saved') list = list.filter((p) => saved[p.id]);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        [p.author, p.content, p.productName, p.videoTitle]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [sorted, activeProduct, activeTab, saved, search]);

  return (
    <section className="space-y-12 w-full pt-4" aria-label="Official announcements">
      <div className="max-w-4xl mx-auto space-y-3.5 px-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base md:text-lg font-black text-white tracking-tight flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-white" />
            Official Announcements
          </h2>
          <span className="text-xs text-white/50 font-medium num">
            {filtered.length} {filtered.length === 1 ? 'announcement' : 'announcements'}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1" role="group" aria-label="Filter by product">
          <button
            type="button"
            onClick={() => onSelectProduct('all')}
            aria-pressed={activeProduct === 'all'}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-sm ${
              activeProduct === 'all'
                ? 'bg-white text-black font-black shadow-md'
                : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            ✨ All
          </button>
          {products.map((prod) => {
            const isSelected = activeProduct === prod.id;
            return (
              <button
                key={prod.id}
                type="button"
                onClick={() => onSelectProduct(prod.id)}
                aria-pressed={isSelected}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-sm ${
                  isSelected
                    ? 'bg-white text-black font-black shadow-md'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-black' : brandTheme(prod.id).bannerBg}`} aria-hidden />
                {prod.name}
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            tab={activeTab}
            onExplore={() => {
              onSelectTab('tv');
              onSelectProduct('all');
            }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-8 md:gap-x-5 md:gap-y-10">
            {filtered.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                liked={liked[post.id] ?? Boolean(post.isUpvoted)}
                upvoteCount={upvotes[post.id] ?? post.upvotes ?? 0}
                savedState={Boolean(saved[post.id])}
                setLiked={(v) => setLiked((m) => ({ ...m, [post.id]: v }))}
                setUpvoteCount={(v) => setUpvotes((m) => ({ ...m, [post.id]: v }))}
                setSavedState={(v) => setSaved((m) => ({ ...m, [post.id]: v }))}
                {...props}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptyState({ tab, onExplore }: { tab: MainTab; onExplore: () => void }) {
  const icon = tab === 'saved' ? '🔖' : tab === 'following' ? '👥' : '🔍';
  const title =
    tab === 'saved'
      ? 'No Saved Videos Yet'
      : tab === 'following'
        ? 'No Broadcasts From Followed Channels'
        : 'No Broadcasts Found';
  const sub =
    tab === 'saved'
      ? 'Click the bookmark icon on any broadcast or announcement to save it here for later.'
      : 'Follow more ecosystem creators or check out the Live TV stage.';

  return (
    <div className="p-12 text-center space-y-4 rounded-3xl bg-[#0E0E12]/60 border border-white/10 my-4">
      <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-2xl text-white/50" aria-hidden>
        {icon}
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-extrabold text-white">{title}</h3>
        <p className="text-xs text-white/60 max-w-sm mx-auto">{sub}</p>
      </div>
      <button
        type="button"
        onClick={onExplore}
        className="px-5 py-2 rounded-full bg-white text-black font-black text-xs hover:bg-neutral-200 transition shadow-lg inline-flex items-center gap-1.5"
      >
        <Tv className="w-3.5 h-3.5" />
        Explore NEU TV Live
      </button>
    </div>
  );
}

function PostCard({
  post,
  liked,
  upvoteCount,
  savedState,
  setLiked,
  setUpvoteCount,
  setSavedState,
  now,
  client,
  signedIn,
  onRequireSignIn,
  onOpenGifts,
  onSelect,
  showToast,
}: FeedProps & {
  post: Post;
  liked: boolean;
  upvoteCount: number;
  savedState: boolean;
  setLiked: (v: boolean) => void;
  setUpvoteCount: (v: number) => void;
  setSavedState: (v: boolean) => void;
}) {
  const age = post.timestamp || relativeTime(post.createdAt, now);

  const toggleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !liked;
    setLiked(next);
    setUpvoteCount(Math.max(0, upvoteCount + (next ? 1 : -1)));
    void sync(async () => {
      const res = await client.upvote(post.id);
      setUpvoteCount(res.upvotes);
      setLiked(res.isUpvoted);
      return res;
    });
  };

  const toggleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !savedState;
    setSavedState(next);
    showToast(next ? 'Post saved to bookmarks! 🔖' : 'Removed from bookmarks');
    void sync(async () => {
      const res = await client.save(post.id);
      setSavedState(res.isSaved);
      return res;
    });
  };

  const share = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
    void navigator.clipboard?.writeText(url).catch(() => {});
    showToast('Link copied to clipboard! 📋');
    void sync(() => client.share(post.id));
  };

  const gift = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!signedIn) {
      onRequireSignIn();
      return;
    }
    onOpenGifts();
  };

  return (
    <article
      id={`post-${post.id}`}
      className="group cursor-pointer flex flex-col space-y-3 select-none bg-transparent transition-transform duration-200 rounded-2xl"
    >
      <button type="button" onClick={() => onSelect(post)} className="text-left" aria-label={`Watch ${post.videoTitle ?? post.content}`}>
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-neutral-900 shadow-md">
          {post.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.mediaUrl} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : post.videoMp4 ? (
            <video
              src={`${post.videoMp4}#t=0.1`}
              preload="metadata"
              muted
              playsInline
              tabIndex={-1}
              className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/20">
              <Clapperboard className="w-8 h-8" />
            </div>
          )}
          <div className="absolute inset-0 bg-black/10 group-hover:bg-black/0 transition duration-300" />
          {post.duration ? (
            <span className="absolute bottom-2.5 right-2.5 px-1.5 py-0.5 rounded bg-black/85 text-white text-[11px] font-semibold tracking-wide shadow pointer-events-none num">
              {post.duration}
            </span>
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 pointer-events-none">
            <span className="w-12 h-12 rounded-full bg-black/75 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl">
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3 pt-0.5 mt-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0 mt-0.5 shadow-sm">
            {post.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={post.avatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-xs font-black text-white/60">
                {post.author.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0 pr-1">
            <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug group-hover:text-neutral-200 transition">
              {post.videoTitle || post.content}
            </h3>
            <div className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition mt-1">
              <span className="truncate font-medium">{post.productName || post.author}</span>
              {post.verified ? (
                <span className="w-3.5 h-3.5 rounded-full bg-[#0070F3] text-white font-black text-[9px] flex items-center justify-center flex-shrink-0" title="Official">
                  ✓
                </span>
              ) : null}
            </div>
            <div className="text-xs text-white/50 flex items-center gap-1 mt-0.5">
              {post.views ? <span className="num">{post.views} views</span> : null}
              {post.views && age ? <span>•</span> : null}
              {age ? <span>{age}</span> : null}
            </div>
          </div>
        </div>
      </button>

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className={`flex items-center gap-1 text-xs font-semibold transition transform active:scale-125 ${
              liked ? 'text-rose-500 font-bold' : 'text-white/60 hover:text-white'
            }`}
          >
            <Heart className={`w-4 h-4 ${liked ? 'fill-rose-500 stroke-rose-500' : 'stroke-current'}`} />
            <span className="font-mono text-[11px] num">{upvoteCount.toLocaleString()}</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(post);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-white/60 hover:text-white transition"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="font-mono text-[11px] num">{(post.comments ?? []).length}</span>
          </button>
          <button
            type="button"
            onClick={gift}
            className="px-2.5 py-1 rounded-full bg-[#0070F3]/20 hover:bg-[#0070F3] border border-[#0070F3]/40 text-[#38B6FF] hover:text-white text-[11px] font-bold flex items-center gap-1 transition active:scale-95 shadow-sm"
          >
            <span className="text-xs" aria-hidden>🎁</span>
            <span>Gift</span>
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={savedState}
            title={savedState ? 'Remove from Saved' : 'Save to Bookmarks'}
            className={`flex items-center gap-1 text-xs font-semibold transition p-1 ${
              savedState ? 'text-purple-400 font-bold' : 'text-white/40 hover:text-white'
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${savedState ? 'fill-purple-400 text-purple-400' : 'stroke-current'}`} />
          </button>
          <button type="button" onClick={share} title="Copy link" className="text-white/40 hover:text-white transition p-1">
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={share}
            title="More"
            className="w-8 h-8 rounded-full hover:bg-white/10 text-white/60 hover:text-white flex items-center justify-center transition flex-shrink-0 opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
