'use client';

import { swrFetcher } from '@services/utils/ts/requests';
import { courseKeys } from './courseKeys';
import useSWR from 'swr';

export function useCourse<TCourse = any>(courseUuid: string) {
  const key = courseKeys.detail(courseUuid);

  const swr = useSWR<TCourse>(key, (url: string) => swrFetcher(url), {
    revalidateOnFocus: false,
  });

  return {
    ...swr,
    course: swr.data,
    key: key?.[0] ?? null,
  };
}
