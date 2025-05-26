import type { Metadata } from 'next'
import ResetPasswordClient from './reset'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Auth.Reset')
  return {
    title: t('title'),
  }
}

function ResetPasswordPage() {
  return <ResetPasswordClient />
}

export default ResetPasswordPage
