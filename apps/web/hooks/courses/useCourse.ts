'use client';

import { apiFetcher } from '@services/utils/ts/requests';
import { useQuery } from '@tanstack/react-query';
import { courseEndpoints, courseKeys } from './courseKeys';

export function useCourse<TCourse = any>(courseUuid: string) {
  const key = courseKeys.detail(courseUuid);

  const query = useQuery({
    queryKey: key,
    queryFn: () => apiFetcher(courseEndpoints.detail(courseUuid)) as Promise<TCourse>,
    enabled: Boolean(courseUuid),
  });

  return {
    ...query,
    course: query.data,
    isLoading: query.isPending,
    key,
  };
}
