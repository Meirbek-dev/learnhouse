'use client';

import { useViewer } from '@/hooks/useViewer';
import type { Session } from '@/lib/auth/types';

export type CurrentUser = NonNullable<Session['user']>;

/**
 * Returns the authenticated user object, or null when loading / unauthenticated.
 */
export function useCurrentUser(): CurrentUser | null {
  return useViewer();
}
