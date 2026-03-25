'use client';

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import type { SubmissionStatus, SubmissionsPage } from '@/types/grading';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useState } from 'react';
import useSWR from 'swr';

export interface UseSubmissionsOptions {
  activityId: number | null;
  status?: SubmissionStatus | null;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  pageSize?: number;
}

export function useSubmissions({
  activityId,
  status,
  search,
  sortBy = 'submitted_at',
  sortDir = 'desc',
  pageSize = 25,
}: UseSubmissionsOptions) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  if (activityId) params.set('activity_id', String(activityId));
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  params.set('sort_by', sortBy);
  params.set('sort_dir', sortDir);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));

  const { data, error, isLoading, mutate } = useSWR<SubmissionsPage>(
    activityId && accessToken ? `${getAPIUrl()}grading/submissions?${params}` : null,
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
