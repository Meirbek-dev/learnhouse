'use client'
import { getAPIUrl } from '@services/config/config'
import { updateInstall } from '@services/install/install'
import { swrFetcher } from '@services/utils/ts/requests'
import { Check } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import useSWR from 'swr'
import { BarLoader } from 'react-spinners'

const Finish = () => {
  const t = useTranslations('Install.steps.FINISH')
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
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function finishInstall() {
    if (isSubmitting || !install?.data) return

    setIsSubmitting(true)
    try {
      const installData =
        typeof install.data === 'object' && install.data !== null
          ? install.data
          : {}
      const install_data_update = { ...installData, 5: { status: 'OK' } }

      const data = await updateInstall(install_data_update, 6)

      if (data) {
        router.push('/install?step=6')
      } else {
        console.error('Failed to update installation status.')
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error('Error finishing installation:', error)
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
    <div className="flex flex-col items-center justify-center space-y-4 py-10 md:flex-row md:space-y-0 md:space-x-3">
      <h1 className="text-lg font-medium">{t('title')}</h1>
      <Check size={32} className="text-green-600" />
      <button
        onClick={finishInstall}
        disabled={isSubmitting}
        className="flex min-w-[120px] items-center justify-center rounded-lg bg-gray-200 p-3 font-bold text-gray-900 hover:cursor-pointer hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? (
          <BarLoader
            cssOverride={{ borderRadius: 60 }}
            width={60}
            color="#000000"
          />
        ) : (
          t('nextStepButton')
        )}
      </button>
    </div>
  )
}

export default Finish
