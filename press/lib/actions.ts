'use server';

// Every mutation the press portal makes, as server actions: sign in, sign
// out, and the application itself. Verification is the back office's.

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ApiError, SESSION_COOKIE, call } from './api';

export interface ActionResult {
  ok: boolean;
  error?: string;
  details?: unknown;
}

const fail = (err: unknown): ActionResult => {
  if (err instanceof ApiError) return { ok: false, error: err.message, details: err.details };
  throw err;
};

const keep = async (session: { token: string; expiresAt: number }) => {
  const store = await cookies();
  store.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(session.expiresAt),
  });
};

export async function signIn(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { ok: false, error: 'Email and password are required.' };
  try {
    const res = await call<{ session: { token: string; expiresAt: number } }>(
      '/identity/signin', { method: 'POST', body: { email, password }, token: null, anonymous: true },
    );
    await keep(res.session);
  } catch (err) {
    return fail(err);
  }
  redirect('/');
}

export async function signUp(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { ok: false, error: 'Email and password are required.' };
  try {
    const res = await call<{ session: { token: string; expiresAt: number } }>(
      '/identity/signup', { method: 'POST', body: { name, email, password, platform: 'neutv' }, token: null, anonymous: true },
    );
    await keep(res.session);
  } catch (err) {
    return fail(err);
  }
  redirect('/accreditation');
}

export async function signInSso(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const productId = String(form.get('productId') ?? '').trim();
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  if (!productId || !username || !password) {
    return { ok: false, error: 'Product, username and password are all required.' };
  }
  try {
    const res = await call<{ session: { token: string; expiresAt: number } }>(
      '/identity/sso', { method: 'POST', body: { productId, username, password }, token: null, anonymous: true },
    );
    await keep(res.session);
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

export async function applyPress(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const body: Record<string, unknown> = {
    outlet: String(form.get('outlet') ?? '').trim(),
    title: String(form.get('title') ?? '').trim(),
    beat: String(form.get('beat') ?? '').trim(),
    note: String(form.get('note') ?? '').trim(),
  };
  const website = String(form.get('website') ?? '').trim();
  if (website) body.website = website;
  if (!body.outlet || !body.title) return { ok: false, error: 'Your outlet and your title are both required.' };
  try {
    await call('/press/apply', { method: 'POST', body });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}
