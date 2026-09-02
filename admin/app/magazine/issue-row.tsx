'use client';

import { useState, useTransition } from 'react';
import { deleteIssue, setIssueStatus } from '@/lib/actions';
import type { MagazineIssue } from '@/lib/types';

const PILL: Record<MagazineIssue['status'], string> = {
  draft: 'pill-draft',
  published: 'pill-published',
  archived: 'pill-block',
};

export function IssueRow({ issue, publishedLabel }: { issue: MagazineIssue; publishedLabel: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? 'That did not work.');
    });

  return (
    <>
      <tr>
        <td>
          <div style={{ fontWeight: 600 }}>{issue.title}</div>
          <div className="stat-note">
            {issue.issueNumber ? `#${issue.issueNumber} · ` : ''}
            {issue.fileUrl ? <a href={issue.fileUrl} target="_blank" rel="noopener noreferrer">file</a> : 'no file yet'}
            {issue.coverUrl ? <> · <a href={issue.coverUrl} target="_blank" rel="noopener noreferrer">cover</a></> : null}
          </div>
        </td>
        <td><span className={`pill ${PILL[issue.status]}`}>{issue.status}</span></td>
        <td className="mono num">{publishedLabel}</td>
        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
          {issue.status !== 'published' ? (
            <button
              type="button" className="btn btn-small" disabled={pending || !issue.fileUrl}
              title={issue.fileUrl ? undefined : 'Needs a file URL first'}
              onClick={() => run(() => setIssueStatus(issue.id, 'published'))}
            >Publish</button>
          ) : (
            <button
              type="button" className="btn btn-small" disabled={pending}
              onClick={() => run(() => setIssueStatus(issue.id, 'archived'))}
            >Archive</button>
          )}
          {issue.status !== 'published' ? (
            <button
              type="button" className="btn btn-small btn-danger" disabled={pending} style={{ marginLeft: 6 }}
              onClick={() => { if (confirm(`Delete "${issue.title}"?`)) run(() => deleteIssue(issue.id)); }}
            >Delete</button>
          ) : null}
        </td>
      </tr>
      {error ? (
        <tr><td colSpan={4}><div className="alert alert-error">{error}</div></td></tr>
      ) : null}
    </>
  );
}
