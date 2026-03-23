'use client';

import { swrFetcherWithHeaders } from '@services/utils/ts/requests';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import type { CourseListKeyOptions } from './courseKeys';
import { courseKeys } from './courseKeys';
import useSWR from 'swr';

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
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const key = [courseKeys.list(options), accessToken ?? 'anonymous'] as const;

  const swr = useSWR<CourseListResponse<TCourse>>(
    key,
    async ([url, token]: readonly [string, string]) => {
      const response = await swrFetcherWithHeaders(url, token === 'anonymous' ? undefined : token);
      return {
        courses: Array.isArray(response.data) ? response.data : [],
        total: Number.parseInt(response.headers['x-total-count'] ?? '0', 10),
      };
    },
    {
      revalidateOnFocus: false,
    },
  );

  return {
    ...swr,
    data: swr.data?.courses ?? [],
    total: swr.data?.total ?? 0,
    courses: swr.data?.courses ?? [],
  };
}

export function useEditableCourseList<TCourse = any>(options: CourseListKeyOptions = {}) {
  const session = usePlatformSession();
  const accessToken = session?.data?.tokens?.access_token;
  const key = accessToken ? ([courseKeys.editable(options), accessToken] as const) : null;

  const swr = useSWR<CourseListResponse<TCourse>>(
    key,
    async ([url, token]: readonly [string, string]) => {
      const response = await swrFetcherWithHeaders(url, token);
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
    {
      revalidateOnFocus: false,
    },
  );

  return {
    ...swr,
    data: swr.data?.courses ?? [],
    total: swr.data?.total ?? 0,
    summary: swr.data?.summary,
    courses: swr.data?.courses ?? [],
  };
}
