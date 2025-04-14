'use client'
import { Check, Link as LinkIcon } from 'lucide-react'
import React from 'react'
import { useTranslations } from 'next-intl'

function DisableInstallMode() {
  const t = useTranslations('Install.steps.DISABLING_INSTALLATION_MODE')
  return (
    <div className="p-4 bg-green-100 text-green-800 rounded-md flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 items-center border border-green-300">
      <div className="flex-shrink-0">
        <Check size={32} className="text-green-600" />
      </div>
      <div>
        <p className="font-bold text-lg">
          {t.rich('message', {
            b: (chunks) => <b>{chunks}</b>,
            i: (chunks) => <i>{chunks}</i>,
          })}
        </p>
        <div className="flex space-x-2 items-center mt-2">
          <LinkIcon size={20} className="text-blue-600" />
          <a
            rel="noreferrer"
            target="_blank"
            className="text-blue-700 font-medium hover:underline"
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
