'use client';

import { PermissionProvider } from '@/components/Security/PermissionProvider';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import type { Session } from '@/lib/auth/types';
import { SWRConfig } from 'swr';
import type { ReactNode } from 'react';

interface PlatformSessionProvidersProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export default function PlatformSessionProviders({ children, initialSession }: PlatformSessionProvidersProps) {
  const fallback = initialSession === undefined ? undefined : { [AUTH_SESSION_SWR_KEY]: initialSession };

  return (
    <SWRConfig value={{ fallback }}>
      <PermissionProvider>{children}</PermissionProvider>
    </SWRConfig>
  );
}
