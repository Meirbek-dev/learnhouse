'use client'
import { Check, Link as LinkIcon } from 'lucide-react'
import { useTranslations } from 'next-intl'

function DisableInstallMode() {
  const t = useTranslations('Install.steps.DISABLING_INSTALLATION_MODE')
  return (
    <div className="flex flex-col items-center space-y-3 rounded-md border border-green-300 bg-green-100 p-4 text-green-800 sm:flex-row sm:space-y-0 sm:space-x-4">
      <div className="flex-shrink-0">
        <Check size={32} className="text-green-600" />
      </div>
      <div>
        <p className="text-lg font-bold">
          {t.rich('message', {
            b: (chunks) => <b>{chunks}</b>,
            i: (chunks) => <i>{chunks}</i>,
          })}
        </p>
        <div className="mt-2 flex items-center space-x-2">
          <LinkIcon size={20} className="text-blue-600" />
          <a
            rel="noreferrer"
            target="_blank"
            className="font-medium text-blue-700 hover:underline"
            href="https://docs.learnhouse.app"
          >
            {t('docsLink')}
          </a>
        </div>
      </div>
    </div>
  )
}

export default DisableInstallMode
