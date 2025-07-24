'use client';

import { useTranslations } from 'next-intl';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('Errors');

  return (
    <html lang="en">
      <body>
        <h2>{t('somethingWentWrong')}</h2>
        <button
          onClick={() => {
            reset();
          }}
        >
          {t('tryAgain')}
        </button>
      </body>
    </html>
  );
}
