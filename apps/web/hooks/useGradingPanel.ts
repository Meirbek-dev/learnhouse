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

import { apiFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import type { Submission } from '@/types/grading';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export interface UseGradingPanelResult {
  submission: Submission | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<Submission | undefined>;
}

const gradingKeys = {
  detail: (submissionUuid: string) => ['grading', 'submission', submissionUuid] as const,
};

export function useGradingPanel(submissionUuid: string | null): UseGradingPanelResult {
  const queryClient = useQueryClient();
  const queryKey = submissionUuid ? gradingKeys.detail(submissionUuid) : ['grading', 'submission', 'missing'];
  const query = useQuery({
    queryKey,
    queryFn: () => apiFetcher(`${getAPIUrl()}grading/submissions/${submissionUuid}`) as Promise<Submission>,
    enabled: submissionUuid !== null,
    staleTime: 2000,
  });

  return {
    submission: query.data ?? null,
    isLoading: query.isPending,
    error: (query.error) ?? null,
    mutate: async () => {
      if (!submissionUuid) return undefined;
      await queryClient.invalidateQueries({ queryKey: gradingKeys.detail(submissionUuid) });
      return queryClient.fetchQuery({
        queryKey: gradingKeys.detail(submissionUuid),
        queryFn: () => apiFetcher(`${getAPIUrl()}grading/submissions/${submissionUuid}`) as Promise<Submission>,
      });
    },
  };
}
