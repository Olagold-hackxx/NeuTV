// Media storage selection.
//
//   NEUTV_MEDIA_DRIVER=local   files on disk, served by the gateway at /media
//   NEUTV_MEDIA_DRIVER=s3      any S3-compatible bucket, served by a CDN
//
// Local is the default so a checkout works with no accounts and no credentials.
// Switching to a CDN is configuration, not a code change: the admin service
// only knows it has something with save() on it.

import { createStorage } from './local.mjs';
import { createS3Storage } from './s3.mjs';

export { createStorage, createS3Storage };
export { ALLOWED_TYPES, DEFAULT_MAX_BYTES } from './local.mjs';

export function createMediaStorage(env = process.env, { uploadsRoot } = {}) {
  const driver = (env.NEUTV_MEDIA_DRIVER || 'local').toLowerCase();

  if (driver === 's3') {
    const missing = ['NEUTV_S3_ENDPOINT', 'NEUTV_S3_BUCKET', 'NEUTV_S3_ACCESS_KEY_ID', 'NEUTV_S3_SECRET_ACCESS_KEY']
      .filter((key) => !env[key]);
    if (missing.length) {
      throw new Error(`NEUTV_MEDIA_DRIVER=s3 needs: ${missing.join(', ')}`);
    }
    return createS3Storage({
      endpoint: env.NEUTV_S3_ENDPOINT,
      bucket: env.NEUTV_S3_BUCKET,
      region: env.NEUTV_S3_REGION || 'auto',
      accessKeyId: env.NEUTV_S3_ACCESS_KEY_ID,
      secretAccessKey: env.NEUTV_S3_SECRET_ACCESS_KEY,
      prefix: env.NEUTV_S3_PREFIX || 'videos',
    });
  }
  return createStorage({ root: uploadsRoot });
}

/**
 * Where players fetch the bytes from.
 *
 * With a CDN in front of the bucket this is that hostname, so video is served
 * from the edge and never touches the API. Without one it is the gateway's own
 * /media route, which supports byte ranges so seeking works either way.
 */
export const mediaBaseFor = (env = process.env) =>
  (env.NEUTV_MEDIA_BASE_URL || '/media').replace(/\/$/, '');
