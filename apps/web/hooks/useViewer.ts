'use client';

import { useAuthSession } from '@/hooks/useSession';

export function useViewer() {
  return useAuthSession().user;
}
