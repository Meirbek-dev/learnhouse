import ForgotPasswordClient from './forgot'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.Forgot')
  return {
    title: t('title'),
  }
}

function ForgotPasswordPage() {
  return (
    <>
      <ForgotPasswordClient />
    </>
  )
}

export default ForgotPasswordPage
