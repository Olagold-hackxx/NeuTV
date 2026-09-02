// Shapes returned by the NEU TV API (contract 2.0.0).
//
// Hand-written rather than generated: the backend has no TypeScript to generate
// from, and a wrong type here shows up immediately as a compile error against
// the pages that use it.

export type VideoStatus = 'draft' | 'ready' | 'published' | 'archived';

export interface Video {
  id: string;
  title: string;
  description: string;
  productId: string;
  kind: 'upload' | 'external';
  status: VideoStatus;
  durationSeconds: number;
  posterUrl: string | null;
  youtubeId: string | null;
  playbackUrl: string | null;
  fileSize: number | null;
  contentType: string | null;
  hasFile: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * What an edit may change.
 *
 * Not `Partial<Video>`: a video is read with a resolved `playbackUrl` and
 * written with the thing behind it, and the two are not the same field. Sending
 * `kind`, `sourceUrl` or `youtubeId` replaces the playback source outright -
 * the API keeps exactly one, so a swapped URL cannot lose to a stale YouTube id.
 */
export interface VideoPatch {
  title?: string;
  description?: string;
  productId?: string;
  status?: VideoStatus;
  kind?: 'upload' | 'external';
  sourceUrl?: string;
  youtubeId?: string;
  posterUrl?: string;
  /** "04:12" or "1:02:33", as it is typed into the form. */
  duration?: string;
  durationSeconds?: number;
}

export interface Programme {
  videoId: string;
  setBy: string;
  setAt: number;
  note: string;
}

export interface ProgrammeState {
  programme: Programme | null;
  video: Video | null;
  source: 'admin' | 'unset';
  history?: Array<{ id: string; videoId: string; setBy: string; setAt: number; note: string }>;
}

export interface CrmOverview {
  generatedAt: number;
  library: { total: number; published: number; drafts: number; archived: number; storedBytes: number };
  programme: ProgrammeState;
  viewers: { total: number; newLast7d: number; admins: number; byProduct: Record<string, number>; activeSessions: number } | null;
  spend: { coinsSpent: number; gifts: number; coinsIssued: number; ledgerBalanced: boolean } | null;
  moderation: { allow: number; flag: number; block: number; rulesetVersion: string } | null;
  engagement: { posts: number; comments: number; upvotes: number; flagged: number } | null;
}

export interface Viewer {
  id: string;
  name: string;
  handle: string;
  badge: string;
  productId: string;
  role: 'viewer' | 'creator' | 'admin';
  authMethod: 'sso' | 'password';
  verified: boolean;
  createdAt: number;
  coinsSpent: number;
  gifts: number;
}

export interface ModerationItem {
  id: string;
  surface: 'post' | 'comment' | 'live_comment' | 'chat' | 'profile';
  userId: string | null;
  verdict: 'flag' | 'block';
  score: number;
  ruleIds: string[];
  excerpt: string;
  decidedAt: number;
}

export interface Product {
  id: string;
  name: string;
  badge: string;
  logo: string;
  officialUrl: string;
}

export interface SessionUser {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  badge: string;
  productId: string;
  role: 'viewer' | 'creator' | 'admin';
  authMethod: 'sso' | 'password';
  verified: boolean;
}

export type LiveEventStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';

/** What an admin sees. Carries ingest credentials; never render it publicly. */
export interface LiveEvent {
  id: string;
  title: string;
  description: string;
  productId: string;
  status: LiveEventStatus;
  source: 'external' | 'browser';
  driver: 'manual' | 'mux' | 'cloudflare';
  ingestUrl: string | null;
  whipUrl: string | null;
  streamKey: string;
  playbackUrl: string | null;
  youtubeId: string | null;
  posterUrl: string | null;
  scheduledFor: number | null;
  startedAt: number | null;
  endedAt: number | null;
  peakViewers: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  isLive: boolean;
}

export interface MagazineIssue {
  id: string;
  title: string;
  description: string;
  issueNumber: number | null;
  coverUrl: string | null;
  fileUrl: string | null;
  status: 'draft' | 'published' | 'archived';
  publishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}
