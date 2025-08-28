'use client';

import { updateLearningStreak, updateLoginStreak } from '@/services/gamification/gamification';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAPIUrl } from '@/services/config/config';
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
  retryUpdate: () => Promise<void>;
  triggerLearningStreak: () => Promise<void>;
  lastError: Error | null;
  clearError: () => void;
}

// Global state to prevent duplicate requests across hook instances
const globalState = {
  pendingRequests: new Map<string, Promise<any>>(),
  completedToday: new Set<string>(),
};

/**
 * Enhanced gamification hook with improved error handling and deduplication
 *
 * Features:
 * - Automatic login streak tracking
 * - Request deduplication across hook instances
 * - Comprehensive error handling and retry logic
 * - Cross-device sync via server-side idempotency
 * - Proper cleanup and memory management
 */
export function useGamification({
  orgId,
  enabled = true,
  onError,
  onSuccess,
}: UseGamificationProps): UseGamificationReturn {
  const { data: session } = useSession();
  const t = useTranslations('Hooks.useGamification');

  // Create unique key for this user/org combination
  const getStateKey = useCallback(() => {
    if (!(session?.user?.id && orgId)) return null;
    return `${session.user.id}_${orgId}`;
  }, [session?.user?.id, orgId]);

  // Session-based check tracking (resets on browser restart)
  const getSessionKey = useCallback(() => {
    const stateKey = getStateKey();
    if (!stateKey) return null;
    const today = new Date().toDateString();
    return `gamification_${stateKey}_${today}`;
  }, [getStateKey]);

  const [hasCheckedToday, setHasCheckedToday] = useState(() => {
    if (typeof window === 'undefined') return false;
    const sessionKey = getSessionKey();
    if (!sessionKey) return false;

    // Check both sessionStorage and global state
    const sessionChecked = sessionStorage.getItem(sessionKey) === 'true';
    const globalChecked = globalState.completedToday.has(sessionKey);
    return sessionChecked || globalChecked;
  });

  const [isUpdating, setIsUpdating] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => {
    setLastError(null);
  }, []);

  const updateStreak = useCallback(async (): Promise<void> => {
    const stateKey = getStateKey();
    const sessionKey = getSessionKey();

    // Validation checks
    if (
      !(enabled && session?.tokens?.access_token && orgId && session?.user?.id && stateKey && sessionKey) ||
      hasCheckedToday ||
      isUpdating
    ) {
      return;
    }

    // Check for existing request to prevent duplicates
    if (globalState.pendingRequests.has(stateKey)) {
      try {
        await globalState.pendingRequests.get(stateKey);
        return;
      } catch (error) {
        // Handle error from existing request
        if (error instanceof Error) {
          setLastError(error);
          onError?.(error);
        }
        return;
      }
    }

    setIsUpdating(true);
    setLastError(null);

    // Cancel any previous request for this hook instance
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Create the request promise
    const requestPromise = (async () => {
      try {
        // Server handles idempotency - safe to call multiple times
        if (!session.tokens?.access_token) {
          throw new Error('Access token is not available');
        }
        const token = session.tokens.access_token;

        // 1. Fast path: HEAD streak endpoint (no body). If already updated today, skip POST.
        try {
          const controller = new AbortController();
          abortControllerRef.current = controller;
          const headResp = await fetch(`${getAPIUrl()}gamification/login-streak/${orgId}`, {
            method: 'HEAD',
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });
          if (headResp.status === 204) {
            const updatedHeader = headResp.headers.get('X-Login-Streak-Updated');
            const currentStreakHeader = headResp.headers.get('X-Current-Login-Streak');
            if (updatedHeader === 'true') {
              // Already updated today – mark and exit without POST
              if (typeof window !== 'undefined' && sessionKey) {
                sessionStorage.setItem(sessionKey, 'true');
              }
              globalState.completedToday.add(sessionKey!);
              setHasCheckedToday(true);
              logger.debug(
                `Login streak already updated today (streak=${currentStreakHeader}) for user ${session.user?.id}`,
              );
              onSuccess?.();
              return; // Done
            }
          }
        } catch (error) {
          // HEAD may fail (older server / network); fall back silently
          logger.debug('HEAD streak preflight skipped/fallback', error);
        }

        // 2. Perform POST update since not yet updated (or HEAD unsupported)
        const updatedProfile = await updateLoginStreak(orgId, token);

        // If server returns flag use it; otherwise assume success
        const flag = (updatedProfile as any)?.login_streak_updated_today;
        if (flag === false) {
          // Edge: server reports not updated (possible race). Avoid marking; allow retry later.
          logger.debug('Streak POST returned flag=false; not marking completedToday');
        } else {
          if (typeof window !== 'undefined' && sessionKey) {
            sessionStorage.setItem(sessionKey, 'true');
          }
          globalState.completedToday.add(sessionKey!);
          setHasCheckedToday(true);
        }

        // Mark as completed in both session storage and global state
        logger.debug(`Login streak processed for user ${session.user?.id} in org ${orgId}`);
        onSuccess?.();
      } catch (error) {
        // Handle different types of errors appropriately
        if (error instanceof Error && error.name === 'AbortError') {
          return; // Ignore aborted requests
        }

        const errorInstance =
          error instanceof Error ? error : new Error('Unknown error occurred during login streak update');

        // Don't set error state for network timeouts or temporary issues
        if (shouldRetryError(errorInstance)) {
          logger.warn('Temporary error updating login streak, will retry later:', errorInstance.message);
        } else {
          setLastError(errorInstance);
          onError?.(errorInstance);
        }

        throw errorInstance;
      }
    })();

    // Store the request promise globally
    globalState.pendingRequests.set(stateKey, requestPromise);

    try {
      await requestPromise;
    } finally {
      // Clean up the request from global state
      globalState.pendingRequests.delete(stateKey);
      setIsUpdating(false);
    }
  }, [
    enabled,
    session?.tokens?.access_token,
    session?.user?.id,
    orgId,
    hasCheckedToday,
    isUpdating,
    onError,
    onSuccess,
    getStateKey,
    getSessionKey,
  ]);

  const retryUpdate = useCallback(async (): Promise<void> => {
    const sessionKey = getSessionKey();

    // Reset state for retry
    setHasCheckedToday(false);
    setLastError(null);

    if (sessionKey && typeof window !== 'undefined') {
      sessionStorage.removeItem(sessionKey);
      globalState.completedToday.delete(sessionKey);
    }

    await updateStreak();
  }, [updateStreak, getSessionKey]);

  // Auto-trigger streak update on authentication
  useEffect(() => {
    if (session?.tokens?.access_token && enabled && !hasCheckedToday && !isUpdating) {
      // Add small delay to prevent race conditions on page load
      const timer = setTimeout(() => {
        updateStreak().catch((error) => {
          logger.error('Failed to update login streak on session change:', error);
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [session?.tokens?.access_token, enabled, hasCheckedToday, isUpdating, updateStreak]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Daily reset logic
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilTomorrow = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      // Reset local state
      setHasCheckedToday(false);
      clearError();

      // Clean up session storage and global state
      const sessionKey = getSessionKey();
      if (sessionKey && typeof window !== 'undefined') {
        sessionStorage.removeItem(sessionKey);
        globalState.completedToday.delete(sessionKey);
      }

      // Trigger update if user is still authenticated
      if (session?.tokens?.access_token && enabled) {
        updateStreak().catch((error) => {
          logger.error('Failed to update login streak on daily reset:', error);
        });
      }
    }, msUntilTomorrow);

    return () => clearTimeout(timeout);
  }, [session?.tokens?.access_token, enabled, updateStreak, getSessionKey, clearError]);

  return {
    isAuthenticated: !!session?.tokens?.access_token,
    orgId,
    hasCheckedToday,
    isUpdating,
    retryUpdate,
    triggerLearningStreak: async () => {
      if (!(session?.tokens?.access_token && orgId)) return;
      try {
        await updateLearningStreak(orgId, session.tokens.access_token);
      } catch (error) {
        logger.warn('Learning streak update failed', error);
      }
    },
    lastError,
    clearError,
  };
}

/**
 * Determine if an error should trigger automatic retry
 */
function shouldRetryError(error: Error): boolean {
  const retryableErrors = [
    'NetworkError',
    'TypeError', // Often network-related
    'timeout',
    'ECONNRESET',
    'ENOTFOUND',
  ];

  return retryableErrors.some(
    (errorType) => error.name.includes(errorType) || error.message.toLowerCase().includes(errorType.toLowerCase()),
  );
}

// Simple logger that respects environment
const logger = {
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[useGamification] ${message}`, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    console.warn(`[useGamification] ${message}`, ...args);
  },
  error: (message: string, ...args: any[]) => {
    console.error(`[useGamification] ${message}`, ...args);
  },
};
