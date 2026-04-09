'use client';

/**
 * useMySubmission
 *
 * Fetches the current student's latest submission for an activity.
 * Replaces the ad-hoc per-context submission lookups scattered across
 * AssignmentSubmissionContext, AssignmentsTaskContext, etc.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Submission } from '@/types/grading';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { mySubmissionQueryOptions } from '@/features/grading/queries/grading.query';

export interface UseMySubmissionResult {
  submission: Submission | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<Submission[] | undefined>;
}

export function useMySubmission(activityId: number | null): UseMySubmissionResult {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...mySubmissionQueryOptions(activityId ?? 0),
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.grading.mine(activityId) });
      return queryClient.fetchQuery(mySubmissionQueryOptions(activityId));
    },
  };
}
