'use client';

/**
 * useMySubmission
 *
 * Fetches the current student's latest submission for an activity.
 * Replaces the ad-hoc per-context submission lookups scattered across
 * AssignmentSubmissionContext, AssignmentsTaskContext, etc.
 */

import useSWR from 'swr';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { getAPIUrl } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import type { Submission } from '@/types/grading';

export interface UseMySubmissionResult {
  submission: Submission | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<Submission[] | undefined>;
}

export function useMySubmission(activityId: number | null): UseMySubmissionResult {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;

  const { data, error, isLoading, mutate } = useSWR<Submission[]>(
    activityId && accessToken
      ? `${getAPIUrl()}grading/submissions/me?activity_id=${activityId}`
      : null,
    (url: string) => swrFetcher(url, accessToken),
  );

  // Return the most recent submission (first in list — API sorts by created_at desc)
  const submission = data?.[0] ?? null;

  return {
    submission,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
