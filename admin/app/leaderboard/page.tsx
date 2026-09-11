import { getLeaderboardAdmin, getRevenue } from '@/lib/api';
import { coins, timestamp } from '@/lib/format';
import { SettleButton } from './settle-button';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(3, '0');

export default async function LeaderboardPage() {
  const [board, revenue] = await Promise.all([getLeaderboardAdmin(), getRevenue()]);
  const { open, settleable, awards } = board;

  const standingsTable = (rows: typeof open.standings) => rows.length === 0 ? (
    <div className="empty">No votes cast.</div>
  ) : (
    <table>
      <thead><tr><th>#</th><th>Creator</th><th>Channel</th><th className="num-col">Votes</th></tr></thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.userId}>
            <td className="num">{s.rank}</td>
            <td>
              <div className="stack">
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span className="mono">{s.handle}</span>
              </div>
            </td>
            <td className="mono num">{s.channelNumber ? `Ch ${pad(s.channelNumber)}` : '—'}</td>
            <td className="num num-col">{s.votes}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Viewers&apos; choice</h1>
          <p className="page-sub">
            The quarterly leaderboard, decided by viewers and public to all of
            them. The winner takes {board.sharePct}% of the quarter&apos;s network
            revenue, paid from the treasury when the quarter is settled here.
          </p>
        </div>
      </div>

      {settleable ? (
        <div className="panel onair-empty" style={{ marginBottom: 20 }}>
          <div className="panel-body spread">
            <div>
              <span className="stat-label">{settleable.quarter} has closed and is not settled</span>
              <div className="headline">
                {settleable.standings[0]
                  ? `${settleable.standings[0].name} leads with ${settleable.standings[0].votes} votes`
                  : 'No votes were cast'}
              </div>
              <div className="stat-note num">
                Revenue {coins(settleable.revenue.total)} KASH, so the prize is {coins(settleable.prize)} KASH.
              </div>
            </div>
            <SettleButton quarter={settleable.quarter} prize={settleable.prize} winner={settleable.standings[0]?.name ?? null} />
          </div>
        </div>
      ) : null}

      <div className="grid grid-split" style={{ alignItems: 'start', marginBottom: 20 }}>
        <div className="panel">
          <div className="panel-head">
            <h2>{open.quarter}, running</h2>
            <span className="mono">closes {timestamp(open.endsAt)}</span>
          </div>
          {standingsTable(open.standings)}
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="panel stat">
            <div className="stat-label">Prize pool so far</div>
            <div className="stat-value num">{coins(open.prize)} KASH</div>
            <div className="stat-note num">{board.sharePct}% of {coins(open.revenue.total)} KASH network revenue this quarter</div>
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Revenue by quarter</h2></div>
            <table>
              <thead><tr><th>Quarter</th><th className="num-col">Subs</th><th className="num-col">Channels</th><th className="num-col">Gifts</th><th className="num-col">Total</th></tr></thead>
              <tbody>
                {revenue.quarters.map((q) => (
                  <tr key={q.quarter}>
                    <td className="mono">{q.quarter}</td>
                    <td className="num num-col">{coins(q.subscriptions)}</td>
                    <td className="num num-col">{coins(q.purchases)}</td>
                    <td className="num num-col">{coins(q.networkGifts + q.creatorGiftShare)}</td>
                    <td className="num num-col">{coins(q.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h2>Settled quarters</h2>
          <span className="mono num">{awards.length}</span>
        </div>
        {awards.length === 0 ? (
          <div className="empty">No quarter has been settled yet.</div>
        ) : (
          <table>
            <thead><tr><th>Quarter</th><th>Winner</th><th className="num-col">Votes</th><th className="num-col">Revenue</th><th className="num-col">Prize paid</th><th>Settled</th></tr></thead>
            <tbody>
              {awards.map((a) => (
                <tr key={a.quarter}>
                  <td className="mono">{a.quarter}</td>
                  <td>{a.winner ? <>{a.winner.name} <span className="mono">{a.winner.handle}</span></> : <span className="mono">no votes</span>}</td>
                  <td className="num num-col">{a.votes}</td>
                  <td className="num num-col">{coins(a.revenue)}</td>
                  <td className="num num-col">{coins(a.prize)}</td>
                  <td className="mono">{timestamp(a.settledAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
