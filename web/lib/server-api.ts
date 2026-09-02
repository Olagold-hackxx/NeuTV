import type { AppData, Bootstrap, Post, Video } from './types';
import { mmss } from './format';

// Server-side base: reaches the gateway directly. The browser client gets the
// same value through the page props.
const API_BASE = process.env.NEUTV_API_BASE ?? 'http://localhost:4173';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json() as Promise<T>;
}

function absoluteMedia(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//.test(url) || url.startsWith('//')) return url;
  return url.startsWith('/') ? API_BASE + url : url;
}

// A published library video rendered as an announcements-feed card. Nothing is
// invented: a fresh video has no views and shows none.
function toFeedPost(video: Video, products: Bootstrap['PRODUCTS']): Post {
  const product = products.find((p) => p.id === video.productId);
  const isYouTube = Boolean(video.youtubeId);
  return {
    id: video.id,
    author: 'NEU TV',
    handle: '@neutv',
    avatar: products.find((p) => p.id === 'neutv')?.logo ?? product?.logo ?? undefined,
    verified: true,
    productId: video.productId,
    productName: product?.name ?? video.productId,
    role: 'NEU TV Library',
    content: video.description || video.title,
    videoTitle: video.title,
    duration: mmss(video.durationSeconds),
    videoMp4: isYouTube ? null : absoluteMedia(video.playbackUrl),
    youtubeId: video.youtubeId ?? null,
    mediaUrl: video.posterUrl || null,
    createdAt: video.createdAt,
    fromLibrary: true,
  };
}

// The seed addresses the old frontend's asset folder; this app serves the
// same files from /logos. Oversized inline images (the seed embeds one avatar
// as a 146KB base64 PNG, twelve times) are dropped so the page does not ship
// megabytes of duplicated data URI — the UI renders its initial-letter
// fallback instead.
function sanitizeAssets<T>(value: T): T {
  if (typeof value === 'string') {
    if (value.startsWith('./assets/logos/')) return value.replace('./assets/logos/', '/logos/') as T;
    if (value.startsWith('data:') && value.length > 20_000) return undefined as T;
    return value;
  }
  if (Array.isArray(value)) return value.map(sanitizeAssets) as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeAssets(v);
    return out as T;
  }
  return value;
}

// There is no bundled fallback catalog, deliberately: a dead backend must not
// look like a healthy one. On failure the page renders the offline state.
export async function loadAppData(): Promise<AppData | null> {
  let bootstrap: Bootstrap;
  try {
    bootstrap = await getJson<Bootstrap>('/catalog/bootstrap');
  } catch {
    return null;
  }

  // The library is what the back office publishes; losing it is not fatal.
  let videos: Video[] = [];
  try {
    ({ videos } = await getJson<{ videos: Video[] }>('/videos?limit=200'));
  } catch {
    videos = [];
  }

  // Real creator channels for the spotlight rail. Also non-fatal: the seeded
  // editorial cards still fill the rail on a fresh install.
  let creatorSpotlights: import('./types').Spotlight[] = [];
  try {
    ({ spotlights: creatorSpotlights } = await getJson<{ spotlights: import('./types').Spotlight[] }>(
      '/creators/spotlights',
    ));
  } catch {
    creatorSpotlights = [];
  }

  // Only the slices the screen renders cross to the client — the raw
  // bootstrap carries several unrendered collections that would otherwise be
  // serialized twice (HTML + flight data).
  const trimmed: Bootstrap = sanitizeAssets({
    checksum: bootstrap.checksum,
    PRODUCTS: bootstrap.PRODUCTS ?? [],
    PRODUCT_COMMUNITY_HUBS: bootstrap.PRODUCT_COMMUNITY_HUBS ?? {},
    INITIAL_CENTRAL_TV: bootstrap.INITIAL_CENTRAL_TV,
    INITIAL_POSTS: bootstrap.INITIAL_POSTS ?? [],
    SAMPLE_LIVE_COMMENTS: bootstrap.SAMPLE_LIVE_COMMENTS ?? [],
    CREATOR_SPOTLIGHTS: bootstrap.CREATOR_SPOTLIGHTS ?? [],
    SCHEDULE_ITEMS: bootstrap.SCHEDULE_ITEMS ?? [],
  });

  return {
    bootstrap: trimmed,
    libraryPosts: sanitizeAssets(videos.map((v) => toFeedPost(v, bootstrap.PRODUCTS ?? []))),
    creatorSpotlights: sanitizeAssets(creatorSpotlights),
    // What the *browser* should call. In production the public hostname can
    // differ from the address this server render used.
    apiBase: process.env.NEXT_PUBLIC_NEUTV_API_BASE ?? API_BASE,
    now: Date.now(),
  };
}
