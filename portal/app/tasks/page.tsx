import { getMyTasks, getMyVideos, getSession } from '@/lib/api';
import { redirect } from 'next/navigation';
import { coins, timestamp } from '@/lib/format';
import { AcceptButton, DeliverForm } from './task-actions';

export const dynamic = 'force-dynamic';

export default async function TasksPage() {
  const user = await getSession();
  if (user && user.role !== 'creator' && user.role !== 'admin') redirect('/');

  const [{ tasks }, { videos }] = await Promise.all([getMyTasks(), getMyVideos()]);
  const mine = tasks.filter((t) => t.assigneeId === user?.id);
  const open = tasks.filter((t) => t.status === 'open');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Tasks</h1>
          <p className="page-sub">
            Commissioned work from the network. Accepting a brief reserves it
            for you; delivering sends your video to review, and approval pays
            the bounty into your wallet.
          </p>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Open briefs</h2>
            <span className="mono num">{open.length}</span>
          </div>
          {open.length === 0 ? (
            <div className="empty">Nothing open right now. New briefs appear here as the network posts them.</div>
          ) : (
            <div className="panel-body stack" style={{ gap: 16 }}>
              {open.map((t) => (
                <div key={t.id} className="panel" style={{ background: 'var(--base)' }}>
                  <div className="panel-body">
                    <div className="spread">
                      <div style={{ fontWeight: 700 }}>{t.title}</div>
                      <span className="pill pill-published num">{coins(t.bounty)} KASH</span>
                    </div>
                    {t.brief ? <p className="stat-note" style={{ marginTop: 6 }}>{t.brief}</p> : null}
                    <div className="stat-note" style={{ marginTop: 4 }}>
                      {t.productId}{t.deadline ? `, due ${timestamp(t.deadline)}` : ''}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <AcceptButton taskId={t.id} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Yours</h2>
            <span className="mono num">{mine.length}</span>
          </div>
          {mine.length === 0 ? (
            <div className="empty">Accept a brief and it moves here.</div>
          ) : (
            <div className="panel-body stack" style={{ gap: 16 }}>
              {mine.map((t) => (
                <div key={t.id} className="panel" style={{ background: 'var(--base)' }}>
                  <div className="panel-body">
                    <div className="spread">
                      <div style={{ fontWeight: 700 }}>{t.title}</div>
                      <span className={`pill ${
                        t.status === 'approved' ? 'pill-published'
                        : t.status === 'delivered' ? 'pill-ready'
                        : t.status === 'rejected' ? 'pill-block'
                        : 'pill-draft'
                      }`}>{t.status}</span>
                    </div>
                    <div className="stat-note" style={{ marginTop: 4 }}>
                      <span className="num">{coins(t.bounty)} KASH</span>
                      {t.status === 'approved' ? ', paid' : t.status === 'delivered' ? ', in review' : ''}
                    </div>
                    {t.status === 'accepted' ? (
                      <div style={{ marginTop: 10 }}>
                        <DeliverForm taskId={t.id} videos={videos} />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
