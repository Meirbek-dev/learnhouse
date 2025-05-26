import { getOrganizationContextInfo } from '@services/organizations/orgs'
import LoginClient from './login'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

type MetadataProps = {
  params: Promise<{ orgslug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  params: MetadataProps
): Promise<Metadata> {
  const orgslug = (await params.searchParams).orgslug
  const t = await getTranslations('Auth.Login')

  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  })

  return {
    title: t('title', { orgName: org.name }),
  }
}

const Login = async (params: MetadataProps) => {
  const orgslug = (await params.searchParams).orgslug
  const org = await getOrganizationContextInfo(orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  })

  return (
    <div>
      <LoginClient org={org} />
    </div>
  )
}

export default Login
