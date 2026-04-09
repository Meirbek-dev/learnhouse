'use client';

import { useQuery } from '@tanstack/react-query';
import { courseKeys } from './courseKeys';
import { courseRightsQueryOptions } from '@/features/courses/queries/course.query';

export function useCourseRights<TRights = any>(courseUuid: string) {
  const key = courseKeys.rights(courseUuid);

  const query = useQuery({
    ...courseRightsQueryOptions<TRights>(courseUuid),
    enabled: Boolean(courseUuid),
  });

  return {
    data: query.data,
    error: query.error,
    fetchStatus: query.fetchStatus,
    isError: query.isError,
    isFetching: query.isFetching,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    mutate: query.refetch,
    refetch: query.refetch,
    rights: query.data,
    isLoading: query.isPending,
    key,
    status: query.status,
  };
}
