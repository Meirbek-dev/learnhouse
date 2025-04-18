'use client'
import { getAPIUrl } from '@services/config/config'
import { createDefaultElements, updateInstall } from '@services/install/install'
import { swrFetcher } from '@services/utils/ts/requests'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useRouter } from 'next/navigation'
import React, { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { BarLoader } from 'react-spinners'

function DefaultElements() {
  const t = useTranslations('Install.steps.DEFAULT_ELEMENTS')
  const generalT = useTranslations('General')
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const {
    data: install,
    error: fetchError,
    isLoading,
  } = useSWR(
    access_token ? `${getAPIUrl()}install/latest` : null,
    (url) => swrFetcher(url, access_token),
    {
      revalidateOnFocus: false,
    }
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  async function createDefElementsAndUpdateInstall() {
    if (isSubmitting || !install?.data) return

    setIsSubmitting(true)
    try {
      await createDefaultElements()

      const installData =
        typeof install.data === 'object' && install.data !== null
          ? install.data
          : {}

      const install_data_update = { ...installData, 2: { status: 'OK' } }

      await updateInstall(install_data_update, 3)

      router.push('/install?step=3')
    } catch (e) {
      console.error('Error creating default elements or updating install:', e)
      setIsSubmitting(false)
    }
  }

  if (isLoading) return <div>{generalT('loading')}</div>
  if (fetchError)
    return (
      <div>
        {generalT('error')}:{' '}
        {typeof fetchError === 'object' &&
        fetchError !== null &&
        'message' in fetchError
          ? String(fetchError.message)
          : String(fetchError)}
      </div>
    )
  if (!install) return <div>{generalT('loading')}</div>

  return (
    <div className="flex py-10 justify-center items-center flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-3">
      <h1 className="text-lg font-medium">{t('title')}</h1>
      <button
        onClick={createDefElementsAndUpdateInstall}
        disabled={isSubmitting}
        className="p-3 font-bold bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
      >
        {isSubmitting ? (
          <BarLoader
            cssOverride={{ borderRadius: 60 }}
            width={60}
            color="#000000"
          />
        ) : (
          t('installButton')
        )}
      </button>
    </div>
  )
}

export default DefaultElements
