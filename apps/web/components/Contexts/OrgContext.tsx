'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import ErrorUI from '@components/Objects/StyledElements/Error/Error';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { createContext, useContext } from 'react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import useSWR from 'swr';

export const OrgContext = createContext(null);

export const OrgProvider = ({ children, orgslug }: { children: ReactNode; orgslug: string }) => {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const isAuthenticated = session.status === 'authenticated' && Boolean(accessToken);
  const t = useTranslations('Contexts.Org');

  const {
    data: org,
    error: orgError,
    isLoading: isOrgLoading,
  } = useSWR(`${getAPIUrl()}orgs/slug/${orgslug}`, (url) => swrFetcher(url, accessToken));
  const {
    data: orgs,
    error: orgsError,
    isLoading: isUserOrgsLoading,
  } = useSWR(
    // Skip user-specific org fetches when unauthenticated to prevent hammering rate-limited endpoints.
    isAuthenticated ? `${getAPIUrl()}orgs/user/page/1/limit/20` : null,
    (url) => swrFetcher(url, accessToken),
  );

  const isLoading = session.status === 'loading' || isOrgLoading || (isAuthenticated && isUserOrgsLoading);
  const hasError = Boolean(orgError) || (isAuthenticated && Boolean(orgsError));

  if (hasError) return <ErrorUI message={t('fetchError')} />;
  if (isLoading) return <PageLoading />;

  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>;
};

export function useOrg() {
  return useContext(OrgContext as any);
}
