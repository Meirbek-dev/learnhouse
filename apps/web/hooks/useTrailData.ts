'use client';

import { getAPIUrl } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import useSWR from 'swr';

/**
 * Shared hook for fetching trail data with global cache
 * Prevents duplicate API calls across components
 */
export function useTrailData(orgId: number | null) {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  return useSWR(
    orgId && access_token ? `${getAPIUrl()}trail/org/${orgId}/trail` : null,
    (url) => swrFetcher(url, access_token),
    {
      dedupingInterval: 5 * 60_000, // 5 minutes - prevent duplicate requests
      revalidateOnFocus: false, // Don't refetch on window focus
      revalidateOnReconnect: false, // Don't refetch on reconnect
    },
  );
}
