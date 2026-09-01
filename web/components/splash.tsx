'use client';

// The boot splash: the NEU cube logo running its signal animation over black.
// Dismisses itself after 2.5s, or on any tap.

export function Splash({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Skip intro"
      className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center space-y-6 select-none cursor-pointer animate-fadeIn w-full"
    >
      <div className="flex flex-col items-center justify-center h-28">
        <div className="flex items-center gap-2.5 h-20">
          {(['n', 'e', 'u'] as const).map((letter) => (
            <div key={letter} className={`neu-anim-cube-${letter} h-full aspect-square`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/logos/neu-cube-${letter}.png`}
                alt={letter.toUpperCase()}
                className="w-full h-full object-contain drop-shadow-[0_0_25px_rgba(0,102,255,0.7)]"
              />
            </div>
          ))}
        </div>
        <div className="neu-anim-red-bar w-full mt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logos/neu-wordmark.png"
            alt="NEW ECONOMY UNVEIL NETWORK"
            className="w-full h-auto object-contain drop-shadow-[0_0_15px_rgba(229,9,20,0.6)]"
          />
        </div>
      </div>
      <div className="text-center space-y-1.5">
        <div className="text-sm font-black tracking-widest text-white uppercase">NEW ECONOMY UNVEIL NETWORK</div>
        <div className="text-xs font-mono tracking-[0.3em] uppercase text-white/50 flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden />
          24/7 LIVE CENTRAL BROADCAST
        </div>
      </div>
      <div className="text-[10px] text-white/30 font-mono tracking-widest uppercase pt-4 animate-pulse">
        Tap anywhere to skip
      </div>
    </button>
  );
}
