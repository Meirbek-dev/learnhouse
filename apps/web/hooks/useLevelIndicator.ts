'use client';

import type { GamificationProfile } from '@/services/gamification/gamification';
import { getGamificationProfile } from '@/services/gamification/gamification';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';

interface UseLevelIndicatorProps {
  orgId: number;
  enabled?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface UseLevelIndicatorReturn {
  profile: GamificationProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  showLevelIndicator: boolean;
  currentLevel: number;
  hasLeveledUp: boolean;
  resetLevelUp: () => void;
}

/**
 * Hook to manage level indicators throughout the application
 * Provides gamification profile data and level-up detection
 */
export function useLevelIndicator({
  orgId,
  enabled = true,
  autoRefresh = false,
  refreshInterval = 30_000, // 30 seconds
}: UseLevelIndicatorProps): UseLevelIndicatorReturn {
  const { data: session } = useSession();
  const t = useTranslations('Hooks.useLevelIndicator');
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previousLevel, setPreviousLevel] = useState<number>(0);
  const [hasLeveledUp, setHasLeveledUp] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!(enabled && session?.tokens?.access_token && orgId)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const profileData = await getGamificationProfile(orgId, session.tokens.access_token);

      // Check for level up
      if (profile && profileData.current_level > profile.current_level) {
        setHasLeveledUp(true);
        setPreviousLevel(profile.current_level);

        // Show level up toast
        toast.success(t('levelUpMessage', { level: profileData.current_level }), {
          duration: 5000,
          style: {
            background: '#10B981',
            color: 'white',
          },
        });
      }

      setProfile(profileData);
    } catch (error) {
      console.error('Error fetching gamification profile:', error);
      setError(t('failedToLoadProfile'));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, session?.tokens?.access_token, orgId, profile, t]);

  const resetLevelUp = useCallback(() => {
    setHasLeveledUp(false);
    setPreviousLevel(0);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Auto-refresh if enabled
  useEffect(() => {
    if (!(autoRefresh && enabled)) return;

    const interval = setInterval(fetchProfile, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, enabled, fetchProfile, refreshInterval]);

  // Listen for gamification events (like XP gains)
  useEffect(() => {
    const handleGamificationUpdate = () => {
      fetchProfile();
    };

    // Custom event listener for when XP is gained elsewhere in the app
    window.addEventListener('gamification:update', handleGamificationUpdate);

    return () => {
      window.removeEventListener('gamification:update', handleGamificationUpdate);
    };
  }, [fetchProfile]);

  const showLevelIndicator = Boolean(enabled && session?.user && profile && profile.current_level > 1);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile,
    showLevelIndicator,
    currentLevel: profile?.current_level || 1,
    hasLeveledUp,
    resetLevelUp,
  };
}

/**
 * Utility function to trigger a gamification update event
 * Call this when XP is awarded or levels change
 */
export function triggerGamificationUpdate() {
  window.dispatchEvent(new CustomEvent('gamification:update'));
}

/**
 * Hook specifically for tracking XP gains and showing notifications
 */
export function useXPTracking(orgId: number) {
  const { profile, refetch } = useLevelIndicator({ orgId });
  const t = useTranslations('Hooks.useLevelIndicator');
  const [lastXP, setLastXP] = useState<number>(0);

  useEffect(() => {
    if (profile && lastXP > 0 && profile.total_xp > lastXP) {
      const xpGained = profile.total_xp - lastXP;
      toast.success(t('xpGained', { amount: xpGained }), {
        duration: 2000,
        position: 'bottom-right',
        style: {
          background: '#3B82F6',
          color: 'white',
        },
      });
    }

    if (profile) {
      setLastXP(profile.total_xp);
    }
  }, [profile, lastXP, t]);

  const awardXP = useCallback(
    async (amount: number, source: string) => {
      // TODO: call the API to award XP
      // For now, just refresh the profile
      await refetch();
      triggerGamificationUpdate();
    },
    [refetch],
  );

  return {
    profile,
    awardXP,
    refetch,
  };
}
