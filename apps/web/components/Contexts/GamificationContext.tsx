'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { UserGamificationProfile, DashboardData, OrganizationLeaderboard, XPAwardRequest, XPAwardResponse } from '@/types/gamification';

/**
 * UNIFIED GAMIFICATION CONTEXT
 *
 * Eliminates redundant state management by providing:
 * - Single source of truth for all gamification data
 * - Automatic data sharing across components
 * - Unified loading and error states
 * - Smart caching and refetch logic
 */

interface GamificationContextValue {
  // Core Data
  profile: UserGamificationProfile | null;
  dashboard: DashboardData | null;
  leaderboard: OrganizationLeaderboard | null;

  // States
  isLoading: boolean;
  error: string | null;

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
  const [profile, setProfile] = useState<UserGamificationProfile | null>(
    initialData?.profile || null
  );
  const [dashboard, setDashboard] = useState<DashboardData | null>(
    initialData?.dashboard || null
  );
  const [leaderboard, setLeaderboard] = useState<OrganizationLeaderboard | null>(
    initialData?.leaderboard || null
  );
  const [isLoading, setIsLoading] = useState(!initialData?.profile);
  const [error, setError] = useState<string | null>(null);

  // Computed streaks
  const streaks = React.useMemo(() => ({
    login: profile?.login_streak || 0,
    learning: profile?.learning_streak || 0,
    maxLogin: profile?.longest_login_streak || 0,
    maxLearning: profile?.longest_learning_streak || 0,
  }), [profile]);

  // Unified data fetcher
  const fetchData = React.useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/gamification/${orgId}`, { method: 'GET' });
      if (!res.ok) throw new Error('Failed to load');
      const json = await res.json();
      const dash: DashboardData | null = json.dashboard ?? null;
      const lb: OrganizationLeaderboard | null = json.leaderboard ?? null;
      if (dash) {
        setProfile(dash.profile);
        setDashboard(dash);
      }
      if (lb) setLeaderboard(lb);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch gamification data');
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

  // Action Handlers
  const awardXP = React.useCallback(async (payload: XPAwardRequest): Promise<XPAwardResponse> => {
    if (!orgId) throw new Error('Organization required');
    // Keep using internal route to reuse server auth/session
    const res = await fetch(`/api/gamification/${orgId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'award_xp', ...payload }),
    });
    if (!res.ok) throw new Error('Failed to award XP');
    const result = (await res.json()) as XPAwardResponse;
    if (result.profile) {
      setProfile(result.profile);
      setDashboard((prev) => (prev ? { ...prev, profile: result.profile } : prev));
    }
    return result;
  }, [orgId]);

  const updateStreak = React.useCallback(async (type: 'login' | 'learning') => {
    if (!orgId) throw new Error('Organization required');
    // Use internal route proxy to server util which calls /streaks/{type}
    const res = await fetch(`/api/gamification/${orgId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_streak', streak_type: type }),
    });
    if (!res.ok) throw new Error('Failed to update streak');
    await fetchData();
  }, [orgId, fetchData]);

  const updatePreferences = React.useCallback(async (preferences: Record<string, any>) => {
    if (!orgId) throw new Error('Organization required');
    // Use internal route proxy to server util which PATCHes /preferences
    const res = await fetch(`/api/gamification/${orgId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update_preferences', preferences }),
    });
    if (!res.ok) throw new Error('Failed to update preferences');
    const result = await res.json();
    if (profile && result?.preferences) {
      const updatedProfile = { ...profile, preferences: result.preferences } as UserGamificationProfile;
      setProfile(updatedProfile);
      setDashboard((prev) => (prev ? { ...prev, profile: updatedProfile } : prev));
    }
  }, [orgId, profile]);

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

  return (
    <GamificationContext.Provider value={value}>
      {children}
    </GamificationContext.Provider>
  );
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
