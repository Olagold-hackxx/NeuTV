export type SessionUser = {
  id: string;
  name: string;
  handle: string;
  role: 'viewer' | 'creator' | 'admin';
  avatar?: string;
  badge?: string;
  productId?: string;
};

export type CreatorVideo = {
  id: string;
  title: string;
  description: string;
  productId: string;
  kind: 'upload' | 'external';
  status: 'draft' | 'ready' | 'published' | 'archived';
  durationSeconds: number;
  posterUrl: string | null;
  youtubeId: string | null;
  playbackUrl: string | null;
  hasFile: boolean;
  createdAt: number;
  updatedAt: number;
};

export type LiveSession = {
  id: string;
  title: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  scope: string;
  source: 'external' | 'browser';
  transport: 'segments' | 'whip' | null;
  whipUrl: string | null;
  ingestUrl: string | null;
  streamKey: string | null;
  playbackUrl: string | null;
  startedAt: number | null;
  endedAt: number | null;
  isLive: boolean;
  createdAt: number;
};

export type CreatorTask = {
  id: string;
  title: string;
  brief: string;
  productId: string;
  bounty: number;
  deadline: number | null;
  status: 'open' | 'accepted' | 'delivered' | 'approved' | 'rejected';
  assigneeId: string | null;
  deliveryVideoId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type LedgerEntry = {
  id: string;
  transactionId: string;
  amount: number;
  kind: string;
  memo: string;
  createdAt: number;
};

export type SubscriptionStatus = {
  plans: Record<'viewer' | 'creator', { active: boolean; expiresAt: number | null; cost: number }>;
  at: number;
};
