'use client';

import { useSessionStore } from '@/lib/auth/session-store';
import type { ClientSession } from '@/lib/auth/types';

export type CurrentUser = NonNullable<ClientSession['user']>;

/**
 * Returns the authenticated user object, or null when loading / unauthenticated.
 * Reads directly from the Zustand session store — no context needed.
 */
export function useCurrentUser(): CurrentUser | null {
  return useSessionStore((s) => s.data?.user ?? null);
}
