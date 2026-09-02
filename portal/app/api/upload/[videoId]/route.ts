// Upload proxy.
//
// The browser cannot PUT straight to the API without holding the admin token,
// and an admin token in the browser is a token any script on the page can read.
// So the file streams through here: the route reads the httpOnly cookie and
// pipes the request body to the backend without buffering it.
//
// Streaming matters. Buffering a multi-gigabyte video into memory to forward it
// would defeat the point of the backend accepting a raw stream in the first
// place. duplex: 'half' is what lets fetch send a ReadableStream body.

import { cookies } from 'next/headers';
import { API_BASE, SESSION_COOKIE } from '@/lib/api';

export const runtime = 'nodejs';
// Video uploads run far longer than a default serverless budget, but not
// arbitrarily long: this was 3600, which no Vercel plan permits - the platform
// clamps it, so the real ceiling was whatever the plan allowed and the number
// here was a comforting fiction. 300s is the Pro default maximum.
//
// It is a real limit, not a formality: at a typical upstream this caps a
// browser upload at a few hundred megabytes. Beyond that the file has to go
// straight to object storage with a presigned URL rather than being streamed
// through this function.
export const maxDuration = 300;

export async function PUT(
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

  const contentType = request.headers.get('content-type') ?? 'application/octet-stream';
  const contentLength = request.headers.get('content-length');

  const upstream = await fetch(`${API_BASE}/api/v1/creator/videos/${videoId}/file`, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      ...(contentLength ? { 'content-length': contentLength } : {}),
      authorization: `Bearer ${token}`,
    },
    body: request.body,
    // Required by fetch to stream a request body rather than buffer it.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': 'application/json' },
  });
}
