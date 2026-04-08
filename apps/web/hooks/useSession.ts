'use client';

import { apiFetch } from '@/lib/api-client';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import { normalizeSession, type Session } from '@/lib/auth/types';
import useSWR from 'swr';

export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 60_000;

async function fetchSession(): Promise<Session | null> {
  const response = await apiFetch('/users/session', { method: 'GET' });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Session fetch failed: ${response.status}`);
  }

  const payload = await response.json();
  return normalizeSession(payload);
}

function getRefreshInterval(session: Session | null | undefined): number {
  if (!session?.expiresAt) {
    return 0;
  }

  const msUntilExpiry = session.expiresAt - Date.now();
  const refreshAt = msUntilExpiry - REFRESH_BEFORE_EXPIRY_MS;

  return Math.max(refreshAt, MIN_REFRESH_INTERVAL_MS);
}

export interface AuthSessionResult {
  session: Session | null;
  user: Session['user'] | null;
  error: Error | undefined;
  status: SessionStatus;
  isLoading: boolean;
  isAuthenticated: boolean;
  mutate: ReturnType<typeof useSWR<Session | null>>['mutate'];
}

export function useAuthSession(): AuthSessionResult {
  const { data, error, isLoading, mutate } = useSWR<Session | null>(AUTH_SESSION_SWR_KEY, fetchSession, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: getRefreshInterval,
    shouldRetryOnError: false,
    dedupingInterval: 2_000,
  });

  const status: SessionStatus = isLoading
    ? 'loading'
    : data?.user
      ? 'authenticated'
      : 'unauthenticated';

  const session = data ?? null;
  const user = session?.user ?? null;

  return {
    session,
    user,
    error,
    status,
    isLoading,
    isAuthenticated: status === 'authenticated',
    mutate,
  };
}

export function useAuthStatus(): SessionStatus {
  return useAuthSession().status;
}

export function useIsAuthenticated(): boolean {
  return useAuthSession().isAuthenticated;
}
