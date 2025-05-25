import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import ClientAdminLayout from './ClientAdminLayout'
import { getTranslations } from 'next-intl/server'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('DashPage')
  return {
    title: t('DashboardTitle'),
  }
}

async function DashboardLayout(props: {
  children: ReactNode
  params: Promise<any>
}) {
  const params = await props.params

  const { children } = props

  return (
    <>
      <ClientAdminLayout params={params}>{children}</ClientAdminLayout>
    </>
  )
}

export default DashboardLayout
