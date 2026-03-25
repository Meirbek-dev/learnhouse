'use client';

/**
 * useSubmissions
 *
 * Hook for the teacher submissions table.
 * Supports status filtering and pagination — neither of which was possible
 * with the old kanban that loaded everything at once.
 */

import { useState } from 'react';
import useSWR from 'swr';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { getAPIUrl } from '@services/config/config';
import { swrFetcher } from '@services/utils/ts/requests';
import type { SubmissionStatus, SubmissionsPage } from '@/types/grading';

export interface UseSubmissionsOptions {
  activityId: number | null;
  status?: SubmissionStatus | null;
  pageSize?: number;
}

export function useSubmissions({
  activityId,
  status,
  pageSize = 25,
}: UseSubmissionsOptions) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (activityId) params.set('activity_id', String(activityId));
  if (status) params.set('status', status);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));

  const { data, error, isLoading, mutate } = useSWR<SubmissionsPage>(
    activityId && accessToken
      ? `${getAPIUrl()}grading/submissions?${params}`
      : null,
    (url: string) => swrFetcher(url, accessToken),
  );

  return {
    submissions: data?.items ?? [],
    total: data?.total ?? 0,
    pages: data?.pages ?? 1,
    page,
    setPage,
    isLoading,
    error: error ?? null,
    mutate,
  };
}
