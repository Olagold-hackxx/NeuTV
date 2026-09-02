// Server-side client for the creators portal. Same architecture as the
// admin's: the session token lives in an httpOnly cookie, every read is a
// server component, every write a server action, and the API base never
// reaches the browser.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { CreatorTask, CreatorVideo, LedgerEntry, LiveSession, SessionUser, SubscriptionStatus } from './types';

export const API_BASE = process.env.NEUTV_API_BASE ?? 'http://localhost:4173';
// Distinct from the admin's cookie so the two apps never clobber each other
// on a shared domain.
export const SESSION_COOKIE = 'neutv_creator_session';

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
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
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
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, `The NEU Network API at ${API_BASE} could not be reached. Check that it is running, then reload.`, 'api_unreachable');
  }

  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError(res.status, `The API answered with something that is not JSON (${res.status}).`, 'bad_response');
  }

  if (!res.ok) {
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

// --- reads ----------------------------------------------------------------

export const getMyVideos = () => call<{ videos: CreatorVideo[]; total: number }>('/creator/videos');
export const getMyLive = () => call<{ events: LiveSession[] }>('/creator/live');
export const getMyTasks = () => call<{ tasks: CreatorTask[] }>('/creator/tasks');
export const getBalance = () => call<{ balance: number }>('/wallet');
export const getLedger = (limit = 20) => call<{ balance: number; entries: LedgerEntry[] }>(`/wallet/ledger?limit=${limit}`);
export const getSubscriptions = () => call<SubscriptionStatus>('/subscriptions/me');
export const getProducts = () => call<{ products: { id: string; name: string }[] }>('/catalog/products', { anonymous: true });
