'use client'
import { getAPIUrl, getUriWithoutOrg } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import type { ReactNode } from 'react'
import { createContext, useContext, useMemo } from 'react'
import useSWR from 'swr'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ErrorUI from '@components/Objects/StyledElements/Error/Error'
import InfoUI from '@components/Objects/StyledElements/Info/Info'
import { usePathname } from 'next/navigation'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import { useTranslations } from 'next-intl'

export const OrgContext = createContext(null)

export function OrgProvider({
  children,
  orgslug,
}: {
  children: ReactNode
  orgslug: string
}) {
  const session = useLHSession() as any
  const pathname = usePathname()
  const accessToken = session?.data?.tokens?.access_token
  const t = useTranslations('Contexts.Org')
  const isAllowedPathname = ['/login', '/signup'].includes(pathname)

  const { data: org, error: orgError } = useSWR(
    `${getAPIUrl()}orgs/slug/${orgslug}`,
    (url) => swrFetcher(url, accessToken)
  )
  const { data: orgs, error: orgsError } = useSWR(
    `${getAPIUrl()}orgs/user/page/1/limit/10`,
    (url) => swrFetcher(url, accessToken)
  )

  const isLoading = !(org && orgs && session) || session.status === 'loading'
  const hasError = orgError || orgsError

  const isOrgActive = useMemo(
    () => org?.config?.config?.general?.enabled !== false,
    [org]
  )
  const isUserPartOfTheOrg = useMemo(
    () => orgs?.some((userOrg: any) => userOrg.id === org?.id),
    [orgs, org?.id]
  )

  if (hasError) return <ErrorUI message={t('fetchError')} />
  if (isLoading) return <PageLoading />
  if (!isOrgActive) return <ErrorUI message={t('orgInactiveError')} />
  if (
    !isUserPartOfTheOrg &&
    session.status == 'authenticated' &&
    !isAllowedPathname
  ) {
    return (
      <InfoUI
        href={getUriWithoutOrg(`/signup?orgslug=${orgslug}`)}
        message={t('notMemberInfo')}
        cta={t('joinOrgCTA', { orgName: org?.name })}
      />
    )
  }

  return <OrgContext value={org}>{children}</OrgContext>
}

export function useOrg() {
  return useContext(OrgContext)
}
