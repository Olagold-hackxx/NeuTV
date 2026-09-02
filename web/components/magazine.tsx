'use client';

// The E-magazine shelf: published issues, newest first, covers forward.
//
// An issue opens in a new tab - the file is a PDF or EPUB served by the media
// CDN, and the browser is better at both than anything rebuilt here. The
// shelf's job is to make this month's cover impossible to miss and the back
// numbers easy to find.

import { useEffect, useState } from 'react';
import { BookOpen, Download } from 'lucide-react';
import type { NeuTVClient } from '@/lib/client';
import type { MagazineIssue } from '@/lib/types';

export function Magazine({ client }: { client: NeuTVClient }) {
  const [issues, setIssues] = useState<MagazineIssue[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client.magazineIssues()
      .then((res) => { if (!cancelled) setIssues(res?.issues ?? []); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [client]);

  const issueLabel = (issue: MagazineIssue) =>
    issue.issueNumber ? `Issue #${issue.issueNumber}` : null;

  const dateLabel = (issue: MagazineIssue) =>
    issue.publishedAt
      ? new Date(issue.publishedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      : null;

  const [latest, ...back] = issues ?? [];

  return (
    <section className="px-4 md:px-8 py-6 max-w-6xl mx-auto w-full">
      <header className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-white" />
        <div>
          <h1 className="text-xl font-bold text-white">E-Magazine</h1>
          <p className="text-sm text-white/50">The network in print. New issue every month.</p>
        </div>
      </header>

      {failed ? (
        <p className="text-white/60 text-sm">The shelf could not be reached. It retries when you come back.</p>
      ) : issues === null ? (
        <p className="text-white/40 text-sm">Loading the shelf…</p>
      ) : issues.length === 0 ? (
        <div className="border border-white/10 rounded-2xl p-10 text-center">
          <p className="text-white/70 font-medium">No issues yet.</p>
          <p className="text-white/40 text-sm mt-1">The first E-Magazine lands here the day it is published.</p>
        </div>
      ) : (
        <>
          {/* The current issue carries the page. */}
          <a
            href={latest.fileUrl ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col md:flex-row gap-6 border border-white/10 rounded-2xl p-6 mb-8 hover:border-white/25 transition-colors"
          >
            {latest.coverUrl ? (
              <img
                src={latest.coverUrl}
                alt={`Cover of ${latest.title}`}
                className="w-full md:w-56 aspect-[3/4] object-cover rounded-xl border border-white/10"
              />
            ) : (
              <div className="w-full md:w-56 aspect-[3/4] rounded-xl border border-white/10 bg-white/5 flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-white/30" />
              </div>
            )}
            <div className="flex-1 flex flex-col justify-center">
              <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
                {[issueLabel(latest), dateLabel(latest)].filter(Boolean).join(' · ') || 'Latest issue'}
              </p>
              <h2 className="text-2xl font-bold text-white mb-2">{latest.title}</h2>
              {latest.description ? (
                <p className="text-white/60 text-sm leading-relaxed mb-4">{latest.description}</p>
              ) : null}
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-white group-hover:underline">
                <Download className="w-4 h-4" /> Read this issue
              </span>
            </div>
          </a>

          {back.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-white/50 uppercase tracking-widest mb-4">Back issues</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {back.map((issue) => (
                  <a
                    key={issue.id}
                    href={issue.fileUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group border border-white/10 rounded-xl overflow-hidden hover:border-white/25 transition-colors"
                  >
                    {issue.coverUrl ? (
                      <img src={issue.coverUrl} alt={`Cover of ${issue.title}`} className="w-full aspect-[3/4] object-cover" />
                    ) : (
                      <div className="w-full aspect-[3/4] bg-white/5 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-white/25" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-xs text-white/40">
                        {[issueLabel(issue), dateLabel(issue)].filter(Boolean).join(' · ')}
                      </p>
                      <p className="text-sm font-semibold text-white truncate group-hover:underline">{issue.title}</p>
                    </div>
                  </a>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}
