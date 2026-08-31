'use client';

// Browser client for the NEU TV API — a typed port of frontend/src/neutv-api.js.
// Keeps a session token and a stable anonymous viewer id in localStorage, so
// the stage remembers what a returning viewer was watching.

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const TOKEN_KEY = 'neutv.session.token';
const VIEWER_KEY = 'neutv.viewer.id';

// localStorage throws in some privacy modes; the client must never be the
// reason the page fails to render.
function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}
function clearStore(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

type SessionResponse = {
  user: { id: string; name: string; avatar?: string; badge?: string };
  session?: { token: string };
};

export type SseHandlers = Partial<
  Record<'comment' | 'reaction' | 'gift' | 'chat' | 'stage' | 'telemetry' | 'live-event', (payload: never) => void>
> & { [type: string]: ((payload: any) => void) | undefined };

export class NeuTVClient {
  private base: string;
  private origin: string;
  private token: string | null;

  constructor(apiBase: string) {
    this.origin = apiBase;
    this.base = apiBase + '/api/v1';
    this.token = typeof window === 'undefined' ? null : readStore(TOKEN_KEY);
  }

  viewerId(): string {
    let id = readStore(VIEWER_KEY);
    if (!id) {
      // Must satisfy the server's ^[A-Za-z0-9_-]{4,64}$.
      id = 'v' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      writeStore(VIEWER_KEY, id);
    }
    return id;
  }

  isSignedIn(): boolean {
    return Boolean(this.token);
  }

  private async request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.token && auth) headers.authorization = `Bearer ${this.token}`;
    const res = await fetch(this.base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const parsed = text ? JSON.parse(text) : null;
    if (res.ok) return parsed as T;
    // A dead session should sign the viewer out rather than 401 forever.
    if (res.status === 401 && this.token) {
      this.token = null;
      clearStore(TOKEN_KEY);
    }
    throw new ApiError(
      parsed?.error?.message ?? `HTTP ${res.status}`,
      res.status,
      parsed?.error?.code,
      parsed?.error?.details,
    );
  }

  private get<T>(path: string, auth = true) {
    return this.request<T>('GET', path, undefined, auth);
  }
  private post<T>(path: string, body: unknown = {}, auth = true) {
    return this.request<T>('POST', path, body, auth);
  }

  private keepSession(res: SessionResponse): SessionResponse {
    if (res?.session?.token) {
      this.token = res.session.token;
      writeStore(TOKEN_KEY, this.token);
    }
    return res;
  }

  // --- identity ---
  sso(productId: string, username: string, password: string) {
    return this.post<SessionResponse>('/identity/sso', { productId, username, password }, false).then((r) =>
      this.keepSession(r),
    );
  }
  signup(form: { name: string; email: string; password: string; platform: string }) {
    return this.post<SessionResponse>('/identity/signup', form, false).then((r) => this.keepSession(r));
  }
  signin(email: string, password: string) {
    return this.post<SessionResponse>('/identity/signin', { email, password }, false).then((r) =>
      this.keepSession(r),
    );
  }
  me() {
    return this.get<{ user: SessionResponse['user'] }>('/identity/me');
  }
  async logout() {
    try {
      await this.post('/identity/logout');
    } finally {
      this.token = null;
      clearStore(TOKEN_KEY);
    }
  }

  // --- wallet ---
  balance() {
    return this.get<{ balance: number }>('/wallet');
  }
  gifts() {
    return this.get<{ gifts: import('./types').Gift[] }>('/wallet/gifts', false);
  }
  // reference makes a retry safe: the same gift is never charged twice.
  tip(giftId: string, target: { type: string; id: string }) {
    return this.post<{ balance: number }>('/wallet/tip', {
      giftId,
      target,
      reference: `${giftId}-${target.type}-${target.id}-${Date.now()}`,
    });
  }

  // --- social ---
  upvote(postId: string) {
    return this.post<{ upvotes: number; isUpvoted: boolean }>(`/social/posts/${encodeURIComponent(postId)}/upvote`);
  }
  save(postId: string) {
    return this.post<{ isSaved: boolean }>(`/social/posts/${encodeURIComponent(postId)}/save`);
  }
  share(postId: string) {
    return this.post<{ shares: number }>(`/social/posts/${encodeURIComponent(postId)}/share`, {
      origin: window.location.origin,
    });
  }
  comments(postId: string) {
    return this.get<{ comments: import('./types').PostComment[] }>(
      `/social/posts/${encodeURIComponent(postId)}/comments`,
    );
  }
  comment(postId: string, text: string) {
    return this.post<{ comment: import('./types').PostComment }>(
      `/social/posts/${encodeURIComponent(postId)}/comments`,
      { text },
    );
  }

  // --- live ---
  liveState() {
    return this.get<{
      stage: {
        current?: Record<string, unknown>;
        mainBroadcast?: Record<string, unknown>;
        revertsTo?: Record<string, unknown>;
        isOverride?: boolean;
      };
      telemetry?: { baselineViewers?: number };
      likes?: { seeded: number; total: number; liked: boolean };
    }>(`/live/state?viewerId=${this.viewerId()}`);
  }
  liveEvent() {
    return this.get<{ event: import('./types').LiveEvent | null }>('/live-event/current', false);
  }
  takeStage(videoId: string, durationMs?: number) {
    return this.post('/live/stage', { videoId, viewerId: this.viewerId(), scope: 'viewer', durationMs });
  }
  revertStage() {
    return this.post('/live/stage/revert', { viewerId: this.viewerId(), scope: 'viewer' });
  }
  likeTv() {
    return this.post<{ likes?: number; total?: number; liked?: boolean }>('/live/tv/like', {
      viewerId: this.viewerId(),
    });
  }
  liveComment(text: string) {
    return this.post<{ comment?: import('./types').LiveComment }>('/live/comments', { text });
  }
  react(emoji: string) {
    return this.post('/live/reactions', { emoji });
  }
  chat(serverId: string, channelId: string) {
    return this.get<{ messages: ChatMessage[] }>(
      `/live/chat/${encodeURIComponent(serverId)}/${encodeURIComponent(channelId)}`,
    );
  }
  sendChat(serverId: string, channelId: string, text: string) {
    return this.post<{ message?: ChatMessage }>(
      `/live/chat/${encodeURIComponent(serverId)}/${encodeURIComponent(channelId)}`,
      { text },
    );
  }
  leaderboard() {
    return this.get<{ leaderboard: import('./types').LeaderboardRow[] }>('/live/leaderboard', false);
  }
  presence() {
    return this.post('/live/presence', { viewerId: this.viewerId() });
  }

  // Heartbeat that keeps this viewer inside the live count.
  startPresence(intervalMs = 20000): () => void {
    const tick = () => this.presence().catch(() => {});
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }

  // Subscribe to the broadcast event stream. EventSource reconnects on its own
  // (~3s); that is deliberate — it carries a viewer across an API deploy.
  subscribe(handlers: SseHandlers): () => void {
    const source = new EventSource(`${this.origin}/api/v1/live/stream`);
    for (const type of Object.keys(handlers)) {
      const handler = handlers[type];
      if (!handler) continue;
      source.addEventListener(type, (event) => {
        try {
          handler(JSON.parse((event as MessageEvent).data));
        } catch {
          /* a bad frame must not kill the stream */
        }
      });
    }
    return () => source.close();
  }

  // An uploaded video's playbackUrl is "/media/<file>" — relative to the API
  // host, not this page.
  absoluteMedia(url: string | null | undefined): string | null {
    if (!url) return null;
    if (/^https?:\/\//.test(url) || url.startsWith('//')) return url;
    return url.startsWith('/') ? this.origin + url : url;
  }
}

export type ChatMessage = {
  id: string | number;
  author: string;
  role?: string;
  avatar?: string;
  timestamp?: string;
  text: string;
  flagged?: boolean;
  optimistic?: boolean;
};

// Optimistic-then-reconcile: mutate local state first, call the server, and on
// a result let the server's values win. A thrown ApiError reaches onError and
// resolves null — it never rethrows into a React handler.
export async function sync<T>(fn: () => Promise<T>, onError?: (err: ApiError) => void): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      onError?.(err);
    } else {
      onError?.(new ApiError(err instanceof Error ? err.message : 'Request failed', 0));
    }
    return null;
  }
}
