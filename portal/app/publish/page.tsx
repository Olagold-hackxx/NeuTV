import { redirect } from 'next/navigation';
import { getMyLive, getMyVideos, getProducts, getSession } from '@/lib/api';
import { duration, timestamp } from '@/lib/format';
import { NewVideoForm } from './new-video-form';
import { VideoRowActions } from './video-row-actions';
import { LiveForm } from './live-form';
import { Studio } from './studio';

export const dynamic = 'force-dynamic';

export default async function PublishPage() {
  const user = await getSession();
  if (user && user.role !== 'creator' && user.role !== 'admin') redirect('/');

  const [{ videos }, { events }, { products }] = await Promise.all([
    getMyVideos(), getMyLive(), getProducts(),
  ]);
  const onAir = events.find((e) => e.isLive) ?? null;
  const nextSession = onAir ?? events.find((e) => e.status === 'scheduled') ?? null;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Publish</h1>
          <p className="page-sub">
            Everything here lands on your spotlight channel: your videos, your
            live sessions. The main broadcast belongs to the network and is
            never touched from this page.
          </p>
        </div>
      </div>

      {onAir ? (
        <div className="panel onair-live" style={{ marginBottom: 20 }}>
          <div className="panel-body">
            <div className="row" style={{ marginBottom: 8 }}>
              <span className="live-dot" />
              <span className="stat-label">Your channel is live</span>
            </div>
            <div className="headline">{onAir.title}</div>
          </div>
        </div>
      ) : null}

      <div className="grid grid-split" style={{ alignItems: 'start', marginBottom: 20 }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <h2>Your videos</h2>
              <span className="mono num">{videos.length} total</span>
            </div>
            {videos.length === 0 ? (
              <div className="empty">Nothing on your channel yet. Add the first video with the form.</div>
            ) : (
              <table>
                <thead>
                  <tr><th>Title</th><th>Status</th><th>Length</th><th>Added</th><th></th></tr>
                </thead>
                <tbody>
                  {videos.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div className="stack">
                          <span style={{ fontWeight: 600 }}>{v.title}</span>
                          <span className="mono">
                            {v.kind}
                            {!v.hasFile && v.kind === 'upload' ? ', awaiting file' : ''}
                          </span>
                        </div>
                      </td>
                      <td><span className={`pill pill-${v.status}`}>{v.status}</span></td>
                      <td className="num">{duration(v.durationSeconds)}</td>
                      <td className="mono">{timestamp(v.createdAt)}</td>
                      <td><VideoRowActions video={v} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {nextSession ? <Studio event={nextSession} /> : null}
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="panel">
            <div className="panel-head"><h2>Add a video</h2></div>
            <div className="panel-body">
              <NewVideoForm products={products} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head"><h2>Go live</h2></div>
            <div className="panel-body">
              <LiveForm products={products} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
