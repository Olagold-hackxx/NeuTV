'use client';

// The expanded video viewer. Watching happens here; "Stream on Central TV
// Stage" promotes the video to this viewer's stage.

import { Tv } from 'lucide-react';

export type ModalVideo = {
  id?: string;
  title: string;
  description?: string;
  youtubeId?: string | null;
  videoUrl?: string | null;
  thumbnail?: string | null;
  productName?: string;
  views?: string | number;
  creator?: string;
  raw: Record<string, unknown>;
};

type VideoModalProps = {
  video: ModalVideo;
  onClose: () => void;
  onPromote: (raw: Record<string, unknown>) => void;
};

export function VideoModal({ video, onClose, onPromote }: VideoModalProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 animate-fadeIn select-none"
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="rounded-3xl w-full max-w-3xl overflow-hidden border border-white/20 bg-[#0A0A0C] shadow-[0_30px_90px_rgba(0,0,0,0.95)] flex flex-col animate-scaleUp">
        <div className="relative aspect-video bg-black">
          {video.youtubeId ? (
            <iframe
              title={video.title}
              src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
              allow="autoplay; encrypted-media; fullscreen"
              className="w-full h-full object-cover border-0"
            />
          ) : video.videoUrl ? (
            <video src={video.videoUrl} controls autoPlay playsInline poster={video.thumbnail ?? undefined} className="w-full h-full object-cover" />
          ) : video.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={video.thumbnail} alt="" className="w-full h-full object-cover" />
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center hover:bg-white hover:text-black transition border border-white/20 z-20 shadow-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-white/10 text-white border border-white/15 text-xs font-black">
              {video.productName || 'Ecosystem'}
            </span>
            {video.views ? <span className="text-xs text-white/60 font-mono font-bold num">{video.views} views</span> : null}
          </div>
          <h2 className="text-lg md:text-xl font-black text-white leading-snug">{video.title}</h2>
          {video.description ? <p className="text-xs text-white/70 leading-relaxed line-clamp-3">{video.description}</p> : null}
          <div className="text-xs text-white/70 flex items-center justify-between pt-3 border-t border-white/10">
            <span>
              {video.creator ? (
                <>
                  Creator Spotlight: <strong className="text-white font-extrabold">{video.creator}</strong>
                </>
              ) : (
                'NEU TV Official'
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                onPromote(video.raw);
                onClose();
              }}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-neutral-200 text-black font-black text-xs transition flex items-center gap-1.5 shadow-md"
            >
              <Tv className="w-3.5 h-3.5" />
              Stream on Central TV Stage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
