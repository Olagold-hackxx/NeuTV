import { getMagazine } from '@/lib/api';
import { timestamp } from '@/lib/format';
import { IssueForm } from './issue-form';
import { IssueRow } from './issue-row';

export const dynamic = 'force-dynamic';

export default async function MagazinePage() {
  const { issues } = await getMagazine();
  const published = issues.filter((i) => i.status === 'published').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>E-Magazine</h1>
          <p className="page-sub">
            Monthly issues on the viewer shelf. Draft here, paste the cover and
            file URLs from the CDN, publish when the issue is real.
          </p>
        </div>
        <div className="mono num">{published} on the shelf</div>
      </div>

      <div className="grid grid-split" style={{ alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head">
            <h2>All issues</h2>
            <span className="mono num">{issues.length}</span>
          </div>
          {issues.length === 0 ? (
            <div className="empty">No issues yet. Draft the first one with the form.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Issue</th><th>Status</th><th>Published</th><th /></tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <IssueRow key={issue.id} issue={issue} publishedLabel={issue.publishedAt ? timestamp(issue.publishedAt) : '—'} />
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Draft an issue</h2></div>
          <IssueForm />
        </div>
      </div>
    </>
  );
}
