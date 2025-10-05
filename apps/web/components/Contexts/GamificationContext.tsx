'use client';

import type {
  DashboardData,
  GamificationError,
  OrganizationLeaderboard,
  UserGamificationProfile,
  XPAwardRequest,
  XPAwardResponse,
  StreakType,
} from '@/types/gamification';
import { gamificationApi } from '@/services/gamification/client';
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

/**
 * UNIFIED GAMIFICATION CONTEXT v2
 *
 * Now using type-safe API client with:
 * - Automatic retry logic
 * - Request deduplication
 * - Response caching
 * - Type-safe error handling
 * - Optimistic updates
 */

interface GamificationContextValue {
  // Core Data
  profile: UserGamificationProfile | null;
  dashboard: DashboardData | null;
  leaderboard: OrganizationLeaderboard | null;

  // States
  isLoading: boolean;
  error: GamificationError | null;

  // Actions
  awardXP: (payload: XPAwardRequest) => Promise<XPAwardResponse>;
  updateStreak: (type: 'login' | 'learning') => Promise<void>;
  updatePreferences: (preferences: Record<string, any>) => Promise<void>;
  refetch: () => Promise<void>;

  // Computed Values
  streaks: {
    login: number;
    learning: number;
    maxLogin: number;
    maxLearning: number;
  };
}

const GamificationContext = createContext<GamificationContextValue | null>(null);

interface GamificationProviderProps {
  children: React.ReactNode;
  orgId: number;
  initialData?: {
    profile?: UserGamificationProfile | null;
    dashboard?: DashboardData | null;
    leaderboard?: OrganizationLeaderboard | null;
  };
}

export function GamificationProvider({ children, orgId, initialData }: GamificationProviderProps) {
  // Unified State
  const [profile, setProfile] = useState<UserGamificationProfile | null>(initialData?.profile || null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(initialData?.dashboard || null);
  const [leaderboard, setLeaderboard] = useState<OrganizationLeaderboard | null>(initialData?.leaderboard || null);
  const [isLoading, setIsLoading] = useState(!initialData?.profile);
  const [error, setError] = useState<GamificationError | null>(null);

  // Computed streaks
  const streaks = useMemo(
    () => ({
      login: profile?.login_streak || 0,
      learning: profile?.learning_streak || 0,
      maxLogin: profile?.longest_login_streak || 0,
      maxLearning: profile?.longest_learning_streak || 0,
    }),
    [profile],
  );

  // Unified data fetcher using new API client
  const fetchData = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      // Use type-safe client with automatic retry and caching
      const dash = await gamificationApi.getDashboard(orgId);
      const lb = await gamificationApi.getLeaderboard(orgId, { limit: 20 });

      if (dash) {
        setProfile(dash.profile);
        setDashboard(dash);
      }
      if (lb) setLeaderboard(lb);
    } catch (err) {
      // Type-safe error handling
      if (err && typeof err === 'object' && 'type' in err) {
        setError(err as GamificationError);
      } else {
        // Fallback for unknown errors using error factory
        const { createUnknownError } = await import('@/types/gamification/errors');
        setError(createUnknownError(
          err instanceof Error ? err.message : 'Failed to fetch gamification data',
          err,
        ));
      }
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  // Auto-fetch on mount and token/org changes
  useEffect(() => {
    if (!initialData?.profile) {
      fetchData();
    }
  }, [fetchData, initialData?.profile]);

  // Auto-login streak updater + daily login bonus
  // Runs when profile becomes available. Ensures at most once per day per org in the client by localStorage guard.
  useEffect(() => {
    if (!orgId) return;
    if (!profile) return;
    try {
      const todayKey = `gamification:lastLoginAward:${orgId}:${new Date().toISOString().slice(0, 10)}`;
      const alreadyDone = typeof window !== 'undefined' ? localStorage.getItem(todayKey) : '1';
      if (alreadyDone) return;

      // Fire-and-forget: update login streak, then award login bonus using new API client
      // Backend is idempotent and enforces daily caps; client guard prevents extra calls.
      (async () => {
        try {
          // Update login streak using type-safe client
          await gamificationApi.updateStreak(orgId, 'login');

          // Award login bonus with idempotency key per user/day/org
          await gamificationApi.awardXP(orgId, {
            source: 'login_bonus',
            idempotency_key: `login_bonus_${profile.user_id}_${orgId}_${new Date().toISOString().slice(0, 10)}`,
          });

          localStorage.setItem(todayKey, '1');
          // Refresh cached dashboard/profile
          fetchData();
        } catch {
          // non-fatal
        }
      })();
    } catch {
      // ignore storage errors (e.g., SSR)
    }
  }, [orgId, profile, fetchData]);

  // Action Handlers with optimistic updates
  const awardXP = useCallback(
    async (payload: XPAwardRequest): Promise<XPAwardResponse> => {
      if (!orgId) throw new Error('Organization required');

      // Optimistic update: immediately add XP to local state
      const optimisticAmount = payload.amount || 25; // Default XP
      if (profile) {
        const optimisticProfile = {
          ...profile,
          total_xp: profile.total_xp + optimisticAmount,
          daily_xp_earned: profile.daily_xp_earned + optimisticAmount,
        };
        setProfile(optimisticProfile);
        setDashboard((prev) => (prev ? { ...prev, profile: optimisticProfile } : prev));
      }

      try {
        // Use type-safe client with automatic retry
        const result = await gamificationApi.awardXP(orgId, payload);

        // Update with server response (authoritative)
        if (result.profile) {
          setProfile(result.profile);
          setDashboard((prev) => (prev ? { ...prev, profile: result.profile } : prev));
        }

        return result;
      } catch (error) {
        // Rollback optimistic update on error
        if (profile) {
          setProfile(profile);
          setDashboard((prev) => (prev ? { ...prev, profile } : prev));
        }
        throw error;
      }
    },
    [orgId, profile],
  );

  const updateStreak = useCallback(
    async (type: StreakType) => {
      if (!orgId) throw new Error('Organization required');

      // Use type-safe client
      await gamificationApi.updateStreak(orgId, type);

      // Refresh data
      await fetchData();
    },
    [orgId, fetchData],
  );

  const updatePreferences = useCallback(
    async (preferences: Record<string, unknown>) => {
      if (!orgId) throw new Error('Organization required');

      // Optimistic update
      if (profile) {
        const optimisticProfile = { ...profile, preferences: { ...profile.preferences, ...preferences } };
        setProfile(optimisticProfile);
        setDashboard((prev) => (prev ? { ...prev, profile: optimisticProfile } : prev));
      }

      try {
        // Use type-safe client
        const updatedProfile = await gamificationApi.updatePreferences(orgId, preferences);

        // Update with server response
        setProfile(updatedProfile);
        setDashboard((prev) => (prev ? { ...prev, profile: updatedProfile } : prev));
      } catch (error) {
        // Rollback on error
        if (profile) {
          setProfile(profile);
          setDashboard((prev) => (prev ? { ...prev, profile } : prev));
        }
        throw error;
      }
    },
    [orgId, profile],
  );

  const value: GamificationContextValue = {
    profile,
    dashboard,
    leaderboard,
    isLoading,
    error,
    awardXP,
    updateStreak,
    updatePreferences,
    refetch: fetchData,
    streaks,
  };

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamificationContext(): GamificationContextValue {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamificationContext must be used within a GamificationProvider');
  }
  return context;
}

// Optional: Hook with fallback for components that might be outside provider
export function useOptionalGamificationContext(): GamificationContextValue | null {
  return useContext(GamificationContext);
}
