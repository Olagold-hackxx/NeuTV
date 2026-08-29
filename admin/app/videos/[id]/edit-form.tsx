'use client';

// Editing a video that is already in the library.
//
// Two things are being edited here and they behave differently. The metadata -
// title, description, poster, length - is free text an operator can correct at
// any time. The playback source is a choice between three mutually exclusive
// things, and picking one drops the others; the API enforces that, and this
// form is shaped to match so the rule is visible before the save rather than
// surprising afterwards.
//
// Everything is one form with one Save. The panel next door edits status and
// product on change, which suits a single select, but a title you are halfway
// through typing must not save itself.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateVideo } from '@/lib/actions';
import type { Video, VideoPatch } from '@/lib/types';
import { UploadField } from './upload-field';

type SourceKind = 'file' | 'url' | 'youtube';

/** Which of the three a video plays from right now. */
function currentSource(video: Video): SourceKind {
  if (video.kind === 'upload') return 'file';
  if (video.youtubeId) return 'youtube';
  return 'url';
}

/** Seconds back into the "04:12" / "1:02:33" the form takes. */
function toDisplayDuration(seconds: number): string {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function EditForm({ video, isOnAir }: { video: Video; isOnAir: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState(video.title);
  const [description, setDescription] = useState(video.description);
  const [posterUrl, setPosterUrl] = useState(video.posterUrl ?? '');
  const [durationText, setDurationText] = useState(toDisplayDuration(video.durationSeconds));

  const [source, setSource] = useState<SourceKind>(currentSource(video));
  // An external video's URL is the resolved playbackUrl; an uploaded one's
  // playbackUrl is the media route, which is not something to edit.
  const [sourceUrl, setSourceUrl] = useState(
    video.kind === 'external' && !video.youtubeId ? (video.playbackUrl ?? '') : '',
  );
  const [youtubeId, setYoutubeId] = useState(video.youtubeId ?? '');

  const wasSource = currentSource(video);
  const sourceChanged = source !== wasSource
    || (source === 'url' && sourceUrl.trim() !== (video.playbackUrl ?? ''))
    || (source === 'youtube' && youtubeId.trim() !== (video.youtubeId ?? ''));

  // Switching to a file leaves nothing to play until bytes land, which the API
  // refuses for the video on air rather than blanking the front page.
  const blocked = isOnAir && source === 'file' && !video.hasFile;

  const save = () => {
    setError(null);
    setNotice(null);

    const patch: VideoPatch = {};
    if (title.trim() !== video.title) patch.title = title.trim();
    if (description.trim() !== video.description) patch.description = description.trim();
    if (posterUrl.trim() !== (video.posterUrl ?? '')) patch.posterUrl = posterUrl.trim();
    if (durationText.trim() !== toDisplayDuration(video.durationSeconds)) patch.duration = durationText.trim();

    if (sourceChanged) {
      if (source === 'file') {
        patch.kind = 'upload';
      } else if (source === 'youtube') {
        if (!youtubeId.trim()) return setError('A YouTube video needs an id.');
        patch.kind = 'external';
        patch.youtubeId = youtubeId.trim();
      } else {
        if (!sourceUrl.trim()) return setError('An external video needs a source URL.');
        patch.kind = 'external';
        patch.sourceUrl = sourceUrl.trim();
      }
    }

    if (Object.keys(patch).length === 0) return setNotice('Nothing to save.');

    startTransition(async () => {
      const res = await updateVideo(video.id, patch);
      if (!res.ok) return setError(res.error ?? 'That did not save.');
      setNotice(
        patch.kind === 'upload' && !video.hasFile
          ? 'Saved. Upload a file below to make it playable again.'
          : 'Saved.',
      );
      router.refresh();
    });
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Edit</h2>
        <span className="mono">{video.status}</span>
      </div>
      <div className="panel-body">
        {error ? <div className="alert alert-error">{error}</div> : null}
        {notice ? <div className="alert alert-ok">{notice}</div> : null}

        <div className="field">
          <label htmlFor="title">Title</label>
          <input
            id="title" value={title} minLength={2} maxLength={160} disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description" value={description} maxLength={2000} disabled={pending}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="duration">Length</label>
            <input
              id="duration" value={durationText} placeholder="04:12" maxLength={20} disabled={pending}
              onChange={(e) => setDurationText(e.target.value)}
            />
            <p className="hint">Sets how long a takeover holds the stage.</p>
          </div>
          <div className="field">
            <label htmlFor="posterUrl">Poster URL</label>
            <input
              id="posterUrl" type="url" value={posterUrl} placeholder="https://…" disabled={pending}
              onChange={(e) => setPosterUrl(e.target.value)}
            />
            {/* Nothing generates a thumbnail from an uploaded file, so without
                this the card on the site falls back to a frame of the video
                itself. That works, but it is whatever the first frame happens
                to be - often black. */}
            {!posterUrl.trim() ? (
              <p className="hint">
                No poster. The site will show a frame from the video instead, which
                is usually the opening black frame.
              </p>
            ) : null}
          </div>
        </div>

        <div className="field">
          <label htmlFor="source">Plays from</label>
          <select
            id="source" value={source} disabled={pending}
            onChange={(e) => setSource(e.target.value as SourceKind)}
          >
            <option value="url">An external URL</option>
            <option value="youtube">YouTube</option>
            <option value="file">A file uploaded here</option>
          </select>
          <p className="hint">
            A video plays from exactly one of these. Choosing another replaces the
            current one — the old address stops being how this video is reached.
          </p>
        </div>

        {source === 'url' ? (
          <div className="field">
            <label htmlFor="sourceUrl">Source URL</label>
            <input
              id="sourceUrl" type="url" value={sourceUrl} disabled={pending}
              placeholder="https://cdn.example.com/clip.mp4"
              onChange={(e) => setSourceUrl(e.target.value)}
            />
            <p className="hint">A direct MP4 or an HLS manifest.</p>
          </div>
        ) : null}

        {source === 'youtube' ? (
          <div className="field">
            <label htmlFor="youtubeId">YouTube id</label>
            <input
              id="youtubeId" value={youtubeId} maxLength={40} placeholder="xHU5MHuUSKI" disabled={pending}
              onChange={(e) => setYoutubeId(e.target.value)}
            />
            <p className="hint">Just the id, not the whole watch URL. Played through youtube-nocookie.</p>
          </div>
        ) : null}

        {source === 'file' && wasSource !== 'file' ? (
          <div className="alert alert-warn">
            Saving switches this video to a file. It will have nothing to play
            until one is uploaded, so it drops back to a draft
            {video.status === 'published' ? ' and stops being published' : ''}.
          </div>
        ) : null}

        {blocked ? (
          <div className="alert alert-error">
            This is the main broadcast. Put another video on air before leaving
            this one with nothing to play.
          </div>
        ) : null}

        <div className="actions" style={{ marginTop: 18 }}>
          <button type="button" className="btn btn-primary" disabled={pending || blocked} onClick={save}>
            {pending ? 'Saving…' : 'Save changes'}
          </button>
        </div>

        {/* The file lands through its own streaming route, not this form: a
            multi-gigabyte video does not belong in a server action payload. */}
        {video.kind === 'upload' ? (
          <div style={{ marginTop: 22, paddingTop: 18, borderTop: '1px solid var(--line, rgba(255,255,255,0.08))' }}>
            <UploadField video={video} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
