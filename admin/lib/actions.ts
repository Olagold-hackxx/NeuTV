'use server';

// Mutations. Server actions so the admin token never leaves the server, and so
// every write is followed by an explicit revalidate - a back office that shows
// a stale programme after you changed it is worse than one that is slow.

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError, call, SESSION_COOKIE } from './api';
import type { LiveEvent, SessionUser, Video, VideoPatch } from './types';

export interface ActionResult {
  ok: boolean;
  error?: string;
  details?: unknown;
}

const fail = (err: unknown): ActionResult => {
  if (err instanceof ApiError) return { ok: false, error: err.message, details: err.details };
  // A redirect() inside an action throws a control-flow signal; never swallow it.
  throw err;
};

export async function signIn(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { ok: false, error: 'Email and password are required.' };

  let session: { session: { token: string; expiresAt: number }; user: SessionUser };
  try {
    session = await call('/identity/signin', {
      method: 'POST', body: { email, password }, token: null, anonymous: true,
    });
  } catch (err) {
    return fail(err);
  }

  // The back office is admin-only. Signing in with a viewer account has to fail
  // here, not on the first page that happens to call an admin route.
  if (session.user.role !== 'admin') {
    return { ok: false, error: 'That account does not have back-office access.' };
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, session.session.token, {
    httpOnly: true,                                   // no script can read it
    sameSite: 'lax',                                  // survives a normal nav, not a cross-site POST
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(session.session.expiresAt),
  });
  redirect('/');
}

export async function signOut(): Promise<void> {
  try {
    await call('/identity/logout', { method: 'POST' });
  } catch {
    // Revoking server-side is best effort; dropping the cookie is what matters.
  }
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}

export async function createVideo(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const kind = String(form.get('kind') ?? 'upload') as 'upload' | 'external';
  const body: Record<string, unknown> = {
    title: String(form.get('title') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    productId: String(form.get('productId') ?? 'worldstreet'),
    kind,
  };
  const duration = String(form.get('duration') ?? '').trim();
  if (duration) body.duration = duration;
  const poster = String(form.get('posterUrl') ?? '').trim();
  if (poster) body.posterUrl = poster;
  if (kind === 'external') {
    const source = String(form.get('sourceUrl') ?? '').trim();
    const youtube = String(form.get('youtubeId') ?? '').trim();
    if (source) body.sourceUrl = source;
    if (youtube) body.youtubeId = youtube;
    if (!source && !youtube) return { ok: false, error: 'An external video needs a source URL or a YouTube id.' };
  }

  try {
    const res = await call<{ video: Video }>('/admin/videos', { method: 'POST', body });
    revalidatePath('/videos');
    revalidatePath('/');
    return { ok: true, details: res.video };
  } catch (err) {
    return fail(err);
  }
}

export async function updateVideo(id: string, patch: VideoPatch): Promise<ActionResult> {
  try {
    const res = await call<{ video: Video }>(`/admin/videos/${encodeURIComponent(id)}`, { method: 'PUT', body: patch });
    revalidatePath('/videos');
    revalidatePath(`/videos/${id}`);
    // A published video is on the viewer app's shelves, and the one on air is on
    // its front page, so an edit has to invalidate more than this section.
    revalidatePath('/', 'layout');
    return { ok: true, details: res.video };
  } catch (err) {
    return fail(err);
  }
}

export async function archiveVideo(id: string): Promise<ActionResult> {
  try {
    await call(`/admin/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
    revalidatePath('/videos');
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function setProgramme(videoId: string, note = ''): Promise<ActionResult> {
  try {
    await call('/admin/programme', { method: 'PUT', body: { videoId, note } });
    // The main broadcast is on every page's header, so revalidate broadly.
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}


// --- live events ------------------------------------------------------------

export async function scheduleLiveEvent(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const body: Record<string, unknown> = {
    title: String(form.get('title') ?? '').trim(),
    description: String(form.get('description') ?? '').trim(),
    productId: String(form.get('productId') ?? 'worldstreet'),
    source: String(form.get('source') ?? 'browser'),
  };
  const playback = String(form.get('playbackUrl') ?? '').trim();
  const poster = String(form.get('posterUrl') ?? '').trim();
  if (playback) body.playbackUrl = playback;
  if (poster) body.posterUrl = poster;

  try {
    const res = await call<{ event: LiveEvent; instructions: string }>('/admin/live-events', { method: 'POST', body });
    revalidatePath('/live');
    revalidatePath('/');
    return { ok: true, details: res.event };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Edit an event that is not on air: how it is fed, and where viewers watch.
 *
 * The panel used to render the playback URL read-only while telling the
 * operator to add one, and `source` was fixed at creation - so an event
 * scheduled as external with no URL could neither start nor be repaired.
 */
export async function updateLiveEvent(
  id: string,
  patch: { source?: 'browser' | 'external'; playbackUrl?: string; title?: string; posterUrl?: string },
): Promise<ActionResult> {
  try {
    const res = await call<{ event: LiveEvent }>(`/admin/live-events/${encodeURIComponent(id)}`, {
      method: 'PUT', body: patch,
    });
    revalidatePath('/live');
    revalidatePath('/', 'layout');
    return { ok: true, details: res.event };
  } catch (err) {
    return fail(err);
  }
}

/** Going on air changes what every viewer is watching, so revalidate broadly. */
export async function startLiveEvent(id: string): Promise<ActionResult> {
  try {
    await call(`/admin/live-events/${encodeURIComponent(id)}/start`, { method: 'POST', body: {} });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function stopLiveEvent(id: string): Promise<ActionResult> {
  try {
    await call(`/admin/live-events/${encodeURIComponent(id)}/stop`, { method: 'POST', body: {} });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function rotateStreamKey(id: string): Promise<ActionResult> {
  try {
    await call(`/admin/live-events/${encodeURIComponent(id)}/rotate`, { method: 'POST', body: {} });
    revalidatePath('/live');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelLiveEvent(id: string): Promise<ActionResult> {
  try {
    await call(`/admin/live-events/${encodeURIComponent(id)}`, { method: 'DELETE' });
    revalidatePath('/live');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
