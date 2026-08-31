import { getProgramme, getVideos } from '@/lib/api';
import { duration, timestamp } from '@/lib/format';
import { ProgrammePicker } from './programme-picker';

export const dynamic = 'force-dynamic';

export default async function ProgrammePage() {
  const [programme, { videos }] = await Promise.all([getProgramme(), getVideos()]);

  // Only something with bytes or a source URL can go on air, and archived
  // content is out. Filtering here means the picker cannot offer a choice the
  // API would reject.
  const eligible = videos.filter(
    (v) => v.status !== 'archived' && (v.hasFile || v.playbackUrl),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Programme</h1>
          <p className="page-sub">
            The main broadcast owns the main page. When a viewer clicks any other
            video it takes the stage, and when that video ends the stage returns
            here on its own.
          </p>
        </div>
      </div>

      <div className={`panel ${programme.video ? 'onair' : 'onair-empty'}`} style={{ marginBottom: 20 }}>
        <div className="panel-body">
          <span className="stat-label">{programme.video ? 'On air now' : 'Nothing set'}</span>
          {programme.video ? (
            <>
              <div className="headline">{programme.video.title}</div>
              <div className="stat-note">
                {programme.video.productId}, {duration(programme.video.durationSeconds)}, set{' '}
                {timestamp(programme.programme?.setAt)} by {programme.programme?.setBy}
                {programme.programme?.note ? `. ${programme.programme.note}` : ''}
              </div>
            </>
          ) : (
            <div className="stat-note" style={{ maxWidth: '68ch' }}>
              No main broadcast has been set, so the stage falls back to the seeded
              Central TV programme that ships with the catalog. Pick an eligible
              video and it takes the main page immediately.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-split-narrow" style={{ alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Put something on air</h2>
            <span className="mono">{eligible.length} eligible</span>
          </div>
          <div className="panel-body">
            <ProgrammePicker videos={eligible} currentId={programme.video?.id ?? null} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2>History</h2></div>
          {programme.history?.length ? (
            <table>
              <thead><tr><th>Video</th><th>By</th><th>When</th></tr></thead>
              <tbody>
                {programme.history.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <div className="stack">
                        <span style={{ fontWeight: 600 }}>
                          {videos.find((v) => v.id === h.videoId)?.title ?? h.videoId}
                        </span>
                        {h.note ? <span className="mono">{h.note}</span> : null}
                      </div>
                    </td>
                    <td className="mono">{h.setBy}</td>
                    <td className="mono">{timestamp(h.setAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="empty">Nothing has been put on air yet.</div>}
        </div>
      </div>
    </>
  );
}
