import { getProducts, getTasks } from '@/lib/api';
import { coins, timestamp } from '@/lib/format';
import { TaskForm } from './task-form';
import { TaskReview } from './task-review';

export const dynamic = 'force-dynamic';

const PILL: Record<string, string> = {
  open: 'pill-ready',
  accepted: 'pill-draft',
  delivered: 'pill-flag',
  approved: 'pill-published',
  rejected: 'pill-block',
};

export default async function TasksPage() {
  const [{ tasks }, { products }] = await Promise.all([getTasks(), getProducts()]);
  const delivered = tasks.filter((t) => t.status === 'delivered').length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="page-sub">
            Commissioned briefs for creators. Approving a delivery publishes it
            to the spotlight and pays the bounty from the treasury, exactly once.
          </p>
        </div>
        <div className="mono num">{delivered} awaiting review</div>
      </div>

      <div className="grid grid-split" style={{ alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head">
            <h2>All briefs</h2>
            <span className="mono num">{tasks.length}</span>
          </div>
          {tasks.length === 0 ? (
            <div className="empty">No briefs yet. Post the first one with the form.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Brief</th><th>Status</th><th className="num-col">Bounty</th><th>Assignee</th><th></th></tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <div className="stack">
                        <span style={{ fontWeight: 600 }}>{t.title}</span>
                        <span className="mono">{t.productId}, posted {timestamp(t.createdAt)}</span>
                      </div>
                    </td>
                    <td><span className={`pill ${PILL[t.status] ?? ''}`}>{t.status}</span></td>
                    <td className="num num-col">{coins(t.bounty)}</td>
                    <td className="mono">{t.assigneeId ?? '—'}</td>
                    <td>{t.status === 'delivered' ? <TaskReview taskId={t.id} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Post a brief</h2></div>
          <div className="panel-body">
            <TaskForm products={products} />
          </div>
        </div>
      </div>
    </>
  );
}
