'use client';

// The API-unreachable state, in house style: says what happened, offers the
// one useful action, never fakes a healthy broadcast.

export function Offline() {
  return (
    <main className="h-screen w-screen bg-black text-white flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-neutral-900 border border-white/15 flex items-center justify-center text-xl font-black italic text-white/70">
          N
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-black tracking-tight">NEU TV is temporarily unavailable</h1>
          <p className="text-xs text-white/60 leading-relaxed">
            We can&rsquo;t load the broadcast right now. This is on our side &mdash; please try
            again in a moment.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 rounded-full bg-[#00F6A7] text-black font-black text-xs transition hover:brightness-110 shadow-lg"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
