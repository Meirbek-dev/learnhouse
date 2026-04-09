'use client';

/**
 * useGradingPanel
 *
 * Single hook for the teacher grading side panel.
 *
 * Replaces the 3 nested Context Providers (AssignmentProvider,
 * AssignmentsTaskProvider, AssignmentSubmissionProvider) that were stacked
 * inside a modal trigger render prop — all for a single grading form.
 */

import type { Submission } from '@/types/grading';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { gradingDetailQueryOptions } from '@/features/grading/queries/grading.query';

export interface UseGradingPanelResult {
  submission: Submission | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<Submission | undefined>;
}

export function useGradingPanel(submissionUuid: string | null): UseGradingPanelResult {
  const queryClient = useQueryClient();
  const query = useQuery({
    ...(submissionUuid ? gradingDetailQueryOptions(submissionUuid) : { queryKey: ['grading', 'submission', 'missing'] as const }),
    enabled: submissionUuid !== null,
  });

  return {
    submission: query.data ?? null,
    isLoading: query.isPending,
    error: (query.error) ?? null,
    mutate: async () => {
      if (!submissionUuid) return undefined;
      await queryClient.invalidateQueries({ queryKey: queryKeys.grading.detail(submissionUuid) });
      return queryClient.fetchQuery(gradingDetailQueryOptions(submissionUuid));
    },
  };
}
