import Link from 'next/link';
import { getPress, getPressEvents, getSession } from '@/lib/api';
import { timestamp } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PressEventsPage() {
  const user = await getSession();
  if (user && user.role !== 'press' && user.role !== 'admin') {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Events</h1>
            <p className="page-sub">The network&apos;s real events are open to verified press.</p>
          </div>
        </div>
        <div className="panel">
          <div className="empty">
            This account does not hold a press card. <Link href="/press">Apply for accreditation</Link>.
          </div>
        </div>
      </>
    );
  }

  const [press, { events }] = await Promise.all([getPress(), getPressEvents()]);
  const live = events.filter((e) => e.isLive);
  const upcoming = events.filter((e) => !e.isLive);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Events</h1>
          <p className="page-sub">
            What the network is putting on. Your card admits you to every one of
            these; the live ones are on air on the main stage right now.
          </p>
        </div>
        <div className="mono">{press.application?.card?.id ?? 'no card'}</div>
      </div>

      {!press.cardValid ? (
        <div className="alert alert-warn">
          Your press card has expired. The desk can re-verify it; until then the door may refuse it.
        </div>
      ) : null}

      {live.map((e) => (
        <div key={e.id} className="panel onair-live" style={{ marginBottom: 20 }}>
          <div className="panel-body">
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="live-dot" />
              <span className="stat-label">On air now</span>
            </div>
            <div className="headline">{e.title}</div>
            {e.description ? <div className="stat-note">{e.description}</div> : null}
            <div className="stat-note">{e.productId}, since {timestamp(e.startedAt)}</div>
          </div>
        </div>
      ))}

      <div className="panel">
        <div className="panel-head">
          <h2>Scheduled</h2>
          <span className="mono num">{upcoming.length}</span>
        </div>
        {upcoming.length === 0 ? (
          <div className="empty">Nothing scheduled yet. Events appear here as the network posts them.</div>
        ) : (
          <table>
            <thead><tr><th>Event</th><th>Product</th><th>When</th><th>Access</th></tr></thead>
            <tbody>
              {upcoming.map((e) => (
                <tr key={e.id}>
                  <td>
                    <div className="stack">
                      <span style={{ fontWeight: 600 }}>{e.title}</span>
                      {e.description ? <span className="mono">{e.description}</span> : null}
                    </div>
                  </td>
                  <td className="mono">{e.productId}</td>
                  <td className="mono">{e.scheduledFor ? timestamp(e.scheduledFor) : 'to be announced'}</td>
                  <td><span className="pill pill-published">press</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
