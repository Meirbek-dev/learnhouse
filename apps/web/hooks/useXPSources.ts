'use client';

import { getXPSourcesMetadata } from '@/services/gamification/gamification';
import useSWR from 'swr';

export interface XPSourceMeta {
  key: string;
  label: string;
  description: string;
  default_xp: number;
  category: string;
}

/**
 * SWR hook to prefetch and cache XP source metadata.
 * Provides quick synchronous lookup via the returned map.
 */
export function useXPSources(enabled: boolean = true) {
  const { data, error, isLoading } = useSWR<XPSourceMeta[]>(
    enabled ? 'gamification/xp-sources' : null,
    () => getXPSourcesMetadata(),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryCount: 2,
    },
  );

  const map: Record<string, XPSourceMeta> | null = data
    ? data.reduce(
        (acc, item) => {
          acc[item.key] = item;
          return acc;
        },
        {} as Record<string, XPSourceMeta>,
      )
    : null;

  return {
    sources: data ?? [],
    map,
    isLoading,
    error: error ? (error as any).message || 'failed' : null,
  };
}

export default useXPSources;
