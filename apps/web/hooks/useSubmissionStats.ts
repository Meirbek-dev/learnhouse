'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { submissionStatsQueryOptions } from '@/features/grading/queries/grading.query';

export function useSubmissionStats(activityId: number | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...submissionStatsQueryOptions(activityId ?? 0),
    enabled: activityId !== null,
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ?? null,
    mutate: async () => {
      if (activityId === null) return null;
      await queryClient.invalidateQueries({ queryKey: queryKeys.grading.stats(activityId) });
      return queryClient.fetchQuery(submissionStatsQueryOptions(activityId));
    },
  };
}
