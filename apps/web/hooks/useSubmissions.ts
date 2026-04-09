'use client';

import type { SubmissionStatus } from '@/types/grading';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { submissionsQueryOptions } from '@/features/grading/queries/grading.query';
import { useState, useEffect } from 'react';

export interface UseSubmissionsOptions {
  activityId: number | null;
  status?: SubmissionStatus | 'NEEDS_GRADING' | null;
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
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [activityId]);

  const params = new URLSearchParams();
  if (activityId) params.set('activity_id', String(activityId));
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  params.set('sort_by', sortBy);
  params.set('sort_dir', sortDir);
  params.set('page', String(page));
  params.set('page_size', String(pageSize));

  const queryParams = {
    activityId: activityId ?? 0,
    page,
    pageSize,
    search: search ?? '',
    sortBy,
    sortDir,
    status: status ?? 'ALL',
  } as const;
  const queryKey = submissionsQueryOptions(queryParams).queryKey;
  const queryClient = useQueryClient();
  const query = useQuery({
    ...submissionsQueryOptions(queryParams),
    enabled: Boolean(activityId),
  });

  return {
    submissions: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    pages: query.data?.pages ?? 1,
    page,
    setPage,
    isLoading: query.isPending,
    error: query.error ?? null,
    mutate: async () => {
      if (!activityId) return undefined;
      await queryClient.invalidateQueries({ queryKey });
      return queryClient.fetchQuery(submissionsQueryOptions(queryParams));
    },
  };
}
