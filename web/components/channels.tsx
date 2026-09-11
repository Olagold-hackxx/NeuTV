'use client';

// The channels area: a decoder grid. Vision is channel 1 - the network's own
// stage - and every other number belongs to a creator who bought it. A
// channel plays the way its card plays: a live session goes to the stage, a
// published video opens in the viewer, and a number with nothing up yet is
// listed all the same, because the number is the creator's.

import { useEffect, useState } from 'react';
import { Radio, Tv } from 'lucide-react';
import type { Channel, Spotlight } from '@/lib/types';
import type { NeuTVClient } from '@/lib/client';

type ChannelsProps = {
  client: NeuTVClient;
  onWatchVision: () => void;
  onSelectCreator: (card: Spotlight) => void;
};

const pad = (n: number) => String(n).padStart(3, '0');

export function Channels({ client, onWatchVision, onSelectCreator }: ChannelsProps) {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client.channels()
      .then((res) => {
        if (cancelled) return;
        setPrice(res.price);
        setChannels((res.channels ?? []).map((c) => ({
          ...c,
          thumbnail: client.absoluteMedia(c.thumbnail) ?? c.thumbnail,
          card: c.card
            ? {
                ...c.card,
                videoMp4: client.absoluteMedia(c.card.videoMp4) ?? c.card.videoMp4,
                livePlaybackUrl: client.absoluteMedia(c.card.livePlaybackUrl) ?? c.card.livePlaybackUrl,
                thumbnail: client.absoluteMedia(c.card.thumbnail) ?? c.card.thumbnail,
              }
            : c.card,
        })));
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [client]);

  const open = (channel: Channel) => {
    if (channel.network) onWatchVision();
    else if (channel.card) onSelectCreator(channel.card);
  };

  return (
    <section className="w-full space-y-4 pt-2" aria-label="Channels">
      <div className="flex items-end justify-between px-1 gap-4">
        <div>
          <h2 className="text-base md:text-lg font-black text-white tracking-tight">Channels</h2>
          <p className="text-xs text-white/50 mt-0.5">
            Vision on 1. Every other number is a creator on the network.
          </p>
        </div>
        {price ? (
          <span className="text-[11px] text-white/50 num whitespace-nowrap">
            A decoder number is {price.toLocaleString()} KASH
          </span>
        ) : null}
      </div>

      {failed ? (
        <p className="text-white/60 text-sm px-1">The channels area could not be reached. It retries when you come back.</p>
      ) : channels === null ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton aspect-[16/10] rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {channels.map((channel) => {
            const playable = channel.network || Boolean(channel.card);
            return (
              <button
                key={channel.number}
                type="button"
                onClick={() => open(channel)}
                disabled={!playable}
                aria-label={`Channel ${pad(channel.number)}, ${channel.name}`}
                className={`group relative aspect-[16/10] rounded-2xl overflow-hidden border text-left transition ${
                  channel.network
                    ? 'border-[#00F6A7]/40 bg-[#0A0A0C] hover:border-[#00F6A7]/70'
                    : 'border-white/15 bg-neutral-950 hover:border-white/40'
                } disabled:cursor-default disabled:hover:border-white/15`}
              >
                {channel.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={channel.thumbnail}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-80 transition duration-500"
                  />
                ) : null}
                <span className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" aria-hidden />

                <span className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2">
                  <span className="font-mono text-2xl font-black text-white tracking-tight num drop-shadow">{pad(channel.number)}</span>
                  {channel.isLive ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-live" aria-hidden />
                      LIVE
                    </span>
                  ) : channel.network ? (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00F6A7]/15 border border-[#00F6A7]/40 text-[#00F6A7] text-[9px] font-black">
                      <Tv className="w-3 h-3" /> NETWORK
                    </span>
                  ) : null}
                </span>

                <span className="absolute bottom-3 left-3 right-3 space-y-0.5">
                  <span className="block text-sm font-black text-white leading-tight truncate">{channel.name}</span>
                  <span className="block text-[11px] text-white/70 truncate">
                    {channel.title
                      ? channel.title
                      : channel.tagline
                        ? channel.tagline
                        : 'Nothing on air yet'}
                  </span>
                  {channel.card?.handle ? (
                    <span className="flex items-center gap-1 text-[10px] text-white/50">
                      <Radio className="w-3 h-3" /> {channel.card.handle}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
