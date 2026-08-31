'use client';

// The API-unreachable state. A designed screen, not a browser error: it says
// what happened and offers the one useful action.
export function Offline() {
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-panel bg-midnight border border-line text-lg font-extrabold text-dim">
          N
        </div>
        <h1 className="text-xl font-extrabold tracking-tight">NEU TV is temporarily unavailable</h1>
        <p className="mt-3 text-sm text-dim leading-relaxed">
          The broadcast could not be loaded. This is on our side, not yours.
          Try again in a moment.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-control bg-cyan px-5 py-2.5 text-sm font-bold text-deep transition hover:brightness-110"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
