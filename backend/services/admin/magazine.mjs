// The E-magazine: a monthly issue, assembled elsewhere, distributed here.
//
// An issue is a cover and a file (PDF or EPUB) with a title on the front.
// Both are URLs, deliberately: the file is produced by an editorial pipeline
// the network does not own yet, and hosting is the media CDN's job. Storing
// URLs makes the magazine work identically on every storage driver and keeps
// multi-megabyte PDFs out of request bodies that serverless platforms cap.
//
// Viewers see published issues only. Drafts are the editor's business, and an
// archived issue stays readable at its own id for anyone who kept the link -
// it just leaves the shelf.

import { validate } from '../../platform/validate.mjs';
import { notFound, conflict, badRequest } from '../../platform/errors.mjs';

export const ISSUE_STATUSES = ['draft', 'published', 'archived'];

const isHttpUrl = (value) => /^https?:\/\/[^\s]+$/i.test(value);

/** What everyone sees. No editorial fields, no author trail. */
export const publicIssue = (row) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  issueNumber: row.issue_no,
  coverUrl: row.cover_url,
  fileUrl: row.file_url,
  status: row.status,
  publishedAt: row.published_at,
});

export const adminIssue = (row) => ({
  ...publicIssue(row),
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export function createMagazine({ runtime, store }) {
  const getRow = async (issueId) => {
    const row = await store.get('SELECT * FROM magazine_issues WHERE id = ?', issueId);
    if (!row) throw notFound(`No magazine issue "${issueId}".`);
    return row;
  };

  return {
    /** The shelf: published issues, newest first. */
    async listPublished({ limit = 24 } = {}) {
      const rows = await store.all(
        "SELECT * FROM magazine_issues WHERE status = 'published' ORDER BY published_at DESC LIMIT ?",
        Math.min(limit, 100),
      );
      return { issues: rows.map(publicIssue) };
    },

    /** One issue, for a kept link. Published or archived - never a draft. */
    async getPublished(issueId) {
      const row = await getRow(issueId);
      if (row.status === 'draft') throw notFound(`No magazine issue "${issueId}".`);
      return { issue: publicIssue(row) };
    },

    async list({ limit = 100 } = {}) {
      const rows = await store.all(
        'SELECT * FROM magazine_issues ORDER BY created_at DESC LIMIT ?',
        Math.min(limit, 200),
      );
      return { issues: rows.map(adminIssue) };
    },

    async create(actorId, input) {
      const v = validate(input, {
        title: { type: 'string', required: true, min: 2, max: 160 },
        description: { type: 'string', required: false, default: '', max: 2_000 },
        issueNumber: { type: 'int', required: false, min: 1, max: 100_000 },
        coverUrl: { type: 'string', required: false, max: 600 },
        fileUrl: { type: 'string', required: false, max: 600 },
      });
      for (const key of ['coverUrl', 'fileUrl']) {
        if (v[key] && !isHttpUrl(v[key])) throw badRequest(`${key} must be an http(s) URL.`);
      }
      const id = `mag_${runtime.uuid()}`;
      const now = runtime.now();
      await store.run(
        `INSERT INTO magazine_issues (id, title, description, issue_no, cover_url, file_url,
                                      status, created_by, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id, v.title, v.description, v.issueNumber ?? null, v.coverUrl ?? null, v.fileUrl ?? null,
        'draft', actorId, now, now,
      );
      return { issue: adminIssue(await getRow(id)) };
    },

    async update(issueId, input) {
      const row = await getRow(issueId);
      const v = validate(input, {
        title: { type: 'string', required: false, min: 2, max: 160 },
        description: { type: 'string', required: false, max: 2_000 },
        issueNumber: { type: 'int', required: false, min: 1, max: 100_000 },
        coverUrl: { type: 'string', required: false, max: 600 },
        fileUrl: { type: 'string', required: false, max: 600 },
        status: { type: 'string', required: false, enum: ISSUE_STATUSES },
      });
      for (const key of ['coverUrl', 'fileUrl']) {
        if (v[key] && !isHttpUrl(v[key])) throw badRequest(`${key} must be an http(s) URL.`);
      }

      const nextFile = v.fileUrl ?? row.file_url;
      const nextStatus = v.status ?? row.status;
      // Publishing a cover with nothing behind it is a shelf full of promises.
      if (nextStatus === 'published' && !nextFile) {
        throw conflict('An issue needs a file URL before it can be published.');
      }

      const now = runtime.now();
      const publishedAt = nextStatus === 'published'
        ? (row.published_at ?? now)   // first publish stamps it; re-publish keeps it
        : row.published_at;
      await store.run(
        `UPDATE magazine_issues SET title=?, description=?, issue_no=?, cover_url=?, file_url=?,
                                    status=?, published_at=?, updated_at=? WHERE id=?`,
        v.title ?? row.title, v.description ?? row.description, v.issueNumber ?? row.issue_no,
        v.coverUrl ?? row.cover_url, nextFile, nextStatus, publishedAt, now, issueId,
      );
      return { issue: adminIssue(await getRow(issueId)) };
    },

    async remove(issueId) {
      const row = await getRow(issueId);
      // A published issue has readers holding its link; archive it first, so
      // taking it off the shelf is a decision distinct from destroying it.
      if (row.status === 'published') {
        throw conflict('That issue is published. Archive it before deleting.');
      }
      await store.run('DELETE FROM magazine_issues WHERE id = ?', issueId);
      return { deleted: issueId };
    },
  };
}
