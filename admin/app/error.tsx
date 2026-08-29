'use client';

/**
 * Page-level error boundary.
 *
 * Without this, any runtime failure inside a route shows the browser's raw
 * "This page couldn't load" screen with no context and no way back.
 *
 * The common cause in practice is version skew: the app is rebuilt while a tab
 * is open, so a client-side navigation asks for chunks from a build id that no
 * longer exists and 404s. A re-render cannot fix that - only a fresh document
 * can - so this offers a real reload alongside the normal retry.
 */
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[admin]', error); }, [error]);

  // A failed chunk fetch is not recoverable by re-rendering.
  const looksLikeSkew = /Loading chunk|ChunkLoadError|Failed to fetch|dynamically imported module/i
    .test(error?.message ?? '');

  return (
    <div className="panel" style={{ padding: 40, maxWidth: 560, margin: '48px auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 10 }}>That page didn&apos;t load</h1>
      <p className="page-sub" style={{ margin: '0 auto 22px' }}>
        {looksLikeSkew
          ? 'The app was rebuilt while this tab was open, so it was asking for files that no longer exist. A reload fixes it.'
          : 'Something failed while rendering this page.'}
      </p>

      <div className="actions" style={{ justifyContent: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
        {!looksLikeSkew ? (
          <button type="button" className="btn" onClick={reset}>Try again</button>
        ) : null}
      </div>

      {error?.digest ? <p className="hint" style={{ marginTop: 18 }}>Reference: {error.digest}</p> : null}
    </div>
  );
}
