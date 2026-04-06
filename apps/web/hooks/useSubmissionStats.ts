'use client';

import { swrFetcher } from '@services/utils/ts/requests';
import type { SubmissionStats } from '@/types/grading';
import { getAPIUrl } from '@services/config/config';
import useSWR from 'swr';

export function useSubmissionStats(activityId: number | null) {
  const { data, error, isLoading, mutate } = useSWR<SubmissionStats>(
    activityId ? `${getAPIUrl()}grading/submissions/stats?activity_id=${activityId}` : null,
    (url: string) => swrFetcher(url),
    { revalidateOnFocus: false, dedupingInterval: 5000 },
  );

  return {
    stats: data ?? null,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
