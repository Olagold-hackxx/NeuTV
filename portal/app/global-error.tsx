'use client';

/**
 * Last-resort boundary: catches failures in the root layout itself, where
 * app/error.tsx cannot help because the layout is what broke. It has to render
 * its own <html> and <body>, and cannot rely on the app stylesheet loading.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center',
        background: '#060a12', color: '#edf1f7',
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center', padding: 32, maxWidth: 460 }}>
          <h1 style={{ fontSize: 24, marginBottom: 10 }}>NEU Network back office failed to start</h1>
          <p style={{ opacity: 0.6, fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
            The API may be unreachable. Check that it is running on port 4173.
          </p>
          <button
            type="button"
            onClick={() => { reset(); window.location.reload(); }}
            style={{
              padding: '10px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: '#00f6a7', color: '#04211a',
              fontWeight: 800, fontSize: 13,
            }}
          >
            Reload
          </button>
          {error?.digest ? <p style={{ opacity: 0.35, fontSize: 11, marginTop: 16 }}>Reference: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
