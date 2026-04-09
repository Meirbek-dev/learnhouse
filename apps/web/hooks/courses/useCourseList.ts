'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetcherWithHeaders } from '@services/utils/ts/requests';
import type { CourseListKeyOptions } from './courseKeys';
import { courseEndpoints, courseKeys } from './courseKeys';

interface CourseListResponse<TCourse> {
  courses: TCourse[];
  total: number;
  summary?: {
    total: number;
    ready: number;
    private: number;
    attention: number;
  };
}

export function useCourseList<TCourse = any>(options: CourseListKeyOptions = {}) {
  const key = courseKeys.list(options);
  const url = courseEndpoints.list(options);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const response = await apiFetcherWithHeaders(url);
      return {
        courses: Array.isArray(response.data) ? response.data : [],
        total: Number.parseInt(response.headers['x-total-count'] ?? '0', 10),
      };
    },
  });

  return {
    ...query,
    courses: query.data?.courses ?? [],
    data: query.data?.courses ?? [],
    isLoading: query.isPending,
    total: query.data?.total ?? 0,
  };
}

export function useEditableCourseList<TCourse = any>(options: CourseListKeyOptions = {}) {
  const key = courseKeys.editable(options);
  const url = courseEndpoints.editable(options);

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const response = await apiFetcherWithHeaders(url);
      return {
        courses: Array.isArray(response.data) ? response.data : [],
        total: Number.parseInt(response.headers['x-total-count'] ?? '0', 10),
        summary: {
          total: Number.parseInt(response.headers['x-summary-total'] ?? response.headers['x-total-count'] ?? '0', 10),
          ready: Number.parseInt(response.headers['x-summary-ready'] ?? '0', 10),
          private: Number.parseInt(response.headers['x-summary-private'] ?? '0', 10),
          attention: Number.parseInt(response.headers['x-summary-attention'] ?? '0', 10),
        },
      };
    },
  });

  return {
    ...query,
    courses: query.data?.courses ?? [],
    data: query.data?.courses ?? [],
    isLoading: query.isPending,
    summary: query.data?.summary,
    total: query.data?.total ?? 0,
  };
}
