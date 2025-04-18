'use client'
import { useTranslations } from 'next-intl'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('Components.ErrorUI')

  return (
    <html>
      <body>
        <h2>{t('defaultMessage')}</h2>
        <button onClick={() => reset()}>{t('retryButton')}</button>
      </body>
    </html>
  )
}
