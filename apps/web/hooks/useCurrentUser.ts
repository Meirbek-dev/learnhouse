'use client';

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import type { ClientSession } from '@/lib/auth/types';

export type CurrentUser = NonNullable<ClientSession['user']>;

/**
 * Returns the authenticated user object, or null when loading / unauthenticated.
 *
 * Prefer this over `usePlatformSession().data?.user` at every call site —
 * it's typed, concise, and eliminates the need to cast to `any`.
 */
export function useCurrentUser(): CurrentUser | null {
  return usePlatformSession().data?.user ?? null;
}
