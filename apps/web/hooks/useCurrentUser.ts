'use client';

import { useAuthSession } from '@/hooks/useSession';
import type { Session } from '@/lib/auth/types';

export type CurrentUser = NonNullable<Session['user']>;

/**
 * Returns the authenticated user object, or null when loading / unauthenticated.
 */
export function useCurrentUser(): CurrentUser | null {
  return useAuthSession().user;
}
