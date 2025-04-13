import { Check, Link } from 'lucide-react'
import React from 'react'
import { useTranslations } from 'next-intl'

function DisableInstallMode() {
  const t = useTranslations('Install.DisableInstallMode')
  return (
    <div className="p-4 bg-green-300 text-green-950 rounded-md flex space-x-4 items-center">
      <div>
        <Check size={32} />
      </div>
      <div>
        <p className="font-bold text-lg">
          {t.rich('message', {
            b: (chunks) => <b>{chunks}</b>,
            i: (chunks) => <i>{chunks}</i>,
          })}
        </p>
        <div className="flex space-x-2 items-center">
          <Link size={20} />
          <a
            rel="noreferrer"
            target="_blank"
            className="text-blue-950 font-medium"
            href="http://docs.learnhouse.app"
          >
            {t('docsLink')}
          </a>
        </div>
      </div>
    </div>
  )
}

export default DisableInstallMode
