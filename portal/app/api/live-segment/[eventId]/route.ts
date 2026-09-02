// Segment upload proxy for the creator studio. The browser must not hold the
// bearer token, so the chunk streams through here with the httpOnly cookie
// attached server-side — same shape as the admin's, against the creator route.

import { cookies } from 'next/headers';
import { API_BASE, SESSION_COOKIE } from '@/lib/api';

export const runtime = 'nodejs';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return Response.json({ error: { code: 'unauthorized', message: 'Sign in again.' } }, { status: 401 });
  }
  if (!/^[A-Za-z0-9_-]+$/.test(eventId)) {
    return Response.json({ error: { code: 'bad_request', message: 'Malformed event id.' } }, { status: 400 });
  }

  const init = new URL(request.url).searchParams.get('init') === '1' ? '?init=1' : '';
  const upstream = await fetch(`${API_BASE}/api/v1/creator/live/${eventId}/segment${init}`, {
    method: 'PUT',
    headers: {
      'content-type': request.headers.get('content-type') ?? 'video/webm',
      authorization: `Bearer ${token}`,
    },
    body: request.body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  const text = await upstream.text();
  return new Response(text, { status: upstream.status, headers: { 'content-type': 'application/json' } });
}
