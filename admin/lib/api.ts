// Server-side API client.
//
// Every call to the NEU TV backend happens here, on the server, reading the
// session token from an httpOnly cookie. The admin token is never handed to the
// browser: an admin session can set the main broadcast and read the whole
// viewer roster, so keeping it out of reach of any script on the page is worth
// the extra hop.
//
// This is the one place that knows the backend exists.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type {
  CrmOverview, LiveEvent, ModerationItem, Product, ProgrammeState, SessionUser, Video,
} from './types';

export const API_BASE = process.env.NEUTV_API_BASE ?? 'http://localhost:4173';
export const SESSION_COOKIE = 'neutv_admin_session';

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function getToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

interface CallOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Skip the redirect-to-login on 401. Used by the login page itself. */
  anonymous?: boolean;
}

export async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = options;
  const token = options.token !== undefined ? options.token : await getToken();

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      // The back office must never show a stale roster or a stale programme.
      cache: 'no-store',
    });
  } catch {
    // A connection failure is not a response. Without this it surfaces as a
    // bare "fetch failed" TypeError, which the error boundary can only render
    // as a mystery. Name the actual problem instead.
    throw new ApiError(
      0,
      `The NEU TV API at ${API_BASE} could not be reached. Check that it is running, then reload.`,
      'api_unreachable',
    );
  }

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // A proxy or crash page answered instead of the API.
    throw new ApiError(res.status, `The API answered with something that is not JSON (${res.status}).`, 'bad_response');
  }

  if (!res.ok) {
    // An expired or revoked session sends the operator back to the login form
    // rather than rendering a page full of error states.
    if ((res.status === 401 || res.status === 403) && !anonymous) redirect('/login');
    throw new ApiError(
      res.status,
      parsed?.error?.message ?? `Request failed (${res.status})`,
      parsed?.error?.code,
      parsed?.error?.details,
    );
  }
  return parsed as T;
}

// --- reads ----------------------------------------------------------------

export const getSession = async (): Promise<SessionUser | null> => {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await call<{ user: SessionUser }>('/identity/me', { token, anonymous: true });
    return res.user;
  } catch {
    return null;
  }
};

export const getOverview = () => call<CrmOverview>('/admin/crm/overview');
export const getVideos = (query = '') => call<{ videos: Video[]; total: number }>(`/admin/videos${query}`);
export const getVideo = (id: string) => call<{ video: Video }>(`/admin/videos/${encodeURIComponent(id)}`);
export const getProgramme = () => call<ProgrammeState>('/admin/programme');
export const getViewers = () => call<{ viewers: Viewer[] }>('/admin/crm/viewers');
export const getModerationQueue = () => call<{ queue: ModerationItem[] }>('/admin/crm/moderation');
export const getProducts = () => call<{ products: Product[] }>('/catalog/products');
export const getLiveEvents = () => call<{ events: LiveEvent[] }>('/admin/live-events');
export const getLiveEvent = (id: string) => call<{ event: LiveEvent }>(`/admin/live-events/${encodeURIComponent(id)}`);

// Re-exported so pages import their types from one place.
import type { Viewer } from './types';
export type { Viewer };
