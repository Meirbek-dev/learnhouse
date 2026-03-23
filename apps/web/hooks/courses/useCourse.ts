'use client';

import { swrFetcher } from '@services/utils/ts/requests';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { courseKeys } from './courseKeys';
import useSWR from 'swr';

export function useCourse<TCourse = any>(courseUuid: string) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const key = accessToken ? ([courseKeys.detail(courseUuid), accessToken] as const) : null;

  const swr = useSWR<TCourse>(key, ([url, token]: readonly [string, string]) => swrFetcher(url, token), {
    revalidateOnFocus: false,
  });

  return {
    ...swr,
    course: swr.data,
    key: key?.[0] ?? null,
  };
}
