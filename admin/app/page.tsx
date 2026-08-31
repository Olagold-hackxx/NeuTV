import Link from 'next/link';
import { getOverview } from '@/lib/api';
import { bytes, coins, timestamp } from '@/lib/format';

export const dynamic = 'force-dynamic';

function Stat({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="panel stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}</div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  );
}

export default async function Dashboard() {
  const data = await getOverview();
  const onAir = data.programme.video;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p className="page-sub">
            Everything on this page is read live from the API. Nothing is cached,
            so what you see is what viewers are getting.
          </p>
        </div>
        <div className="mono">as of {timestamp(data.generatedAt)}</div>
      </div>

      {/* What owns the main page right now. The single most important fact in
          the back office, so it goes first and largest. */}
      <div className={`panel ${onAir ? 'onair' : 'onair-empty'}`} style={{ marginBottom: 20 }}>
        <div className="panel-body spread">
          <div>
            <span className="stat-label">{onAir ? 'Main broadcast' : 'No main broadcast set'}</span>
            {onAir ? (
              <>
                <div className="headline">{onAir.title}</div>
                <div className="stat-note">
                  {onAir.productId}, set {timestamp(data.programme.programme?.setAt)}
                  {data.programme.programme?.note ? `. ${data.programme.programme.note}` : ''}
                </div>
              </>
            ) : (
              <div className="stat-note" style={{ maxWidth: '60ch' }}>
                The stage is falling back to the seeded Central TV programme. Set a
                main broadcast and it takes the main page, and every video a viewer
                clicks returns to it when that video ends.
              </div>
            )}
          </div>
          <Link href="/programme" className="btn btn-primary">
            {onAir ? 'Change programme' : 'Set programme'}
          </Link>
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <Stat
          label="Library"
          value={data.library.total}
          note={`${data.library.published} published, ${data.library.drafts} draft, ${data.library.archived} archived`}
        />
        <Stat
          label="Stored video"
          value={bytes(data.library.storedBytes)}
          note="uploaded files on disk"
        />
        <Stat
          label="Viewers"
          value={data.viewers?.total ?? '—'}
          note={data.viewers ? `${data.viewers.newLast7d} new this week, ${data.viewers.activeSessions} active sessions` : 'not reporting'}
        />
        <Stat
          label="KashCoin spent"
          value={coins(data.spend?.coinsSpent)}
          note={data.spend ? `${data.spend.gifts} gifts sent` : 'not reporting'}
        />
      </div>

      <div className="grid grid-3">
        <div className="panel">
          <div className="panel-head"><h2>Moderation</h2><Link href="/moderation" className="btn btn-sm">Queue</Link></div>
          <div className="panel-body">
            {data.moderation ? (
              <div className="stack-loose">
                <div className="spread"><span className="stat-note">Allowed</span><span className="num">{data.moderation.allow}</span></div>
                <div className="spread"><span className="stat-note">Flagged for review</span><span className="num text-amber">{data.moderation.flag}</span></div>
                <div className="spread"><span className="stat-note">Blocked</span><span className="num text-danger">{data.moderation.block}</span></div>
                <div className="mono" style={{ marginTop: 4 }}>ruleset {data.moderation.rulesetVersion}</div>
              </div>
            ) : <div className="empty">Not reporting.</div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Feed</h2></div>
          <div className="panel-body">
            {data.engagement ? (
              <div className="stack-loose">
                <div className="spread"><span className="stat-note">Posts</span><span className="num">{data.engagement.posts}</span></div>
                <div className="spread"><span className="stat-note">Comments</span><span className="num">{data.engagement.comments}</span></div>
                <div className="spread"><span className="stat-note">Upvotes</span><span className="num">{data.engagement.upvotes}</span></div>
                {data.engagement.flagged > 0 ? (
                  <div className="spread"><span className="stat-note">Flagged posts</span><span className="num text-amber">{data.engagement.flagged}</span></div>
                ) : null}
              </div>
            ) : <div className="empty">Not reporting.</div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Treasury</h2></div>
          <div className="panel-body">
            {data.spend ? (
              <div className="stack-loose">
                <div className="spread"><span className="stat-note">Coins issued</span><span className="num">{coins(data.spend.coinsIssued)}</span></div>
                <div className="spread"><span className="stat-note">Coins spent</span><span className="num">{coins(data.spend.coinsSpent)}</span></div>
                {/* The ledger is double entry and must sum to zero. Surfacing it
                    here means a drift shows up on a dashboard, not in a ticket. */}
                <div className="spread">
                  <span className="stat-note">Ledger balanced</span>
                  <span className={`pill ${data.spend.ledgerBalanced ? 'pill-published' : 'pill-block'}`}>
                    {data.spend.ledgerBalanced ? 'balanced' : 'drifting'}
                  </span>
                </div>
              </div>
            ) : <div className="empty">Not reporting.</div>}
          </div>
        </div>
      </div>
    </>
  );
}
