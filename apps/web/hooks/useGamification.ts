'use client';

import {
  awardXP,
  getGamificationProfile,
  updateLearningStreak,
  updateLoginStreak,
} from '@/services/gamification/gamification';
import type { UserGamificationProfile, XPAwardRequest, XPAwardResponse } from '@/types/gamification';
import React from 'react';
import useSWR from 'swr';

interface UseGamificationOptions {
  orgId: number;
  accessToken?: string | null;
  enabled?: boolean;
  refreshIntervalMs?: number;
  /** Optional server-provided profile to hydrate immediately */
  initialData?: UserGamificationProfile | null;
}

interface UseGamificationReturn {
  profile: UserGamificationProfile | null;
  isLoading: boolean;
  error: string | null;
  awardXP: (payload: XPAwardRequest) => Promise<XPAwardResponse>;
  updateLoginStreak: () => Promise<void>;
  updateLearningStreak: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useGamification({
  orgId,
  accessToken,
  enabled = true,
  refreshIntervalMs,
  initialData,
}: UseGamificationOptions): UseGamificationReturn {
  const shouldFetch = enabled && accessToken && orgId > 0;

  // Best-effort cached profile from localStorage (browser only)
  const cachedProfile: UserGamificationProfile | null = React.useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(`gamification:profile:data:${orgId}`);
      return raw ? (JSON.parse(raw) as UserGamificationProfile) : null;
    } catch {
      return null;
    }
  }, [orgId]);

  const {
    data: profile,
    error,
    isLoading,
    mutate,
  } = useSWR(shouldFetch ? ['gamification/profile', orgId] : null, () => getGamificationProfile(orgId, accessToken!), {
    refreshInterval: refreshIntervalMs,
    revalidateOnFocus: false,
    errorRetryCount: 3,
    keepPreviousData: true,
    fallbackData: initialData ?? cachedProfile ?? undefined,
    onSuccess: (data) => {
      // Persist latest profile for instant hydration next time
      if (typeof window !== 'undefined' && data) {
        try {
          window.localStorage.setItem(`gamification:profile:data:${orgId}`, JSON.stringify(data));
        } catch {}
      }
    },
  });

  // If the access token changes while enabled, revalidate explicitly
  // without clearing the existing data to avoid flicker/nulls

  React.useEffect(() => {
    if (enabled && orgId > 0 && accessToken) {
      // fire-and-forget revalidation
      mutate();
    }
  }, [accessToken, orgId, enabled, mutate]);

  const handleAwardXP = async (payload: XPAwardRequest): Promise<XPAwardResponse> => {
    if (!accessToken) throw new Error('No access token');

    const response = await awardXP(orgId, accessToken, payload);

    // Optimistically update the profile
    await mutate(response.profile, false);

    // Persist to cache
    if (typeof window !== 'undefined' && response.profile) {
      try {
        window.localStorage.setItem(`gamification:profile:data:${orgId}`, JSON.stringify(response.profile));
      } catch {}
    }

    return response;
  };

  const handleUpdateLoginStreak = async (): Promise<void> => {
    if (!accessToken) throw new Error('No access token');

    await updateLoginStreak(orgId, accessToken);

    // Refetch profile to get updated streak
    await mutate();
  };

  const handleUpdateLearningStreak = async (): Promise<void> => {
    if (!accessToken) throw new Error('No access token');

    await updateLearningStreak(orgId, accessToken);

    // Refetch profile to get updated streak
    await mutate();
  };

  const refetch = async (): Promise<void> => {
    await mutate();
  };

  return {
    profile: profile ?? initialData ?? cachedProfile ?? null,
    isLoading,
    error: error?.message || null,
    awardXP: handleAwardXP,
    updateLoginStreak: handleUpdateLoginStreak,
    updateLearningStreak: handleUpdateLearningStreak,
    refetch,
  };
}

export default useGamification;
