// Small JSON relay to the API, carrying the httpOnly session cookie.
// Signature request only — the video bytes go straight to storage.

import { cookies } from 'next/headers';
import { API_BASE, SESSION_COOKIE } from '@/lib/api';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return Response.json({ error: { code: 'unauthorized', message: 'Sign in again.' } }, { status: 401 });
  }
  if (!/^[A-Za-z0-9_-]+$/.test(videoId)) {
    return Response.json({ error: { code: 'bad_request', message: 'Malformed video id.' } }, { status: 400 });
  }

  const body = await request.text();
  const upstream = await fetch(`${API_BASE}/api/v1/creator/videos/${videoId}/upload-signature`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body || '{}',
  });
  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
}
