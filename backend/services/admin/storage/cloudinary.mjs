// Cloudinary video storage.
//
// Same contract as the local and S3 drivers: save() takes a stream and returns
// where the bytes ended up. No SDK - the upload API is one signed multipart
// POST, and the signature is a sha1 over sorted parameters, which is forty
// lines rather than a dependency tree.
//
// Uploads stream. The multipart envelope has a known length and the caller has
// already told us the video's, so Content-Length is computed up front and the
// body is a stream: a two-gigabyte video is never held in memory.
//
// What is stored is the delivery path, not a URL. NEUTV_MEDIA_BASE_URL decides
// the host, so putting Fastly (or any CDN) in front of Cloudinary is a config
// change and not a migration - and the rows keep working if the CDN moves.

import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { badRequest, unavailable } from '../../../platform/errors.mjs';
import { ALLOWED_TYPES, DEFAULT_MAX_BYTES } from './local.mjs';

const CRLF = '\r\n';

/**
 * Cloudinary's signature: the parameters that will be sent, minus file,
 * api_key and resource_type, sorted by name, joined as a query string, with the
 * API secret appended, then sha1.
 */
export function signParams(params, apiSecret) {
  const payload = Object.keys(params)
    .filter((k) => !['file', 'api_key', 'resource_type'].includes(k))
    .filter((k) => params[k] !== undefined && params[k] !== null && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return createHash('sha1').update(payload + apiSecret).digest('hex');
}

export function createCloudinaryStorage({
  cloudName,
  apiKey,
  apiSecret,
  folder = 'videos',
  maxBytes = DEFAULT_MAX_BYTES,
  fetchImpl = globalThis.fetch,
  now = () => Math.floor(Date.now() / 1000),
  boundary = () => `neutv${createHash('sha1').update(String(Math.random())).digest('hex').slice(0, 24)}`,
}) {
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary storage needs cloudName, apiKey and apiSecret.');
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  return {
    driver: 'cloudinary',
    cloudName,
    folder,

    async save(videoId, contentType, source, { declaredLength = null } = {}) {
      const type = String(contentType || '').split(';')[0].trim().toLowerCase();
      const ext = ALLOWED_TYPES[type];
      if (!ext) throw badRequest(`Unsupported video type "${contentType}".`, { allowed: Object.keys(ALLOWED_TYPES) });
      if (!/^[A-Za-z0-9_-]+$/.test(videoId)) throw badRequest('Malformed video id.');

      // The multipart envelope has to declare its total size, and the only
      // unknown in it is the video. Buffering the video to measure it is what
      // this driver exists to avoid.
      if (declaredLength === null) {
        throw badRequest('A Content-Length header is required when uploading to Cloudinary.');
      }
      const length = Number(declaredLength);
      if (!Number.isFinite(length) || length <= 0) throw badRequest('Invalid Content-Length.');
      if (length > maxBytes) throw badRequest(`Video exceeds the ${maxBytes} byte limit.`, { maxBytes });

      // public_id carries the folder and excludes the extension: Cloudinary
      // appends the format itself, and a public_id containing a dot would be
      // read as one.
      const publicId = `${folder}/${videoId}`;
      const fields = {
        api_key: apiKey,
        timestamp: String(now()),
        public_id: publicId,
        overwrite: 'true',
        // An operator replacing a file expects the new one to play, not a CDN
        // copy of the old one. Cloudinary versions each upload, and invalidate
        // tells it to purge the previous version from the edge.
        invalidate: 'true',
      };
      fields.signature = signParams(fields, apiSecret);

      const mark = boundary();
      const head = Object.entries(fields)
        .map(([k, v]) => `--${mark}${CRLF}content-disposition: form-data; name="${k}"${CRLF}${CRLF}${v}${CRLF}`)
        .join('')
        + `--${mark}${CRLF}`
        + `content-disposition: form-data; name="file"; filename="${videoId}.${ext}"${CRLF}`
        + `content-type: ${type}${CRLF}${CRLF}`;
      const tail = `${CRLF}--${mark}--${CRLF}`;

      const body = Readable.from((async function* stream() {
        yield Buffer.from(head, 'utf8');
        for await (const chunk of source) yield chunk;
        yield Buffer.from(tail, 'utf8');
      })());

      let res;
      try {
        res = await fetchImpl(endpoint, {
          method: 'POST',
          headers: {
            'content-type': `multipart/form-data; boundary=${mark}`,
            'content-length': String(Buffer.byteLength(head) + length + Buffer.byteLength(tail)),
          },
          body,
          duplex: 'half',
        });
      } catch (err) {
        throw unavailable('Could not reach Cloudinary.', { detail: String(err && err.message).slice(0, 200) });
      }

      const text = await res.text();
      if (!res.ok) {
        throw unavailable(`Cloudinary refused the upload (${res.status}).`, { detail: text.slice(0, 300) });
      }

      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = null; }
      if (!parsed || !parsed.public_id) {
        throw unavailable('Cloudinary accepted the upload but returned no public id.', { detail: text.slice(0, 200) });
      }

      // Cloudinary reports what it actually stored, which is what should be
      // recorded - it transcodes, so its byte count is the truth and the
      // uploaded length is only what we sent.
      return {
        path: `${parsed.public_id}.${parsed.format || ext}`,
        size: Number(parsed.bytes) || length,
        contentType: type,
        ext: parsed.format || ext,
      };
    },

    /** Whether an object is there, and how big. Used by the storage tests. */
    async stat(path) {
      const publicId = String(path).replace(/\.[^.]+$/, '');
      const timestamp = String(now());
      const params = { public_id: publicId, timestamp, type: 'upload' };
      const signature = signParams(params, apiSecret);
      const query = new URLSearchParams({ ...params, api_key: apiKey, signature });
      const res = await fetchImpl(
        `https://api.cloudinary.com/v1_1/${cloudName}/resources/video/upload/${encodeURIComponent(publicId)}?${query}`,
        { headers: { authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}` } },
      );
      if (res.status === 404) return null;
      if (!res.ok) throw unavailable(`Cloudinary lookup failed (${res.status}).`);
      const body = await res.json();
      return { size: Number(body.bytes) || 0, contentType: `video/${body.format}` };
    },
  };
}
