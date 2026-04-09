'use client';

import { apiFetcher } from '@services/utils/ts/requests';
import { useQuery } from '@tanstack/react-query';
import { courseEndpoints, courseKeys } from './courseKeys';

export function useCourseRights<TRights = any>(courseUuid: string) {
  const key = courseKeys.rights(courseUuid);

  const query = useQuery({
    queryKey: key,
    queryFn: () => apiFetcher(courseEndpoints.rights(courseUuid)) as Promise<TRights>,
    enabled: Boolean(courseUuid),
  });

  return {
    ...query,
    rights: query.data,
    isLoading: query.isPending,
    key,
  };
}
