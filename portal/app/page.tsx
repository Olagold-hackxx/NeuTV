import Link from 'next/link';
import {
  getBalance, getLedger, getMyChannel, getMyLive, getMyTasks, getMyVideos, getPress, getSession,
  getSubscriptions, getViewersChoice,
} from '@/lib/api';
import { coins, timestamp } from '@/lib/format';
import { SubscribeButton } from './subscribe-button';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(3, '0');

export default async function Dashboard() {
  const user = await getSession();

  // A press card holder's dashboard is the press desk.
  if (user && user.role === 'press') {
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
              <span className="stat-label">{press.cardValid ? 'Press card valid' : 'Press card expired'}</span>
              <div className="headline">{card?.id ?? 'No card'}</div>
              <div className="stat-note">
                {press.application?.outlet}
                {card ? `, valid through ${timestamp(card.expiresAt)}` : ''}
              </div>
            </div>
            <Link href="/press/card" className="btn btn-primary">Open the e-card</Link>
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
              <Link href="/press/events" className="btn btn-sm">See the events</Link>
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

  // Signed in, but with neither standing yet: the portal explains both paths
  // rather than 403ing them around.
  if (user && user.role !== 'creator' && user.role !== 'admin') {
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Welcome, {user.name}</h1>
            <p className="page-sub">
              This account has a NEU Passport but no standing on the portal
              yet. There are two ways in.
            </p>
          </div>
        </div>
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="panel">
            <div className="panel-head"><h2>Creators</h2></div>
            <div className="panel-body">
              <p className="stat-note" style={{ marginTop: 0, maxWidth: '52ch' }}>
                Creators are approved by the network. Reach out through your
                community hub on WorldSpace, and once you are approved this
                portal unlocks: briefs with KashCoin bounties, publishing to
                the Creators Network, going live on your own channel, a decoder
                number in the channels area, and a place on the viewers&apos;
                choice board.
              </p>
              <p className="stat-note" style={{ maxWidth: '52ch' }}>
                Already approved? Sign out and back in, and this page becomes
                your dashboard.
              </p>
            </div>
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Press</h2></div>
            <div className="panel-body">
              <p className="stat-note" style={{ marginTop: 0, maxWidth: '52ch' }}>
                Journalists and outlets register here and are verified by the
                network. A verified account holds a NEU PRESS e-card with an
                id, and the card is the pass to the network&apos;s real events.
              </p>
              <Link href="/press" className="btn btn-primary" style={{ marginTop: 6 }}>Apply for accreditation</Link>
            </div>
          </div>
        </div>
      </>
    );
  }

  const [subs, wallet, ledger, videos, live, tasks, channel, choice] = await Promise.all([
    getSubscriptions(), getBalance(), getLedger(10), getMyVideos(), getMyLive(), getMyTasks(),
    getMyChannel().catch(() => null), getViewersChoice().catch(() => null),
  ]);
  const creatorPlan = subs.plans.creator;
  const earnings = ledger.entries.filter((e) => (e.kind === 'payout' || e.kind === 'reward' || e.kind === 'prize') && e.amount > 0);
  const published = videos.videos.filter((v) => v.status === 'published').length;
  const liveNow = live.events.find((e) => e.isLive) ?? null;
  const myOpenTasks = tasks.tasks.filter((t) => t.status === 'accepted' || t.status === 'delivered').length;
  const myStanding = choice?.standings.find((s) => s.userId === user?.id) ?? null;

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

      {/* What being on the network pays, beyond gifts and bounties. */}
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="panel stat">
          <div className="stat-label">Your audience</div>
          <div className="stat-value">Creators Network</div>
          <div className="stat-note">every publish and every live session is a card on the network&apos;s rail, in front of every viewer</div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Your decoder number</div>
          <div className="stat-value num">{channel?.channel ? `Ch ${pad(channel.channel.number)}` : '—'}</div>
          <div className="stat-note">
            {channel?.channel
              ? <>{channel.channel.name}, listed in the channels area. <Link href="/channel">Edit</Link></>
              : <>a number of your own in the channels area, {channel ? `${coins(channel.price)} KASH` : 'sold once'}. <Link href="/channel">Buy one</Link></>}
          </div>
        </div>
        <div className="panel stat">
          <div className="stat-label">Viewers&apos; choice, {choice?.quarter ?? 'this quarter'}</div>
          <div className="stat-value num">{myStanding ? `#${myStanding.rank}` : 'unranked'}</div>
          <div className="stat-note">
            {choice
              ? <>{myStanding ? `${myStanding.votes} votes. ` : ''}The winner takes {choice.sharePct}% of the quarter&apos;s network revenue: <span className="num">{coins(choice.prize)} KASH</span> so far.</>
              : 'the board is decided by viewers, and the winner takes a share of the quarter\'s network revenue'}
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="panel">
          <div className="panel-head"><h2>Recent earnings</h2></div>
          {earnings.length === 0 ? (
            <div className="empty">
              Nothing yet. Earnings arrive from gifts on your content, approved
              briefs, and the viewers&apos; choice prize.
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
            <div className="empty">No videos yet. Your first publish puts you on the Creators Network.</div>
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
