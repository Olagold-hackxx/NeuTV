import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getProducts, getProgramme, getVideo, ApiError } from '@/lib/api';
import { bytes, duration, timestamp } from '@/lib/format';
import { VideoPanel } from './video-panel';

export const dynamic = 'force-dynamic';

export default async function VideoDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let video;
  try {
    ({ video } = await getVideo(id));
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const [{ products }, programme] = await Promise.all([getProducts(), getProgramme()]);
  const isOnAir = programme.video?.id === video.id;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="mono" style={{ marginBottom: 6 }}>
            <Link href="/videos">← Videos</Link>
          </div>
          <h1>{video.title}</h1>
          <p className="page-sub">
            <span className={`pill pill-${video.status}`}>{video.status}</span>
            {isOnAir ? <span className="pill pill-published" style={{ marginLeft: 8 }}><span className="live-dot" /> on air</span> : null}
          </p>
        </div>
      </div>

      <div className="grid grid-2" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
        <VideoPanel video={video} products={products} isOnAir={isOnAir} />

        <div className="panel">
          <div className="panel-head"><h2>Details</h2></div>
          <div className="panel-body">
            <table>
              <tbody>
                <tr><td className="stat-note">Id</td><td className="mono">{video.id}</td></tr>
                <tr><td className="stat-note">Kind</td><td>{video.kind}</td></tr>
                <tr><td className="stat-note">Product</td><td className="mono">{video.productId}</td></tr>
                <tr><td className="stat-note">Length</td><td className="num">{duration(video.durationSeconds)}</td></tr>
                <tr><td className="stat-note">File</td><td className="num mono">{video.fileSize ? bytes(video.fileSize) : '—'}</td></tr>
                <tr><td className="stat-note">Type</td><td className="mono">{video.contentType ?? '—'}</td></tr>
                <tr>
                  <td className="stat-note">Playback</td>
                  <td className="mono" style={{ wordBreak: 'break-all' }}>{video.playbackUrl ?? '— nothing to play yet'}</td>
                </tr>
                <tr><td className="stat-note">Created</td><td className="mono">{timestamp(video.createdAt)}</td></tr>
                <tr><td className="stat-note">Updated</td><td className="mono">{timestamp(video.updatedAt)}</td></tr>
              </tbody>
            </table>
            {video.description ? (
              <p className="stat-note" style={{ marginTop: 14, lineHeight: 1.55 }}>{video.description}</p>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
