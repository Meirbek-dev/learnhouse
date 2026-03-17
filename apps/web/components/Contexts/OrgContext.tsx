'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { createContext, useContext } from 'react';
import type { Org } from '@/types/org';
import type { ReactNode } from 'react';
import useSWR from 'swr';

export const PlatformOrgContext = createContext<Org | null>(null);

export const PlatformOrgContextProvider = ({ children, initialOrg }: { children: ReactNode; initialOrg?: any }) => {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const orgContextKey = `${getAPIUrl()}orgs/platform`;

  const { data: org, isLoading: isOrgLoading } = useSWR(orgContextKey, (url: string) => swrFetcher(url, accessToken), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: !initialOrg,
    fallbackData: initialOrg || undefined,
  });

  const isLoading = session.status === 'loading' || (!org && isOrgLoading);

  if (isLoading) return <PageLoading />;

  return <PlatformOrgContext.Provider value={org}>{children}</PlatformOrgContext.Provider>;
};

export function usePlatformOrg(): Org | null {
  return useContext(PlatformOrgContext);
}
