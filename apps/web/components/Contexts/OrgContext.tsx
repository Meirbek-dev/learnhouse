'use client';

import { getAPIUrl, getUriWithoutOrg } from '@services/config/config';
import ErrorUI from '@components/Objects/StyledElements/Error/Error';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import InfoUI from '@components/Objects/StyledElements/Info/Info';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { createContext, useContext, useMemo } from 'react';
import { swrFetcher } from '@services/utils/ts/requests';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import useSWR from 'swr';

export const OrgContext = createContext(null);

export const OrgProvider = ({ children, orgslug }: { children: ReactNode; orgslug: string }) => {
  const session = useLHSession();
  const pathname = usePathname();
  const accessToken = session?.data?.tokens?.access_token;
  const t = useTranslations('Contexts.Org');
  const isAllowedPathname = ['/login', '/signup'].includes(pathname);

  const { data: org, error: orgError } = useSWR(`${getAPIUrl()}orgs/slug/${orgslug}`, (url) =>
    swrFetcher(url, accessToken),
  );
  const { data: orgs, error: orgsError } = useSWR(`${getAPIUrl()}orgs/user/page/1/limit/20`, (url) =>
    swrFetcher(url, accessToken),
  );

  const isLoading = !(org && orgs && session) || session.status === 'loading';
  const hasError = orgError || orgsError;

  const isOrgActive = useMemo(() => org?.config?.config?.general?.enabled !== false, [org]);
  const isUserPartOfTheOrg = useMemo(() => orgs?.some((userOrg: any) => userOrg.id === org?.id), [orgs, org?.id]);

  if (hasError) return <ErrorUI message={t('fetchError')} />;
  if (isLoading) return <PageLoading />;
  if (!isOrgActive) return <ErrorUI message={t('orgInactiveError')} />;
  if (!isUserPartOfTheOrg && session.status === 'authenticated' && !isAllowedPathname) {
    return (
      <InfoUI
        href={getUriWithoutOrg(`/signup?orgslug=${orgslug}`)}
        message={t('notMemberInfo')}
        cta={t('joinOrgCTA', { orgName: org?.name })}
      />
    );
  }

  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
};

export function useOrg() {
  return useContext(OrgContext as any);
}
