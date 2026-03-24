'use client';

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { courseKeys } from './courseKeys';
import useSWR from 'swr';

export function useCourseRights<TRights = any>(courseUuid: string) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const key = accessToken ? ([courseKeys.rights(courseUuid), accessToken] as const) : null;

  const swr = useSWR<TRights>(key, ([url, token]: readonly [string, string]) => swrFetcher(url, token), {
    revalidateOnFocus: false,
  });

  return {
    ...swr,
    rights: swr.data,
    key: key?.[0] ?? null,
  };
}
