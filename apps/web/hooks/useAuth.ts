'use client';

import { useSessionContext } from '@/components/providers/session-provider';
import type { SessionContextValue } from '@/components/providers/session-provider';

/**
 * Access the current session, user, permissions, and auth utilities.
 *
 * Must be used inside a component tree wrapped by ``<SessionProvider>``.
 *
 * @example
 * ```tsx
 * const { isAuthenticated, user, can, refresh } = useAuth();
 *
 * if (can('course', 'create', 'platform')) {
 *   // ...
 * }
 * ```
 */
export function useAuth(): SessionContextValue {
  return useSessionContext();
}
