import type { Metadata } from 'next'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import Trail from './trail'
import { getServerSession } from 'next-auth/next'
import { nextAuthOptions } from 'app/auth/options'
import { getTranslations } from 'next-intl/server'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  props: MetadataProps
): Promise<Metadata> {
  const params = await props.params
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token
  const t = await getTranslations('TrailPage')

  const org = await getOrganizationContextInfo(
    params.orgslug,
    {
      revalidate: 1800,
      tags: ['organizations'],
    },
    access_token
  )
  return {
    title: `${t('title')} — ${org.name}`,
    description: t('metaDescription'),
  }
}

const TrailPage = async (params: any) => {
  const orgslug = (await params.params).orgslug

  return (
    <div>
      <Trail orgslug={orgslug} />
    </div>
  )
}

export default TrailPage
