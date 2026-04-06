'use client';

import { swrFetcher } from '@services/utils/ts/requests';
import { courseKeys } from './courseKeys';
import useSWR from 'swr';

export function useCourseRights<TRights = any>(courseUuid: string) {
  const key = courseKeys.rights(courseUuid);

  const swr = useSWR<TRights>(key, (url: string) => swrFetcher(url), {
    revalidateOnFocus: false,
  });

  return {
    ...swr,
    rights: swr.data,
    key: key?.[0] ?? null,
  };
}
