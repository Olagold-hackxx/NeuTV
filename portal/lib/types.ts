export type Role = 'viewer' | 'creator' | 'press' | 'admin';

export type SessionUser = {
  id: string;
  name: string;
  handle: string;
  role: Role;
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

// --- decoder channels and the viewers choice --------------------------------

export type DecoderChannel = {
  number: number;
  ownerId: string;
  name: string;
  tagline: string;
  price: number;
  createdAt: number;
  updatedAt: number;
};

export type MyChannel = {
  channel: DecoderChannel | null;
  price: number;
  floor: number;
  ceiling: number;
  nextFree: number | null;
  taken: number[];
};

export type Standing = {
  rank: number;
  userId: string;
  name: string;
  handle: string;
  avatar?: string;
  votes: number;
  channelNumber: number | null;
};

export type ViewersChoice = {
  quarter: string;
  startsAt: number;
  endsAt: number;
  sharePct: number;
  revenue: number;
  prize: number;
  totalVotes: number;
  standings: Standing[];
  myVote: string | null;
  lastAward: { quarter: string; winner: { name: string; handle: string } | null; votes: number; prize: number } | null;
};
