'use client';

import { useQuery } from '@tanstack/react-query';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { apiFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { queryKeys } from '@/lib/react-query/queryKeys';
import type { Platform } from '@/types/platform';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';

export const PlatformContext = createContext<Platform | null>(null);

export const PlatformContextProvider = ({
  children,
  initialPlatform,
}: {
  children: ReactNode;
  initialPlatform?: any;
}) => {
  const platformContextKey = `${getAPIUrl()}platform`;

  const { data: platform, isPending: isPlatformLoading } = useQuery({
    queryKey: queryKeys.platform.config(),
    queryFn: () => apiFetcher(platformContextKey) as Promise<Platform>,
    initialData: initialPlatform || undefined,
    staleTime: initialPlatform ? 60_000 : 0,
  });

  // Only block on platform data — session state is independent of platform config.
  if (!platform && isPlatformLoading) return <PageLoading />;

  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
};

export function usePlatform(): Platform | null {
  return use(PlatformContext);
}
