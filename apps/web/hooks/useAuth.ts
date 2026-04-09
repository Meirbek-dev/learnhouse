'use client';

import useSWR from 'swr';
import { apiFetch } from '@/lib/api-client';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import { normalizeSession } from '@/lib/auth/session-utils';
import type { Session } from '@/lib/auth/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthState {
  session: Session | null;
  user: Session['user'] | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | undefined;
  mutate: ReturnType<typeof useSWR<Session | null>>['mutate'];
}

// SWR polls /users/session to detect expiry and reload claims after token rotation.
// JWT refresh itself is reactive (401 → tryRefreshToken in apiFetch), not proactive.
// This interval ensures the UI reflects a freshly rotated session promptly.
const SESSION_POLL_INTERVAL_MS = 4 * 60 * 1000; // 4 min (access token TTL: 30 min)

async function fetchSession(): Promise<Session | null> {
  const res = await apiFetch('/users/session', { method: 'GET' });

  if (res.status === 401) return null;

  if (!res.ok) {
    throw new Error(`Session fetch failed: ${res.status}`);
  }

  return normalizeSession(await res.json());
}

export function useAuth(): AuthState {
  const { data, error, isLoading, mutate } = useSWR<Session | null>(AUTH_SESSION_SWR_KEY, fetchSession, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: SESSION_POLL_INTERVAL_MS,
    shouldRetryOnError: false,
    dedupingInterval: 2_000,
  });

  const session = data ?? null;

  const status: AuthStatus = isLoading
    ? 'loading'
    : error !== undefined && data === undefined
      ? 'error'
      : session?.user
        ? 'authenticated'
        : 'unauthenticated';

  return {
    session,
    user: session?.user ?? null,
    status,
    isAuthenticated: status === 'authenticated',
    isLoading,
    error,
    mutate,
  };
}
