'use client';

import type {
  DashboardData,
  GamificationError,
  OrganizationLeaderboard,
  UserGamificationProfile,
  XPAwardRequest,
  XPAwardResponse,
} from '@/types/gamification';
import { awardXPAction, updateStreakAction, updatePreferencesAction } from '@/app/actions/gamification';
import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { XPToast, LevelUpCelebration } from '@/components/Dashboard/Gamification/xp-toast';
import { AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';

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

  // XP Toast notifications
  showXPToast: (amount: number, source?: string, triggeredLevelUp?: boolean) => void;
  showLevelUpCelebration: (newLevel: number) => void;

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
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  // Server-provided data (updated via props)
  const [profile, setProfile] = useState<UserGamificationProfile | null>(initialData?.profile || null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(initialData?.dashboard || null);
  const [leaderboard, setLeaderboard] = useState<OrganizationLeaderboard | null>(initialData?.leaderboard || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<GamificationError | null>(null);

  // XP Toast state
  const [xpToastQueue, setXpToastQueue] = useState<
    Array<{ amount: number; source?: string; triggeredLevelUp?: boolean }>
  >([]);
  const [levelUpQueue, setLevelUpQueue] = useState<Array<{ newLevel: number }>>([]);

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
          message: err.message || t('error.awardXPFailed'),
          timestamp: new Date().toISOString(),
          statusCode: err.statusCode || 500,
        };
        setError(error);
        throw error;
      }
    },
    [orgId, dashboard, t],
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
              : null,
          );
        }
      } catch (err: any) {
        const error: GamificationError = {
          type: 'SERVER_ERROR',
          message: err.message || t('error.updateStreakFailed'),
          timestamp: new Date().toISOString(),
          statusCode: err.statusCode || 500,
        };
        setError(error);
        throw error;
      }
    },
    [orgId, t],
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
            : null,
        );
      } catch (err: any) {
        const error: GamificationError = {
          type: 'SERVER_ERROR',
          message: err.message || t('error.updatePreferencesFailed'),
          timestamp: new Date().toISOString(),
          statusCode: err.statusCode || 500,
        };
        setError(error);
        throw error;
      }
    },
    [orgId, t],
  );

  // XP Toast handlers with improved UX
  const showXPToast = useCallback((amount: number, source?: string, triggeredLevelUp?: boolean) => {
    setXpToastQueue((prev) => {
      // Limit queue to 3 items
      const filtered = prev.slice(-2);
      return [...filtered, { amount, source, triggeredLevelUp }];
    });
  }, []);

  const showLevelUpCelebration = useCallback((newLevel: number) => {
    // Only show one level-up at a time
    setLevelUpQueue([{ newLevel }]);
  }, []);

  const dismissLevelUpCelebration = useCallback(() => {
    setLevelUpQueue([]);
  }, []);

  const handleToastComplete = useCallback((index: number) => {
    setXpToastQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
    showXPToast,
    showLevelUpCelebration,
    streaks,
  };

  return (
    <GamificationContext.Provider value={value}>
      {children}
      {/* Render XP toasts */}
      <AnimatePresence mode="popLayout">
        {xpToastQueue.map((toast, index) => (
          <XPToast
            key={`toast-${index}-${toast.amount}`}
            amount={toast.amount}
            source={toast.source}
            triggeredLevelUp={toast.triggeredLevelUp}
            onComplete={() => handleToastComplete(index)}
          />
        ))}
      </AnimatePresence>
      {/* Render level-up celebrations */}
      <AnimatePresence>
        {levelUpQueue.length > 0 && levelUpQueue[0] && (
          <LevelUpCelebration
            newLevel={levelUpQueue[0].newLevel}
            onDismiss={dismissLevelUpCelebration}
            compact={(profile?.preferences as any)?.display?.compactMode ?? false}
          />
        )}
      </AnimatePresence>
    </GamificationContext.Provider>
  );
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
