import { getModerationQueue } from '@/lib/api';
import { timestamp } from '@/lib/format';

export const dynamic = 'force-dynamic';

const SURFACE_LABEL: Record<string, string> = {
  post: 'Feed post',
  comment: 'Post comment',
  live_comment: 'Live ticker',
  chat: 'Hub chat',
  profile: 'Profile',
};

export default async function ModerationPage() {
  const { queue } = await getModerationQueue();
  const flagged = queue.filter((q) => q.verdict === 'flag');
  const blocked = queue.filter((q) => q.verdict === 'block');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Moderation</h1>
          <p className="page-sub">
            Everything the ruleset did not clear. <strong>Blocked</strong> never
            reached anyone. <strong>Flagged</strong> is live right now and is
            waiting on a human — that is this queue&apos;s job.
          </p>
        </div>
        <div className="mono">{flagged.length} live and flagged, {blocked.length} blocked</div>
      </div>

      {flagged.length > 0 ? (
        <div className="alert alert-warn" style={{ marginBottom: 18 }}>
          {flagged.length} message{flagged.length === 1 ? ' is' : 's are'} published and
          awaiting review. The ruleset publishes borderline messages rather than
          blocking them, because silencing a real viewer on a live broadcast is
          the worse mistake.
        </div>
      ) : null}

      <div className="panel">
        {queue.length === 0 ? (
          <div className="empty">Nothing has been flagged or blocked.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Verdict</th><th>Message</th><th>Surface</th><th>Rules</th><th className="num-col">Score</th><th>When</th></tr>
            </thead>
            <tbody>
              {queue.map((item) => (
                <tr key={item.id}>
                  <td><span className={`pill pill-${item.verdict}`}>{item.verdict}</span></td>
                  <td style={{ maxWidth: 380 }}>
                    <div className="stack">
                      <span style={{ lineHeight: 1.45 }}>{item.excerpt}</span>
                      {item.userId ? <span className="mono">{item.userId}</span> : <span className="mono">guest</span>}
                    </div>
                  </td>
                  <td>{SURFACE_LABEL[item.surface] ?? item.surface}</td>
                  <td>
                    <div className="actions">
                      {item.ruleIds.map((rule) => (
                        <span key={rule} className="pill">{rule.replace(/_/g, ' ')}</span>
                      ))}
                    </div>
                  </td>
                  <td className="num num-col">{item.score}</td>
                  <td className="mono">{timestamp(item.decidedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="hint" style={{ marginTop: 16, maxWidth: '72ch' }}>
        Taking a flagged message down is not wired up yet: the API has no delete
        route for a published comment. That is the next thing to add here.
      </p>
    </>
  );
}
