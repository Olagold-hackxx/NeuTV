import Link from 'next/link';
import { getProducts, getVideos, getProgramme } from '@/lib/api';
import { bytes, duration, timestamp } from '@/lib/format';
import { NewVideoForm } from './new-video-form';
import type { VideoStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STATUS_ORDER: VideoStatus[] = ['published', 'ready', 'draft', 'archived'];

export default async function VideosPage() {
  const [{ videos }, { products }, programme] = await Promise.all([
    getVideos(), getProducts(), getProgramme(),
  ]);
  const onAirId = programme.video?.id ?? null;

  // Published first, then ready, drafts, and archived last: the list should
  // open on what is live, not on what someone abandoned.
  const sorted = [...videos].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || b.createdAt - a.createdAt,
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Videos</h1>
          <p className="page-sub">
            The library behind the network. An uploaded video becomes playable once
            its file lands; an external one is playable immediately.
          </p>
        </div>
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1.6fr 1fr', alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head">
            <h2>Library</h2>
            <span className="mono">{videos.length} total</span>
          </div>
          {sorted.length === 0 ? (
            <div className="empty">Nothing in the library yet. Add the first video on the right.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Title</th><th>Status</th><th>Product</th><th>Length</th><th>Size</th><th>Added</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/videos/${v.id}`} className="stack">
                        <span style={{ fontWeight: 600 }}>{v.title}</span>
                        <span className="mono">
                          {v.kind}
                          {v.id === onAirId ? ' · on air' : ''}
                          {!v.hasFile && v.kind === 'upload' ? ' · awaiting file' : ''}
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className={`pill pill-${v.status}`}>
                        {v.id === onAirId ? <span className="live-dot" /> : null}
                        {v.status}
                      </span>
                    </td>
                    <td className="mono">{v.productId}</td>
                    <td className="num">{duration(v.durationSeconds)}</td>
                    <td className="num mono">{v.fileSize ? bytes(v.fileSize) : '—'}</td>
                    <td className="mono">{timestamp(v.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Add a video</h2></div>
          <div className="panel-body">
            <NewVideoForm products={products} />
          </div>
        </div>
      </div>
    </>
  );
}
