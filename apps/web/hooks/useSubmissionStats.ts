'use client';

import { apiFetcher } from '@services/utils/ts/requests';
import type { SubmissionStats } from '@/types/grading';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAPIUrl } from '@services/config/config';

const gradingKeys = {
  stats: (activityId: number) => ['grading', 'submission-stats', activityId] as const,
};

export function useSubmissionStats(activityId: number | null) {
  const queryClient = useQueryClient();
  const queryKey = activityId === null ? ['grading', 'submission-stats', 'missing'] : gradingKeys.stats(activityId);
  const query = useQuery({
    queryKey,
    queryFn: () => apiFetcher(`${getAPIUrl()}grading/submissions/stats?activity_id=${activityId}`) as Promise<SubmissionStats>,
    enabled: activityId !== null,
    staleTime: 5000,
  });

  return {
    stats: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ?? null,
    mutate: async () => {
      if (activityId === null) return null;
      await queryClient.invalidateQueries({ queryKey: gradingKeys.stats(activityId) });
      return queryClient.fetchQuery({
        queryKey: gradingKeys.stats(activityId),
        queryFn: () => apiFetcher(`${getAPIUrl()}grading/submissions/stats?activity_id=${activityId}`) as Promise<SubmissionStats>,
      });
    },
  };
}
