'use client';

import { useQuery } from '@tanstack/react-query';
import { courseKeys } from './courseKeys';
import { courseQueryOptions } from '@/features/courses/queries/course.query';

export function useCourse<TCourse = any>(courseUuid: string) {
  const key = courseKeys.detail(courseUuid);

  const query = useQuery({
    ...courseQueryOptions<TCourse>(courseUuid),
    enabled: Boolean(courseUuid),
  });

  return {
    course: query.data,
    data: query.data,
    error: query.error,
    fetchStatus: query.fetchStatus,
    isError: query.isError,
    isFetching: query.isFetching,
    isLoading: query.isPending,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    key,
    mutate: query.refetch,
    refetch: query.refetch,
    status: query.status,
  };
}
