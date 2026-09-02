'use client';

import { useActionState } from 'react';
import { createIssue } from '@/lib/actions';
import type { ActionResult } from '@/lib/actions';

export function IssueForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createIssue, null);

  return (
    <form action={action}>
      {state?.error ? <div className="alert alert-error">{state.error}</div> : null}
      {state?.ok ? <div className="alert alert-ok">Drafted. Publish it from the list when the file is final.</div> : null}

      <div className="field">
        <label htmlFor="issue-title">Title</label>
        <input id="issue-title" name="title" required minLength={2} maxLength={160} placeholder="E-News — March 2027" />
      </div>
      <div className="field">
        <label htmlFor="issue-desc">Description</label>
        <textarea id="issue-desc" name="description" maxLength={2000} placeholder="What this issue covers." />
      </div>
      <div className="field">
        <label htmlFor="issue-number">Issue number</label>
        <input id="issue-number" name="issueNumber" type="number" min={1} placeholder="1" />
      </div>
      <div className="field">
        <label htmlFor="issue-cover">Cover image URL</label>
        <input id="issue-cover" name="coverUrl" type="url" maxLength={600} placeholder="https://cdn.…/cover.jpg" />
      </div>
      <div className="field">
        <label htmlFor="issue-file">Issue file URL (PDF or EPUB)</label>
        <input id="issue-file" name="fileUrl" type="url" maxLength={600} placeholder="https://cdn.…/issue-01.pdf" />
        <p className="hint">
          Upload the file to the media CDN first and paste its URL. An issue
          cannot be published without one.
        </p>
      </div>
      <button type="submit" className="btn btn-primary btn-block" disabled={pending}>
        {pending ? 'Drafting' : 'Draft issue'}
      </button>
    </form>
  );
}
