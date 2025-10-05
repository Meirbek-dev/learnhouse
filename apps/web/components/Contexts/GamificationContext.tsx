'use client';

import type {
  DashboardData,
  GamificationError,
  OrganizationLeaderboard,
  UserGamificationProfile,
  XPAwardRequest,
  XPAwardResponse,
} from '@/types/gamification';
import {
  awardXPAction,
  updateStreakAction,
  updatePreferencesAction,
} from '@/app/actions/gamification';
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';

/**
 * SIMPLIFIED GAMIFICATION CONTEXT v3
 *
 * Responsibilities:
 * - UI state (animations, loading states)
 * - Server Action orchestration
 * - Optimistic UI updates
 *
 * NOT responsible for:
 * - Data fetching (handled by Server Components)
 * - Client-side caching (handled by Next.js)
 * - Complex retry logic (handled by Server Actions)
 */

interface GamificationContextValue {
  // Core Data (provided by Server Components via props)
  profile: UserGamificationProfile | null;
  dashboard: DashboardData | null;
  leaderboard: OrganizationLeaderboard | null;

  // States
  isLoading: boolean;
  error: GamificationError | null;

  // Actions (Server Actions)
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
  // Server-provided data (updated via props)
  const [profile, setProfile] = useState<UserGamificationProfile | null>(initialData?.profile || null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(initialData?.dashboard || null);
  const [leaderboard, setLeaderboard] = useState<OrganizationLeaderboard | null>(initialData?.leaderboard || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GamificationError | null>(null);

  // Update state when initialData changes (from server-side refetch)
  useEffect(() => {
    if (initialData?.profile) setProfile(initialData.profile);
    if (initialData?.dashboard) setDashboard(initialData.dashboard);
    if (initialData?.leaderboard) setLeaderboard(initialData.leaderboard);
  }, [initialData]);

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

  // Refetch function (triggers router.refresh or revalidation)
  const refetch = useCallback(async () => {
    // In Next.js App Router, you'd typically use router.refresh() here
    // or trigger revalidation via Server Actions
    setIsLoading(true);
    try {
      // Trigger page revalidation - the Server Component will refetch
      // This could be enhanced with router.refresh() if needed
      window.location.reload(); // Simple solution - can be improved
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Award XP with optimistic update
  const awardXP = useCallback(
    async (payload: XPAwardRequest): Promise<XPAwardResponse> => {
      setError(null);
      try {
        // Call Server Action
        const result = await awardXPAction(orgId, payload);

        // Optimistically update local state
        if (result.profile) {
          setProfile(result.profile);
          // Update dashboard if needed
          if (dashboard) {
            setDashboard({
              ...dashboard,
              profile: result.profile,
            });
          }
        }

        return result;
      } catch (err: any) {
        const error: GamificationError = {
          type: 'SERVER_ERROR',
          message: err.message || 'Failed to award XP',
          timestamp: new Date().toISOString(),
          statusCode: err.statusCode || 500,
        };
        setError(error);
        throw error;
      }
    },
    [orgId, dashboard],
  );

  // Update streak
  const updateStreak = useCallback(
    async (type: 'login' | 'learning') => {
      setError(null);
      try {
        const result = await updateStreakAction(orgId, type);

        // Optimistically update local profile
        if (result) {
          setProfile((prev) =>
            prev
              ? {
                  ...prev,
                  ...(type === 'login'
                    ? {
                        login_streak: result.current_streak,
                        longest_login_streak: result.longest_streak,
                      }
                    : {
                        learning_streak: result.current_streak,
                        longest_learning_streak: result.longest_streak,
                      }),
                }
              : null
          );
        }
      } catch (err: any) {
        const error: GamificationError = {
          type: 'SERVER_ERROR',
          message: err.message || 'Failed to update streak',
          timestamp: new Date().toISOString(),
          statusCode: err.statusCode || 500,
        };
        setError(error);
        throw error;
      }
    },
    [orgId],
  );

  // Update preferences
  const updatePreferences = useCallback(
    async (preferences: Record<string, any>) => {
      setError(null);
      try {
        await updatePreferencesAction(orgId, preferences);

        // Optimistically update local profile
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                preferences: { ...prev.preferences, ...preferences },
              }
            : null
        );
      } catch (err: any) {
        const error: GamificationError = {
          type: 'SERVER_ERROR',
          message: err.message || 'Failed to update preferences',
          timestamp: new Date().toISOString(),
          statusCode: err.statusCode || 500,
        };
        setError(error);
        throw error;
      }
    },
    [orgId],
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
    refetch,
    streaks,
  };

  return <GamificationContext.Provider value={value}>{children}</GamificationContext.Provider>;
}

export function useGamificationContext(): GamificationContextValue {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamificationContext must be used within GamificationProvider');
  }
  return context;
}

// Optional: Hook with fallback for components that might be outside provider
export function useOptionalGamificationContext(): GamificationContextValue | null {
  return useContext(GamificationContext);
}
