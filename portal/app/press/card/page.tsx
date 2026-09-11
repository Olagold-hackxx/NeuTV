import Link from 'next/link';
import { getPress, getSession } from '@/lib/api';
import { PressCard } from './press-card';

export const dynamic = 'force-dynamic';

export default async function PressCardPage() {
  const [user, press] = await Promise.all([getSession(), getPress()]);
  const app = press.application;

  if (!user || !app || !app.card || app.status !== 'verified') {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Press card</h1>
            <p className="page-sub">The e-card is issued when the desk verifies your accreditation.</p>
          </div>
        </div>
        <div className="panel">
          <div className="empty">
            No card on this account yet. <Link href="/press">Apply for accreditation</Link> to get one.
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Press card</h1>
          <p className="page-sub">
            Your NEU PRESS e-card. Show it at the door of any network event; the id
            on it is what the desk checks against its record.
          </p>
        </div>
      </div>
      <PressCard
        cardId={app.card.id}
        name={user.name}
        handle={user.handle}
        avatar={user.avatar}
        outlet={app.outlet}
        title={app.title}
        beat={app.beat}
        issuedAt={app.card.issuedAt}
        expiresAt={app.card.expiresAt}
        valid={Boolean(press.cardValid)}
      />
    </>
  );
}
