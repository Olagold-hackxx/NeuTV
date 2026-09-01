/**
 * Upload a video from the browser straight to storage.
 *
 * The file used to be PUT to /api/upload/[videoId], a Next route handler that
 * piped it to the API. That works locally and cannot work deployed: Vercel
 * rejects any serverless request body over 4.5MB with a 413, before the handler
 * runs. A video is never under 4.5MB, so every production upload failed.
 *
 * Now the browser asks the API to sign an upload, posts the file directly to the
 * CDN, and tells the API where it landed. The bytes never touch Vercel or the
 * VPS. The signature is scoped to one asset and expires, and the API secret
 * stays on the server.
 *
 * XMLHttpRequest rather than fetch, because it is still the only way to get
 * upload progress events, and an upload with no progress bar is
 * indistinguishable from a hung one.
 */

export interface UploadResult {
  path: string;
  bytes: number;
  contentType: string;
  durationSeconds?: number;
}

interface Signature {
  uploadUrl: string;
  publicId: string;
  maxBytes: number;
  fields: Record<string, string | number>;
}

export async function uploadVideo(
  videoId: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<UploadResult> {
  const signRes = await fetch(`/api/upload-signature/${encodeURIComponent(videoId)}`, { method: 'POST' });
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Could not start the upload (${signRes.status}).`);
  }
  const signature: Signature = await signRes.json();

  // Checked here as well as on the server so a two-gigabyte mistake fails
  // instantly rather than after the upload.
  if (signature.maxBytes && file.size > signature.maxBytes) {
    throw new Error(`That file is ${Math.round(file.size / 1e6)}MB; the limit is ${Math.round(signature.maxBytes / 1e6)}MB.`);
  }

  const form = new FormData();
  for (const [key, value] of Object.entries(signature.fields)) form.append(key, String(value));
  form.append('file', file);

  const stored = await new Promise<{ public_id: string; bytes: number; format?: string; duration?: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', signature.uploadUrl);
    if (onProgress) {
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    }
    xhr.onload = () => {
      let parsed: Record<string, unknown> | null = null;
      try { parsed = JSON.parse(xhr.responseText); } catch { /* storage returned non-JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && parsed?.public_id) {
        resolve(parsed as never);
      } else {
        const message = (parsed?.error as { message?: string } | undefined)?.message;
        reject(new Error(message ?? `Storage refused the upload (${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error('The upload connection dropped.'));
    xhr.send(form);
  });

  // Tell the API where it landed. Until this returns, the video row still has
  // no file and the video cannot be published.
  const result: UploadResult = {
    path: stored.format ? `${stored.public_id}.${stored.format}` : stored.public_id,
    bytes: stored.bytes,
    contentType: file.type || 'video/mp4',
    ...(stored.duration ? { durationSeconds: Math.round(stored.duration) } : {}),
  };

  const completeRes = await fetch(`/api/upload-complete/${encodeURIComponent(videoId)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result),
  });
  if (!completeRes.ok) {
    const body = await completeRes.json().catch(() => null);
    throw new Error(body?.error?.message ?? 'The file uploaded but could not be recorded.');
  }
  return result;
}
