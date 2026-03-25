'use client';

import useSWR from 'swr';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { getAPIUrl } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import type { SubmissionStats } from '@/types/grading';

export function useSubmissionStats(activityId: number | null) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;

  const { data, error, isLoading, mutate } = useSWR<SubmissionStats>(
    activityId && accessToken
      ? `${getAPIUrl()}grading/submissions/stats?activity_id=${activityId}`
      : null,
    (url: string) => swrFetcher(url, accessToken),
  );

  return {
    stats: data ?? null,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
