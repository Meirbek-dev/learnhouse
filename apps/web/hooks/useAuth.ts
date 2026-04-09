'use client';

import { useSessionContext } from '@/components/providers/session-provider';

export function useAuth() {
  return useSessionContext();
}
