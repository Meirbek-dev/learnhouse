'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('Errors');

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
          <h2>{t('somethingWentWrong')}</h2>
          {error.digest && (
            <p style={{ color: '#666', fontSize: '14px' }}>
              Error ID: {error.digest}
            </p>
          )}
          {process.env.NODE_ENV !== 'production' && (
            <details style={{ marginTop: '20px' }}>
              <summary style={{ cursor: 'pointer' }}>Error Details</summary>
              <pre style={{ background: '#f5f5f5', padding: '10px', overflow: 'auto' }}>
                {error.stack}
              </pre>
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
            {t('tryAgain')}
          </button>
        </div>
      </body>
    </html>
  );
}
