import Link from 'next/link';
import { getBalance, getLedger, getMyLive, getMyTasks, getMyVideos, getSession, getSubscriptions } from '@/lib/api';
import { coins, timestamp } from '@/lib/format';
import { SubscribeButton } from './subscribe-button';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const user = await getSession();

  // Signed in, but not yet a creator: the portal explains the path rather
  // than 403ing them around.
  if (user && user.role !== 'creator' && user.role !== 'admin') {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Welcome, {user.name}</h1>
            <p className="page-sub">
              This account has a NEU Passport but no creator standing yet.
              Creators are approved by the network — reach out through your
              community hub on WorldSpace, and once you are approved this
              portal unlocks: briefs with KashCoin bounties, publishing to the
              Creator Spotlight, and going live on your own channel.
            </p>
          </div>
        </div>
        <div className="panel">
          <div className="panel-body">
            <p className="stat-note" style={{ maxWidth: '62ch' }}>
              Already approved? Sign out and back in, and this page becomes
              your dashboard.
            </p>
          </div>
        </div>
      </>
    );
  }

  const [subs, wallet, ledger, videos, live, tasks] = await Promise.all([
    getSubscriptions(), getBalance(), getLedger(10), getMyVideos(), getMyLive(), getMyTasks(),
  ]);
  const creatorPlan = subs.plans.creator;
  const earnings = ledger.entries.filter((e) => (e.kind === 'payout' || e.kind === 'reward') && e.amount > 0);
  const published = videos.videos.filter((v) => v.status === 'published').length;
  const liveNow = live.events.find((e) => e.isLive) ?? null;
  const myOpenTasks = tasks.tasks.filter((t) => t.status === 'accepted' || t.status === 'delivered').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">
            Your channel at a glance: what is earning, what is on air, and what
            the network is asking for.
          </p>
        </div>
      </div>

      {/* The subscription is the gate. Say so plainly, with the way forward. */}
      <div className={`panel ${creatorPlan.active ? 'onair' : 'onair-empty'}`} style={{ marginBottom: 20 }}>
        <div className="panel-body spread">
          <div>
            <span className="stat-label">{creatorPlan.active ? 'Creator subscription active' : 'Creator subscription needed'}</span>
            <div className="stat-note" style={{ maxWidth: '58ch' }}>
              {creatorPlan.active
                ? `Renews from ${timestamp(creatorPlan.expiresAt)}. Publishing, going live and taking briefs are all open.`
                : 'Your creator standing is approved, but publishing is gated on an active plan. It is priced to earn back with one small gift.'}
            </div>
          </div>
          <SubscribeButton renew={creatorPlan.active} />
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <div className="panel stat">
          <div className="stat-label">KashCoin balance</div>
          <div className="stat-value num">{coins(wallet.balance)}</div>
          <div className="stat-note">cashes out through KashPlus</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Published</div>
          <div className="stat-value num">{published}</div>
          <div className="stat-note">{videos.total} videos on your channel</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">On air</div>
          <div className="stat-value">{liveNow ? 'LIVE' : '—'}</div>
          <div className="stat-note">{liveNow ? liveNow.title : 'your channel is quiet'}</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Briefs in hand</div>
          <div className="stat-value num">{myOpenTasks}</div>
          <div className="stat-note"><Link href="/tasks">see the task board</Link></div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Recent earnings</h2></div>
          {earnings.length === 0 ? (
            <div className="empty">
              Nothing yet. Earnings arrive from gifts on your content and
              approved briefs.
            </div>
          ) : (
            <table>
              <thead><tr><th>What</th><th className="num-col">Coins</th><th>When</th></tr></thead>
              <tbody>
                {earnings.map((e) => (
                  <tr key={e.id}>
                    <td>{e.memo}</td>
                    <td className="num num-col">+{coins(e.amount)}</td>
                    <td className="mono">{timestamp(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Your channel</h2>
            <Link href="/publish" className="btn btn-sm">Publish</Link>
          </div>
          {videos.videos.length === 0 ? (
            <div className="empty">No videos yet. Your first publish puts you on the spotlight.</div>
          ) : (
            <table>
              <thead><tr><th>Title</th><th>Status</th><th>Added</th></tr></thead>
              <tbody>
                {videos.videos.slice(0, 6).map((v) => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: 600 }}>{v.title}</td>
                    <td><span className={`pill pill-${v.status}`}>{v.status}</span></td>
                    <td className="mono">{timestamp(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
