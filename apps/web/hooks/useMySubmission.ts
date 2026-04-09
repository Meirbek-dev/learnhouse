'use client';

/**
 * useMySubmission
 *
 * Fetches the current student's latest submission for an activity.
 * Replaces the ad-hoc per-context submission lookups scattered across
 * AssignmentSubmissionContext, AssignmentsTaskContext, etc.
 */

import { apiFetcher } from '@services/utils/ts/requests';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAPIUrl } from '@services/config/config';
import type { Submission } from '@/types/grading';

const gradingKeys = {
  mine: (activityId: number) => ['grading', 'my-submissions', activityId] as const,
};

export interface UseMySubmissionResult {
  submission: Submission | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<Submission[] | undefined>;
}

export function useMySubmission(activityId: number | null): UseMySubmissionResult {
  const queryClient = useQueryClient();
  const queryKey = activityId === null ? ['grading', 'my-submissions', 'missing'] : gradingKeys.mine(activityId);
  const query = useQuery({
    queryKey,
    queryFn: () => apiFetcher(`${getAPIUrl()}grading/submissions/me?activity_id=${activityId}`) as Promise<Submission[]>,
    enabled: activityId !== null,
  });

  // Return the most recent submission (first in list — API sorts by created_at desc)
  const submission = query.data?.[0] ?? null;

  return {
    submission,
    isLoading: query.isPending,
    error: (query.error) ?? null,
    mutate: async () => {
      if (activityId === null) return undefined;
      await queryClient.invalidateQueries({ queryKey: gradingKeys.mine(activityId) });
      return queryClient.fetchQuery({
        queryKey: gradingKeys.mine(activityId),
        queryFn: () => apiFetcher(`${getAPIUrl()}grading/submissions/me?activity_id=${activityId}`) as Promise<Submission[]>,
      });
    },
  };
}
