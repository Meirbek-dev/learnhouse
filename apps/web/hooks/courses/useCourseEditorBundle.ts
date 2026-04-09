'use client';

import { useQuery } from '@tanstack/react-query';
import { courseKeys } from './courseKeys';
import { courseEditorBundleQueryOptions } from '@/features/courses/queries/course.query';

export function useCourseEditorBundle(courseUuid?: string | null) {
  const key = courseUuid ? courseKeys.editorBundle(courseUuid) : null;

  const query = useQuery({
    ...(courseUuid ? courseEditorBundleQueryOptions(courseUuid) : { queryKey: ['courses', 'editor-bundle', 'missing'] as const }),
    enabled: Boolean(courseUuid),
  });

  return {
    data: query.data,
    editorData: query.data,
    error: query.error,
    fetchStatus: query.fetchStatus,
    isError: query.isError,
    isFetching: query.isFetching,
    isLoading: query.isPending,
    isPending: query.isPending,
    isSuccess: query.isSuccess,
    key,
    mutate: async () => (await query.refetch()).data,
    refetch: query.refetch,
    status: query.status,
  };
}
