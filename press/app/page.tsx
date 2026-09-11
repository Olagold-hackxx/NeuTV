import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getPress, getSession, getViewersChoice } from '@/lib/api';
import { coins, timestamp } from '@/lib/format';

export const dynamic = 'force-dynamic';

// The desk. Until the card is issued there is nothing on it, so an applicant
// lands on their application instead.
export default async function Desk() {
  const user = await getSession();
  if (!user) redirect('/login');
  if (user.role !== 'press' && user.role !== 'admin') redirect('/accreditation');

  const [press, choice] = await Promise.all([getPress(), getViewersChoice().catch(() => null)]);
  const card = press.application?.card ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Press desk</h1>
          <p className="page-sub">
            Your accreditation with NEU Network, and what it opens: the
            network&apos;s real events, with your e-card as the pass.
          </p>
        </div>
      </div>

      <div className={`panel ${press.cardValid ? 'onair' : 'onair-empty'}`} style={{ marginBottom: 20 }}>
        <div className="panel-body spread">
          <div>
            <span className="stat-label">{press.cardValid ? 'Press card valid' : card ? 'Press card expired' : 'No card issued'}</span>
            <div className="headline">{card?.id ?? 'No card'}</div>
            <div className="stat-note">
              {press.application?.outlet}
              {card ? `, valid through ${timestamp(card.expiresAt)}` : ''}
            </div>
          </div>
          <Link href="/card" className="btn btn-primary">Open the e-card</Link>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Access</h2></div>
          <div className="panel-body stack-loose">
            <p className="stat-note" style={{ marginTop: 0 }}>
              A verified NEU PRESS card admits its holder to the network&apos;s
              real events. The schedule, and what is on air right now, is on
              the events page.
            </p>
            <Link href="/events" className="btn btn-sm">See the events</Link>
          </div>
        </div>
        {choice ? (
          <div className="panel">
            <div className="panel-head"><h2>Viewers&apos; choice, {choice.quarter}</h2></div>
            <div className="panel-body">
              <p className="stat-note" style={{ marginTop: 0 }}>
                The story of the quarter: <span className="num">{choice.totalVotes}</span> votes cast so far,
                and a prize pool of <span className="num">{coins(choice.prize)} KASH</span>.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
