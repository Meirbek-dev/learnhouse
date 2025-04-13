import React from 'react'
import InstallClient from './install'
import { getTranslations } from 'next-intl/server'
import { Metadata } from 'next'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Install')

  return {
    title: t('title'),
    description: t('description'),
  }
}

function InstallPage() {
  return (
    <div className="bg-white h-screen">
      <InstallClient />
    </div>
  )
}

export default InstallPage
