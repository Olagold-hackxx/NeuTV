// S3-compatible object storage, for serving video from a CDN.
//
// Speaks the S3 REST API with SigV4 signed by node:crypto, so it works against
// Cloudflare R2, AWS S3, Backblaze B2, DigitalOcean Spaces and MinIO without an
// SDK. The AWS SDK is ~20MB of dependency for two HTTP calls; the signing
// algorithm is about forty lines and is specified in public.
//
// Uploads stream. The payload hash is UNSIGNED-PAYLOAD, which is the standard
// approach for streaming a body you have not buffered: integrity comes from
// TLS, and the request itself is still fully signed.

import { createHmac, createHash } from 'node:crypto';
import { badRequest, unavailable } from '../../../platform/errors.mjs';
import { ALLOWED_TYPES } from './local.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (key, value) => createHmac('sha256', key).update(value).digest();

const encodeKey = (key) => key.split('/').map(encodeURIComponent).join('/');

/** AWS Signature Version 4, header-based, single chunk. */
function sign({ method, host, path, region, service = 's3', accessKeyId, secretAccessKey, headers, payloadHash, now }) {
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);

  const allHeaders = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...headers };
  const sortedNames = Object.keys(allHeaders).map((h) => h.toLowerCase()).sort();
  const canonicalHeaders = sortedNames
    .map((name) => `${name}:${String(allHeaders[Object.keys(allHeaders).find((k) => k.toLowerCase() === name)]).trim()}\n`)
    .join('');
  const signedHeaders = sortedNames.join(';');

  const canonicalRequest = [method, path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

  const signingKey = ['aws4_request'].reduce(
    (key, part) => hmac(key, part),
    hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service),
  );
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

  return {
    ...allHeaders,
    authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

export function createS3Storage({
  endpoint,                    // https://<account>.r2.cloudflarestorage.com
  bucket,
  region = 'auto',             // R2 wants "auto"; S3 wants the real region
  accessKeyId,
  secretAccessKey,
  prefix = 'videos',
  maxBytes = 2 * 1024 * 1024 * 1024,
  fetchImpl = globalThis.fetch,
  clock = () => new Date(),
}) {
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage needs endpoint, bucket, accessKeyId and secretAccessKey.');
  }
  const base = new URL(endpoint);

  const request = async (method, key, { body = null, headers = {}, length = null } = {}) => {
    const path = `/${bucket}/${encodeKey(key)}`;
    const signed = sign({
      method,
      host: base.host,
      path,
      region,
      accessKeyId,
      secretAccessKey,
      headers: { ...headers, ...(length !== null ? { 'content-length': String(length) } : {}) },
      payloadHash: 'UNSIGNED-PAYLOAD',
      now: clock(),
    });
    return fetchImpl(new URL(path, base), {
      method,
      headers: signed,
      body,
      ...(body && typeof body !== 'string' ? { duplex: 'half' } : {}),
    });
  };

  return {
    driver: 's3',
    bucket,

    async save(videoId, contentType, source, { declaredLength = null } = {}) {
      const type = String(contentType || '').split(';')[0].trim().toLowerCase();
      const ext = ALLOWED_TYPES[type];
      if (!ext) throw badRequest(`Unsupported video type "${contentType}".`, { allowed: Object.keys(ALLOWED_TYPES) });
      if (!/^[A-Za-z0-9_-]+$/.test(videoId)) throw badRequest('Malformed video id.');

      // Object storage needs the length up front to stream without buffering.
      // Buffering a multi-gigabyte video to discover it is exactly what this
      // driver exists to avoid.
      if (declaredLength === null) {
        throw badRequest('A Content-Length header is required when uploading to object storage.');
      }
      const length = Number(declaredLength);
      if (!Number.isFinite(length) || length <= 0) throw badRequest('Invalid Content-Length.');
      if (length > maxBytes) throw badRequest(`Video exceeds the ${maxBytes} byte limit.`, { maxBytes });

      const key = `${prefix}/${videoId}.${ext}`;
      const res = await request('PUT', key, {
        body: source,
        length,
        headers: { 'content-type': type },
      });
      if (!res.ok) {
        throw unavailable(`Object storage refused the upload (${res.status}).`, {
          detail: (await res.text()).slice(0, 300),
        });
      }
      return { path: key, size: length, contentType: type, ext };
    },

    async stat(key) {
      const res = await request('HEAD', key);
      if (!res.ok) return null;
      return { size: Number(res.headers.get('content-length') || 0), remote: true };
    },

    async exists(key) {
      return (await request('HEAD', key)).ok;
    },

    async remove(key) {
      const res = await request('DELETE', key);
      return res.ok;
    },
  };
}
