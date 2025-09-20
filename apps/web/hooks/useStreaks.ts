'use client';

import { useGamification } from '@/hooks/useGamification';

export interface StreakInfo {
  login: number;
  learning: number;
  maxLogin?: number | null;
  maxLearning?: number | null;
  /** Future: next UTC reset timestamp (ISO) if backend exposes; null otherwise */
  nextResetAt?: string | null;
  /** Future: whether streak is at risk (e.g., last day) */
  isAtRisk?: boolean | null;
}

/**
 * Centralized streak selection hook.
 * Prefers server-provided separate login / learning streaks.
 * Falls back to unified `current_streak` if older field still present.
 */
export function useStreaks() {
  // NOTE: This hook expects a parent component to provide orgId/accessTokened context normally via useGamification.
  // For broad reuse we accept that some callers might re-run useGamification; they should memoize options.
  // Here we attempt to derive orgId/accessToken from a closure is not possible; so we expose a helper variant below.
  // This default invocation is a no-op; prefer useProvideStreaks(orgId, accessToken) instead.
  const { profile } = useGamification({ orgId: 0, enabled: false });

  if (!profile) {
    return { streaks: null } as const;
  }

  const login = (profile as any).current_login_streak ?? (profile as any).current_streak ?? 0;
  const learning = (profile as any).current_learning_streak ?? 0;
  const maxLogin = (profile as any).longest_login_streak ?? null;
  const maxLearning = (profile as any).longest_learning_streak ?? null;

  return {
    streaks: {
      login,
      learning,
      maxLogin,
      maxLearning,
      nextResetAt: null,
      isAtRisk: null,
    } as StreakInfo,
  } as const;
}

export function useProvideStreaks(orgId: number, accessToken?: string | null) {
  const { profile } = useGamification({ orgId, accessToken, enabled: !!orgId && !!accessToken });
  if (!profile) return { streaks: null } as const;
  const login = (profile as any).current_login_streak ?? (profile as any).current_streak ?? 0;
  const learning = (profile as any).current_learning_streak ?? 0;
  const maxLogin = (profile as any).longest_login_streak ?? null;
  const maxLearning = (profile as any).longest_learning_streak ?? null;
  // Placeholder future fields (backend integration TBD)
  const nextResetAt: string | null = null;
  const isAtRisk: boolean | null = null;
  return { streaks: { login, learning, maxLogin, maxLearning, nextResetAt, isAtRisk } as StreakInfo } as const;
}

export default useStreaks;
