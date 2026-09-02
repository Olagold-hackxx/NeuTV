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

  // Every page here is a thin client of the API, so the most common failure by
  // far is the API not running (or mid-restart) when the page rendered.
  const looksUnreachable = /could not be reached|api_unreachable|fetch failed|ECONNREFUSED/i
    .test(error?.message ?? '');

  let explanation = 'Something failed while rendering this page.';
  if (looksUnreachable) {
    explanation =
      'The NEU Network API is not responding, so this page had nothing to render. ' +
      'Start the backend (npm start, port 4173) or wait for it to finish restarting, then try again.';
  } else if (looksLikeSkew) {
    explanation =
      'The app was rebuilt while this tab was open, so it was asking for files that no longer exist. A reload fixes it.';
  }

  return (
    <div className="panel" style={{ padding: 40, maxWidth: 560, margin: '48px auto', textAlign: 'center' }}>
      <h1 style={{ marginBottom: 10 }}>
        {looksUnreachable ? 'The API is unreachable' : 'That page didn’t load'}
      </h1>
      <p className="page-sub" style={{ margin: '0 auto 22px' }}>{explanation}</p>

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
