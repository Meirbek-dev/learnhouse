'use client';

import { updateLoginStreak } from '@/services/gamification/gamification';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

interface UseGamificationProps {
  orgId: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
  onSuccess?: () => void;
}

interface UseGamificationReturn {
  isAuthenticated: boolean;
  orgId: number;
  hasCheckedToday: boolean;
  isUpdating: boolean;
  lastUpdateDate: string | null;
  retryUpdate: () => Promise<void>;
}

/**
 * Get the current date in YYYY-MM-DD format
 */
function getCurrentDateString(): string {
  return new Date().toISOString().split('T')[0]!;
}

/**
 * Get the storage key for the last login streak update
 */
function getStorageKey(userId: string, orgId: number): string {
  return `gamification_login_streak_${userId}_${orgId}`;
}

/**
 * Check if localStorage is available (SSR safe)
 */
function isLocalStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null;
  } catch {
    return false;
  }
}

/**
 * Hook to automatically track user gamification activities
 * - Updates login streaks once per day (not per session)
 * - Uses localStorage to persist across browser sessions
 * - Can be extended to track other activities
 * - Includes proper error handling and cleanup
 * - SSR safe with proper hydration
 */
export function useGamification({
  orgId,
  enabled = true,
  onError,
  onSuccess,
}: UseGamificationProps): UseGamificationReturn {
  const { data: session } = useSession();
  const t = useTranslations('Hooks.useGamification');
  const hasCheckedToday = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isUpdatingRef = useRef(false);

  // Memoize userId to prevent unnecessary re-renders
  const userId = useMemo(() => session?.user?.id || session?.user?.email, [session?.user?.id, session?.user?.email]);

  // Get last update date from localStorage
  const lastUpdateDate = useMemo(() => {
    if (!(isLocalStorageAvailable() && userId)) return null;
    return localStorage.getItem(getStorageKey(String(userId), orgId));
  }, [userId, orgId]);

  const updateStreak = useCallback(async () => {
    if (
      !(enabled && session?.tokens?.access_token && orgId && userId) ||
      hasCheckedToday.current ||
      isUpdatingRef.current
    ) {
      return;
    }

    if (!isLocalStorageAvailable()) {
      console.warn(t('localStorageNotAvailable'));
      return;
    }

    try {
      isUpdatingRef.current = true;
      const currentDate = getCurrentDateString();
      const storageKey = getStorageKey(String(userId), orgId);
      const lastUpdate = localStorage.getItem(storageKey);

      // Only update if we haven't already updated today
      if (lastUpdate !== currentDate) {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        await updateLoginStreak(orgId, session.tokens.access_token);

        // Store the current date to prevent multiple updates today
        localStorage.setItem(storageKey, currentDate);

        if (process.env.NODE_ENV === 'development') {
          console.log(t('loginStreakUpdated', { date: currentDate }));
        }

        onSuccess?.();
      }

      // Prevent multiple checks in the same session
      hasCheckedToday.current = true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Ignore aborted requests
      }

      const errorInstance = error instanceof Error ? error : new Error('Unknown error occurred');
      console.error(t('failedToUpdateStreak'), errorInstance);
      onError?.(errorInstance);
    } finally {
      isUpdatingRef.current = false;
    }
  }, [enabled, session?.tokens?.access_token, userId, orgId, onError, onSuccess, t]);

  // Manual retry function for error recovery
  const retryUpdate = useCallback(async () => {
    hasCheckedToday.current = false;
    await updateStreak();
  }, [updateStreak]);

  useEffect(() => {
    updateStreak();

    // Cleanup function to abort any pending requests
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [updateStreak]);

  // Reset check when session changes or on new day
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilTomorrow = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      hasCheckedToday.current = false;
      // Trigger update on new day if user is still authenticated
      if (session?.tokens?.access_token && enabled) {
        updateStreak();
      }
    }, msUntilTomorrow);

    return () => clearTimeout(timeout);
  }, [session?.tokens?.access_token, enabled, updateStreak]);

  return {
    isAuthenticated: !!session?.tokens?.access_token,
    orgId,
    hasCheckedToday: hasCheckedToday.current,
    isUpdating: isUpdatingRef.current,
    lastUpdateDate,
    retryUpdate,
  };
}
