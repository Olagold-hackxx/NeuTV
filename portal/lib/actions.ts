'use server';

// Every mutation the portal makes, as server actions. The pattern is the
// admin's: call the API, revalidate what changed, convert ApiError to a
// result, and never swallow redirect()'s control-flow throw.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { API_BASE, ApiError, SESSION_COOKIE, call } from './api';

export interface ActionResult {
  ok: boolean;
  error?: string;
  details?: unknown;
}

const fail = (err: unknown): ActionResult => {
  if (err instanceof ApiError) return { ok: false, error: err.message, details: err.details };
  throw err;
};

export async function signIn(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { ok: false, error: 'Email and password are required.' };

  try {
    const session = await call<{
      user: { role: string };
      session: { token: string; expiresAt: number };
    }>('/identity/signin', { method: 'POST', body: { email, password }, token: null, anonymous: true });

    // Anyone with a passport may sign in; the portal itself explains how to
    // become a creator. Only the role gate on the API decides what they can do.
    const store = await cookies();
    store.set(SESSION_COOKIE, session.session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(session.session.expiresAt),
    });
  } catch (err) {
    return fail(err);
  }
  redirect('/');
}

export async function signOut(): Promise<void> {
  try {
    await call('/identity/logout', { method: 'POST' });
  } catch {
    // Best effort; dropping the cookie is what matters.
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

export async function subscribeCreator(): Promise<ActionResult> {
  try {
    await call('/subscriptions', { method: 'POST', body: { plan: 'creator' } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function createVideo(_prev: ActionResult | null, form: FormData): Promise<ActionResult & { videoId?: string }> {
  const body: Record<string, unknown> = {
    title: String(form.get('title') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    productId: String(form.get('productId') ?? 'neutv'),
    kind: String(form.get('kind') ?? 'upload'),
  };
  const sourceUrl = String(form.get('sourceUrl') ?? '').trim();
  const youtubeId = String(form.get('youtubeId') ?? '').trim();
  if (sourceUrl) body.sourceUrl = sourceUrl;
  if (youtubeId) body.youtubeId = youtubeId;
  const duration = String(form.get('duration') ?? '').trim();
  if (duration) body.duration = duration;

  try {
    const res = await call<{ video: { id: string } }>('/creator/videos', { method: 'POST', body });
    revalidatePath('/publish');
    revalidatePath('/');
    return { ok: true, videoId: res.video.id };
  } catch (err) {
    return fail(err);
  }
}

export async function setVideoStatus(videoId: string, status: string): Promise<ActionResult> {
  try {
    await call(`/creator/videos/${encodeURIComponent(videoId)}`, { method: 'PUT', body: { status } });
    revalidatePath('/publish');
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function createLiveSession(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  try {
    await call('/creator/live', {
      method: 'POST',
      body: {
        title: String(form.get('title') ?? '').trim(),
        productId: String(form.get('productId') ?? 'neutv'),
        source: 'browser',
      },
    });
    revalidatePath('/publish');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function startLiveSession(eventId: string, transport?: 'segments' | 'whip'): Promise<ActionResult> {
  try {
    await call(`/creator/live/${encodeURIComponent(eventId)}/start`, {
      method: 'POST',
      body: transport ? { transport } : {},
    });
    revalidatePath('/publish');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function stopLiveSession(eventId: string): Promise<ActionResult> {
  try {
    await call(`/creator/live/${encodeURIComponent(eventId)}/stop`, { method: 'POST', body: {} });
    revalidatePath('/publish');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function acceptTask(taskId: string): Promise<ActionResult> {
  try {
    await call(`/creator/tasks/${encodeURIComponent(taskId)}/accept`, { method: 'POST', body: {} });
    revalidatePath('/tasks');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function deliverTask(taskId: string, videoId: string): Promise<ActionResult> {
  try {
    await call(`/creator/tasks/${encodeURIComponent(taskId)}/deliver`, { method: 'POST', body: { videoId } });
    revalidatePath('/tasks');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
