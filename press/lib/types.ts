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

export type PressApplication = {
  userId: string;
  outlet: string;
  title: string;
  beat: string;
  website: string | null;
  note: string;
  status: 'pending' | 'verified' | 'rejected' | 'revoked';
  card: { id: string; issuedAt: number; expiresAt: number } | null;
  reviewedAt: number | null;
  createdAt: number;
  updatedAt: number;
  name?: string;
  handle?: string;
  avatar?: string;
  role?: Role;
};

export type PressStatus = {
  application: PressApplication | null;
  press: boolean;
  cardValid?: boolean;
  at: number;
};

export type PressEvent = {
  id: string;
  title: string;
  description: string;
  productId: string;
  status: 'scheduled' | 'live';
  scheduledFor: number | null;
  startedAt: number | null;
  posterUrl: string | null;
  isLive: boolean;
  access: 'press';
};

export type ViewersChoice = {
  quarter: string;
  prize: number;
  totalVotes: number;
  sharePct: number;
};
