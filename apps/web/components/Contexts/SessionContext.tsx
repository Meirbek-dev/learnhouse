'use client';

import PageLoading from '@components/Objects/Loaders/PageLoading';
import { createContext, use, useMemo } from 'react';
import type { Role } from '@/types/permissions';
import { useSession } from 'next-auth/react';
import type { ReactNode } from 'react';

// Match the global UserRoleWithPlatform interface from next-auth.d.ts
interface UserRoleWithPlatform {
  role: Role;
}

// Extended session data interface - matches actual NextAuth session shape
interface ExtendedSessionData {
  user: {
    id: number;
    email: string;
    username: string;
    first_name: string | undefined;
    middle_name: string | undefined;
    last_name: string | undefined;
    avatar_image: string | undefined;
    user_uuid: string | undefined;
  };
  roles: UserRoleWithPlatform[] | undefined;
  tokens:
    | {
        access_token: string;
        refresh_token: string;
        expiry?: number;
      }
    | undefined;
  permissions: string[] | undefined;
  expires: string;
}

// Extended session interface that ensures data is properly typed when not null
interface ExtendedSession {
  data: ExtendedSessionData | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  update: () => Promise<ExtendedSessionData | null>;
  // Add isLoading property that some components expect
  isLoading?: boolean;
}

interface SessionContextType extends ExtendedSession {
  // Ensure data is never null when status is 'authenticated'
  data: ExtendedSessionData | null;
}

export const SessionContext = createContext<SessionContextType | null>(null);

const PlatformSessionProvider = ({ children }: { children: ReactNode }) => {
  const session = useSession();

  // Type assertion to ensure our extended interface
  const extendedSession: SessionContextType = useMemo(
    () => ({
      ...session,
      data: session.data as ExtendedSessionData | null,
      update: session.update as () => Promise<ExtendedSessionData | null>,
      isLoading: session.status === 'loading',
    }),
    [session],
  );

  // Only show loading on initial load, not during session updates/revalidation
  const isInitialLoad = session.status === 'loading' && session.data === undefined;

  if (isInitialLoad) {
    return <PageLoading />;
  }

  return <SessionContext value={extendedSession}>{children}</SessionContext>;
};

export function usePlatformSession(): SessionContextType {
  const context = use(SessionContext);
  if (!context) {
    throw new Error('usePlatformSession must be used within a PlatformSessionProvider');
  }
  return context;
}

export default PlatformSessionProvider;
