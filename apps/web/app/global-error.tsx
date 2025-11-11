'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Log detailed error info in production
    console.error('Global Error Caught:', {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
          <h2>Что-то пошло не так</h2>
          {error.digest && <p style={{ color: '#666', fontSize: '14px' }}>Error ID: {error.digest}</p>}
          <p style={{ color: '#333', marginTop: '10px' }}>
            {error.message || 'An unexpected error occurred. Please try refreshing the page.'}
          </p>
          {process.env.NODE_ENV !== 'production' && (
            <details style={{ marginTop: '20px' }}>
              <summary style={{ cursor: 'pointer' }}>Error Details</summary>
              <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>{error.stack}</pre>
            </details>
          )}
          <button
            onClick={() => reset()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
            }}
          >
            Попытайтесь снова
          </button>
        </div>
      </body>
    </html>
  );
}
