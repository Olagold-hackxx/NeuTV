// Shapes served by the NEU TV API. The catalog seed is the source of truth for
// the editorial types; the live/wallet/social types mirror the v1 contract.

export type Product = {
  id: string;
  name: string;
  logo?: string | null;
  badge?: string;
  officialUrl?: string;
};

export type HubChannel = {
  id: string;
  name: string;
  topic?: string;
  activeNow?: number;
};

export type CommunityHub = {
  name: string;
  tagline?: string;
  memberCount?: string;
  officialUrl?: string;
  perks?: string[];
  admins?: { name: string }[];
  channels: HubChannel[];
};

export type CentralTv = {
  id?: string;
  title: string;
  description?: string;
  product?: string;
  productId?: string;
  streamer?: string;
  streamerRole?: string;
  avatar?: string;
  posterUrl?: string;
  videoUrl?: string | null;
  youtubeId?: string | null;
  isLive?: boolean;
  viewers?: number;
  likes?: number;
};

export type Post = {
  id: string;
  author: string;
  handle?: string;
  avatar?: string;
  role?: string;
  verified?: boolean;
  productId?: string;
  productName?: string;
  timestamp?: string;
  createdAt?: number;
  content?: string;
  videoTitle?: string;
  mediaUrl?: string | null;
  videoMp4?: string | null;
  youtubeId?: string | null;
  duration?: string;
  views?: string | number;
  upvotes?: number;
  shares?: number;
  isUpvoted?: boolean;
  isSaved?: boolean;
  comments?: PostComment[];
  fromLibrary?: boolean;
};

export type PostComment = {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  timestamp?: string;
  flagged?: boolean;
  optimistic?: boolean;
};

export type Spotlight = {
  id: string;
  name: string;
  handle?: string;
  avatar?: string;
  followers?: string;
  product?: string;
  productId?: string;
  tag?: string;
  title: string;
  thumbnail?: string;
  videoUrl?: string | null; // a YouTube id in the seed, despite the name
  videoMp4?: string | null;
  views?: string;
  duration?: string;
  // Real creator channels, served by /creators/spotlights.
  creator?: boolean;
  isLive?: boolean;
  liveEventId?: string | null;
  liveTransport?: 'segments' | 'whip' | null;
  livePlaybackUrl?: string | null;
};

export type ScheduleItem = {
  id?: string;
  time: string;
  title: string;
  durationLabel?: string;
  isCurrent?: boolean;
};

export type LiveComment = {
  id: string | number;
  author: string;
  avatar?: string;
  badge?: string;
  text: string;
  flagged?: boolean;
  optimistic?: boolean;
};

export type Gift = {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  label?: string;
};

export type Video = {
  id: string;
  title: string;
  description?: string;
  productId?: string;
  durationSeconds?: number;
  posterUrl?: string;
  transport?: 'segments' | 'whip' | null;
  playbackUrl?: string | null;
  youtubeId?: string | null;
  createdAt?: number;
};

export type LiveEvent = {
  id: string;
  title: string;
  description?: string;
  productId?: string;
  posterUrl?: string;
  transport?: 'segments' | 'whip' | null;
  playbackUrl?: string | null;
  youtubeId?: string | null;
  source?: 'browser' | 'external' | string;
  isLive?: boolean;
  status?: string;
};

// What this viewer's stage is showing. mainBroadcast is what a takeover
// reverts to; the server owns all three of these.
export type StageCard = {
  id?: string;
  title: string;
  description?: string;
  youtubeId?: string | null;
  videoUrl?: string | null;
  posterUrl?: string | null;
  productId?: string;
  productName?: string;
  viewers?: number;
  likes?: number;
  isTakeover?: boolean;
  isLiveEvent?: boolean;
  isSegmented?: boolean;
  // Set when the takeover is creator content: gifts sent while watching it
  // target the creator, so the 70/30 split pays them.
  creatorHandle?: string;
};

export type SessionUser = {
  id: string;
  name: string;
  avatar?: string;
  badge?: string;
};

export type LeaderboardRow = {
  name?: string;
  sender?: string;
  userId?: string;
  coins?: number;
  total?: number;
  gifts?: number;
};

export type Bootstrap = {
  checksum?: string;
  PRODUCTS: Product[];
  PRODUCT_COMMUNITY_HUBS: Record<string, CommunityHub>;
  INITIAL_CENTRAL_TV: CentralTv;
  INITIAL_POSTS: Post[];
  SAMPLE_LIVE_COMMENTS: LiveComment[];
  CREATOR_SPOTLIGHTS: Spotlight[];
  SCHEDULE_ITEMS: ScheduleItem[];
  TRENDING_TOPICS?: { tag: string; posts?: string }[];
};

// The one prop the server page hands the client app.
export type AppData = {
  bootstrap: Bootstrap;
  libraryPosts: Post[];
  // Live creator channels and their latest published work, ahead of the
  // seeded editorial cards in the rail.
  creatorSpotlights: Spotlight[];
  apiBase: string;
  now: number;
};
