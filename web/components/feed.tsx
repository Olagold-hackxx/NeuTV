'use client';

import { useMemo, useState } from 'react';
import { Heart, Bookmark, Share2, MessageSquare, Gift as GiftIcon, BadgeCheck, Play, ChevronDown } from 'lucide-react';
import type { Post, PostComment, Product } from '@/lib/types';
import { NeuTVClient, sync } from '@/lib/client';
import { compact, relativeTime } from '@/lib/format';

type FeedProps = {
  posts: Post[];
  products: Product[];
  activeProduct: string;
  onSelectProduct: (id: string) => void;
  search: string;
  now: number;
  client: NeuTVClient;
  signedIn: boolean;
  onRequireSignIn: () => void;
  onPromote: (card: Record<string, unknown>) => void;
  onOpenGifts: () => void;
  showToast: (msg: string) => void;
  skeleton: boolean;
};

export function Feed(props: FeedProps) {
  const { posts, products, activeProduct, onSelectProduct, search, skeleton } = props;

  const sorted = useMemo(
    () => [...posts].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    [posts],
  );

  const filtered = useMemo(() => {
    let list = sorted;
    if (activeProduct !== 'all') list = list.filter((p) => p.productId === activeProduct);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) =>
        [p.author, p.content, p.productName, p.videoTitle]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q)),
      );
    }
    return list;
  }, [sorted, activeProduct, search]);

  if (skeleton) {
    return (
      <section className="mt-6" aria-label="Announcements (loading)">
        <div className="skeleton mb-3 h-5 w-52" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-panel border border-line bg-midnight">
              <div className="skeleton aspect-video w-full rounded-none" />
              <div className="space-y-2 p-3">
                <div className="skeleton h-4 w-3/4" />
                <div className="skeleton h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8" aria-label="Official announcements">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">
          Official announcements
          <span className="num ml-2 text-xs font-semibold text-faint">{filtered.length}</span>
        </h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by product">
          {[{ id: 'all', name: 'All' } as Product, ...products].map((p) => {
            const active = activeProduct === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProduct(p.id)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  active
                    ? 'bg-obsidian text-cyan shadow-[inset_0_0_0_1px_var(--color-cyan)]'
                    : 'text-dim hover:bg-obsidian hover:text-ink'
                }`}
              >
                {p.name}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-panel border border-line bg-midnight px-6 py-14 text-center">
          <div className="text-sm font-bold">No announcements match</div>
          <p className="mx-auto mt-1.5 max-w-sm text-[13px] text-dim">
            {search.trim()
              ? 'Nothing matches that search. Clear it, or pick a different product.'
              : 'This product has not posted yet. Switch to All to see the whole network.'}
          </p>
          <button
            type="button"
            onClick={() => {
              onSelectProduct('all');
            }}
            className="mt-4 rounded-control border border-line-strong bg-obsidian px-3.5 py-2 text-xs font-bold transition hover:bg-midnight"
          >
            Show all products
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((post) => (
            <PostCard key={post.id} post={post} {...props} />
          ))}
        </div>
      )}
    </section>
  );
}

function PostCard({
  post,
  now,
  client,
  signedIn,
  onRequireSignIn,
  onPromote,
  onOpenGifts,
  showToast,
}: FeedProps & { post: Post }) {
  const [upvotes, setUpvotes] = useState(post.upvotes ?? 0);
  const [liked, setLiked] = useState(Boolean(post.isUpvoted));
  const [saved, setSaved] = useState(Boolean(post.isSaved));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[] | null>(post.comments ?? null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [heldNotice, setHeldNotice] = useState<string | null>(null);

  const age = post.timestamp || relativeTime(post.createdAt, now);
  const playable = Boolean(post.videoMp4 || post.youtubeId);

  const toggleLike = () => {
    setLiked((was) => {
      setUpvotes((n) => Math.max(0, n + (was ? -1 : 1)));
      return !was;
    });
    void sync(async () => {
      const res = await client.upvote(post.id);
      setUpvotes(res.upvotes);
      setLiked(res.isUpvoted);
      return res;
    });
  };

  const toggleSave = () => {
    setSaved((was) => !was);
    showToast(saved ? 'Removed from saved' : 'Saved for later');
    void sync(async () => {
      const res = await client.save(post.id);
      setSaved(res.isSaved);
      return res;
    });
  };

  const share = () => {
    const url = `${window.location.origin}${window.location.pathname}?post=${post.id}`;
    void navigator.clipboard?.writeText(url).catch(() => {});
    showToast('Link copied');
    void sync(() => client.share(post.id));
  };

  const openDrawer = () => {
    setDrawerOpen((open) => !open);
    if (comments === null && !commentsLoading) {
      setCommentsLoading(true);
      void sync(async () => {
        const res = await client.comments(post.id);
        setComments(res.comments ?? []);
        return res;
      }).finally(() => setCommentsLoading(false));
    }
  };

  // Comments post optimistically; moderation can withdraw one a moment later.
  // That withdrawal is a designed state, not an error.
  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (!signedIn) {
      onRequireSignIn();
      return;
    }
    const optimistic: PostComment = {
      id: `c-${Date.now()}`,
      author: 'You',
      text,
      timestamp: 'just now',
      optimistic: true,
    };
    setComments((prev) => [...(prev ?? []), optimistic]);
    setDraft('');
    setHeldNotice(null);
    void sync(
      async () => {
        const res = await client.comment(post.id, text);
        setComments((prev) =>
          (prev ?? []).map((c) => (c.id === optimistic.id ? { ...c, ...res.comment, timestamp: 'just now' } : c)),
        );
        return res;
      },
      (err) => {
        if (err.status === 400) {
          setComments((prev) => (prev ?? []).filter((c) => c.id !== optimistic.id));
          setHeldNotice(err.message || 'That comment was held by moderation and was not published.');
        }
      },
    );
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-panel border border-line bg-midnight transition hover:border-line-strong">
      <button
        type="button"
        onClick={() => (playable ? onPromote({ ...post }) : undefined)}
        disabled={!playable}
        aria-label={playable ? `Watch ${post.videoTitle ?? post.content} on the stage` : undefined}
        className="group relative block aspect-video bg-black text-left"
      >
        {post.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.mediaUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : post.videoMp4 ? (
          <video src={`${post.videoMp4}#t=0.1`} preload="metadata" muted playsInline tabIndex={-1} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-faint">
            <Play size={28} />
          </span>
        )}
        {post.duration ? (
          <span className="num absolute right-2 bottom-2 rounded-chip bg-black/70 px-1.5 py-0.5 text-[10px] font-bold">
            {post.duration}
          </span>
        ) : null}
        {playable ? (
          <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100 group-focus-visible:bg-black/40 group-focus-visible:opacity-100">
            <span className="flex items-center gap-1.5 rounded-control bg-cyan px-3 py-1.5 text-xs font-bold text-deep">
              <Play size={12} fill="currentColor" /> Watch on the stage
            </span>
          </span>
        ) : null}
      </button>

      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <div className="flex items-start gap-2.5">
          {post.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.avatar} alt="" className="mt-0.5 h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-obsidian text-xs font-extrabold text-dim">
              {post.author.slice(0, 1)}
            </span>
          )}
          <div className="min-w-0">
            <div className="line-clamp-2 text-[13px] leading-snug font-bold">{post.videoTitle || post.content}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-dim">
              <span className="truncate">{post.productName || post.author}</span>
              {post.verified ? <BadgeCheck size={13} className="shrink-0 text-sky" aria-label="Official" /> : null}
              {post.views ? <span className="num shrink-0 text-faint">{post.views} views</span> : null}
              {age ? <span className="shrink-0 text-faint">{age}</span> : null}
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center gap-1 border-t border-line pt-2">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className={`flex items-center gap-1 rounded-control px-2 py-1.5 text-xs font-semibold transition hover:bg-obsidian ${
              liked ? 'text-cyan' : 'text-dim'
            }`}
          >
            <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
            <span className="num">{compact(upvotes)}</span>
          </button>
          <button
            type="button"
            onClick={openDrawer}
            aria-expanded={drawerOpen}
            className="flex items-center gap-1 rounded-control px-2 py-1.5 text-xs font-semibold text-dim transition hover:bg-obsidian"
          >
            <MessageSquare size={14} />
            {comments ? <span className="num">{comments.length}</span> : null}
            <ChevronDown size={12} className={`transition-transform ${drawerOpen ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onOpenGifts}
            title="Send a gift"
            className="flex items-center gap-1 rounded-control px-2 py-1.5 text-xs font-semibold text-dim transition hover:bg-obsidian"
          >
            <GiftIcon size={14} />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            title={saved ? 'Remove from saved' : 'Save for later'}
            className={`grid h-7 w-7 place-items-center rounded-control transition hover:bg-obsidian ${
              saved ? 'text-cyan' : 'text-dim'
            }`}
          >
            <Bookmark size={14} fill={saved ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            onClick={share}
            title="Copy a link to this post"
            className="grid h-7 w-7 place-items-center rounded-control text-dim transition hover:bg-obsidian"
          >
            <Share2 size={14} />
          </button>
        </div>

        {drawerOpen ? (
          <div className="border-t border-line pt-2.5">
            {heldNotice ? (
              <p className="mb-2 rounded-control border border-amber/40 bg-amber/10 px-2.5 py-2 text-xs text-amber">
                {heldNotice}
              </p>
            ) : null}
            {commentsLoading ? (
              <div className="space-y-2">
                <div className="skeleton h-3.5 w-3/4" />
                <div className="skeleton h-3.5 w-2/3" />
              </div>
            ) : comments && comments.length > 0 ? (
              <ul className="max-h-44 space-y-2 overflow-y-auto">
                {comments.map((c) => (
                  <li key={String(c.id)} className={`text-xs ${c.optimistic ? 'opacity-60' : ''}`}>
                    <span className="font-bold">{c.author}</span>{' '}
                    <span className="text-dim">{c.text}</span>
                    {c.flagged ? (
                      <span className="ml-1.5 rounded-full bg-amber/15 px-1.5 py-0.5 text-[10px] font-bold text-amber">
                        in review
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-faint">No comments yet. Start the thread.</p>
            )}
            <form onSubmit={submitComment} className="mt-2.5 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={signedIn ? 'Add a comment' : 'Sign in to comment'}
                aria-label="Add a comment"
                className="min-w-0 flex-1 rounded-control border border-line bg-base px-2.5 py-1.5 text-xs placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="rounded-control bg-obsidian px-2.5 py-1.5 text-xs font-bold transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-45"
              >
                Post
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </article>
  );
}
