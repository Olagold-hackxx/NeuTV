import Link from 'next/link';
import { getPress, getSession } from '@/lib/api';
import { timestamp } from '@/lib/format';
import { ApplyForm } from './apply-form';

export const dynamic = 'force-dynamic';

const STATUS_PILL: Record<string, string> = {
  pending: 'pill-draft',
  verified: 'pill-published',
  rejected: 'pill-block',
  revoked: 'pill-archived',
};

export default async function PressPage() {
  const user = await getSession();
  const press = await getPress();
  const app = press.application;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Press accreditation</h1>
          <p className="page-sub">
            Register your outlet, get verified by the network, and hold a NEU
            PRESS e-card with an id. The card is the pass to the network&apos;s
            real events.
          </p>
        </div>
        {app ? <span className={`pill ${STATUS_PILL[app.status] ?? ''}`}>{app.status}</span> : null}
      </div>

      {app?.status === 'verified' ? (
        <div className="panel onair" style={{ marginBottom: 20 }}>
          <div className="panel-body spread">
            <div>
              <span className="stat-label">Verified</span>
              <div className="headline">{app.card?.id}</div>
              <div className="stat-note">
                {app.outlet}, {app.title}. Issued {timestamp(app.card?.issuedAt)}, valid through {timestamp(app.card?.expiresAt)}.
              </div>
            </div>
            <div className="actions">
              <Link href="/press/card" className="btn btn-primary">Open the e-card</Link>
              <Link href="/press/events" className="btn">Events</Link>
            </div>
          </div>
        </div>
      ) : null}

      {app?.status === 'pending' ? (
        <div className="panel onair-empty" style={{ marginBottom: 20 }}>
          <div className="panel-body">
            <span className="stat-label">With the desk</span>
            <div className="stat-note" style={{ maxWidth: '60ch' }}>
              Your application for {app.outlet} was filed {timestamp(app.createdAt)} and is
              being reviewed. Once verified, sign out and back in and the press
              desk becomes your dashboard.
            </div>
          </div>
        </div>
      ) : null}

      {app?.status === 'rejected' || app?.status === 'revoked' ? (
        <div className="alert alert-warn">
          {app.status === 'rejected'
            ? `The desk did not verify the application for ${app.outlet}. You can apply again with corrected details.`
            : `The press card for ${app.outlet} was revoked ${timestamp(app.reviewedAt)}. You can apply again.`}
        </div>
      ) : null}

      <div className="grid grid-split-narrow" style={{ alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head"><h2>{app && app.status !== 'rejected' && app.status !== 'revoked' ? 'Your application' : 'Register'}</h2></div>
          <div className="panel-body">
            {app && (app.status === 'pending' || app.status === 'verified') ? (
              <dl className="stack-loose" style={{ margin: 0 }}>
                <div><dt className="stat-label">Outlet</dt><dd style={{ margin: 0, fontWeight: 600 }}>{app.outlet}</dd></div>
                <div><dt className="stat-label">Title</dt><dd style={{ margin: 0 }}>{app.title}</dd></div>
                {app.beat ? <div><dt className="stat-label">Beat</dt><dd style={{ margin: 0 }}>{app.beat}</dd></div> : null}
                {app.website ? <div><dt className="stat-label">Website</dt><dd style={{ margin: 0 }}><a href={app.website} target="_blank" rel="noreferrer">{app.website} ↗</a></dd></div> : null}
                {app.note ? <div><dt className="stat-label">Note to the desk</dt><dd style={{ margin: 0 }} className="stat-note">{app.note}</dd></div> : null}
              </dl>
            ) : (
              <ApplyForm defaults={app ? { outlet: app.outlet, title: app.title, beat: app.beat, website: app.website ?? '', note: app.note } : undefined} />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2>What the card opens</h2></div>
          <div className="panel-body stack-loose">
            <p className="stat-note" style={{ marginTop: 0 }}>
              <strong>Real events.</strong> Verified press are admitted to the
              network&apos;s scheduled and live events. Show the e-card at the door.
            </p>
            <p className="stat-note" style={{ marginTop: 0 }}>
              <strong>An id.</strong> Every card carries a NEU PRESS number and
              a validity window, and the network keeps the record of who holds it.
            </p>
            <p className="stat-note" style={{ marginTop: 0 }}>
              <strong>The source of record.</strong> Stories are collected here
              and carried out to the public. Signed in as {user?.name}.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
