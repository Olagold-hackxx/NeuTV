import { getPressApplications } from '@/lib/api';
import { timestamp } from '@/lib/format';
import { PressReview } from './press-review';

export const dynamic = 'force-dynamic';

const PILL: Record<string, string> = {
  pending: 'pill-draft',
  verified: 'pill-published',
  rejected: 'pill-block',
  revoked: 'pill-archived',
};

export default async function PressPage() {
  const { applications } = await getPressApplications();
  const pending = applications.filter((a) => a.status === 'pending');
  const rest = applications.filter((a) => a.status !== 'pending');

  const row = (a: (typeof applications)[number]) => (
    <tr key={a.userId}>
      <td>
        <div className="stack">
          <span style={{ fontWeight: 600 }}>{a.name ?? a.userId}</span>
          <span className="mono">{a.handle ? `@${a.handle.replace(/^@/, '')}` : a.userId}</span>
        </div>
      </td>
      <td>
        <div className="stack">
          <span style={{ fontWeight: 600 }}>{a.outlet}</span>
          <span className="mono">{a.title}{a.beat ? `, ${a.beat}` : ''}</span>
          {a.website ? <a href={a.website} target="_blank" rel="noreferrer" className="mono">{a.website} ↗</a> : null}
          {a.note ? <span className="mono" style={{ whiteSpace: 'pre-wrap' }}>{a.note}</span> : null}
        </div>
      </td>
      <td><span className={`pill ${PILL[a.status] ?? ''}`}>{a.status}</span></td>
      <td className="mono">
        {a.card ? (
          <div className="stack">
            <span className="num">{a.card.id}</span>
            <span>through {timestamp(a.card.expiresAt)}</span>
          </div>
        ) : '—'}
      </td>
      <td className="mono">{timestamp(a.createdAt)}</td>
      <td><PressReview userId={a.userId} status={a.status} /></td>
    </tr>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Press desk</h1>
          <p className="page-sub">
            Accreditation requests from journalists and outlets. Verifying
            grants the press role and mints a NEU PRESS card that admits the
            holder to the network&apos;s events for a year; revoking takes both back.
          </p>
        </div>
        <div className="mono num">{pending.length} awaiting review</div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-head">
          <h2>Awaiting review</h2>
          <span className="mono num">{pending.length}</span>
        </div>
        {pending.length === 0 ? (
          <div className="empty">Nothing pending. New applications land here as they are filed from the press portal.</div>
        ) : (
          <table>
            <thead><tr><th>Applicant</th><th>Outlet</th><th>Status</th><th>Card</th><th>Filed</th><th></th></tr></thead>
            <tbody>{pending.map(row)}</tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Accredited and closed</h2>
          <span className="mono num">{rest.length}</span>
        </div>
        {rest.length === 0 ? (
          <div className="empty">No cards issued yet.</div>
        ) : (
          <table>
            <thead><tr><th>Holder</th><th>Outlet</th><th>Status</th><th>Card</th><th>Filed</th><th></th></tr></thead>
            <tbody>{rest.map(row)}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
