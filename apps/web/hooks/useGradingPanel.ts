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

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import type { Submission } from '@/types/grading';
import useSWR from 'swr';

export interface UseGradingPanelResult {
  submission: Submission | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<Submission | undefined>;
}

export function useGradingPanel(submissionUuid: string | null): UseGradingPanelResult {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;

  const { data, error, isLoading, mutate } = useSWR<Submission>(
    submissionUuid && accessToken ? `${getAPIUrl()}grading/submissions/${submissionUuid}` : null,
    (url: string) => swrFetcher(url, accessToken),
  );

  return {
    submission: data ?? null,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
