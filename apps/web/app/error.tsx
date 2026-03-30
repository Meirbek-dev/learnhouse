'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('Errors');

  useEffect(() => {
    // Log the error to console with full details
    console.error('Root Error Boundary Caught:', {
      message: error.message,
      name: error.name,
      digest: error.digest,
      stack: error.stack,
      cause: error.cause,
      timestamp: new Date().toISOString(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });

    // Send to external logging service if needed
    // fetch('/api/log-error', { ... })
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h2 className="mb-4 text-2xl font-bold">{t('somethingWentWrong')}</h2>

        {error.digest && (
          <p className="mb-4 text-sm text-muted-foreground dark:text-muted-foreground">
            {t('errorReference')} <code className="rounded bg-muted/70 px-2 py-1 text-foreground">{error.digest}</code>
          </p>
        )}

        {process.env.NODE_ENV !== 'production' && (
          <details className="mb-4 text-left">
            <summary className="cursor-pointer font-semibold">{t('technicalDetails')}</summary>
            <div className="mt-2 rounded bg-destructive/10 dark:bg-destructive/20 p-4">
              <p className="mb-2 font-mono text-sm">
                <strong>{t('errorLabel')}</strong> {error.message}
              </p>
              {error.stack && <pre className="overflow-auto text-xs">{error.stack}</pre>}
            </div>
          </details>
        )}

        <button
          onClick={reset}
          className="rounded-md bg-primary px-6 py-2 text-primary-foreground hover:bg-primary/80"
        >
          {t('tryAgain')}
        </button>
      </div>
    </div>
  );
}
