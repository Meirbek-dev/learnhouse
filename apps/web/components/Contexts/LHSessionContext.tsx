'use client';

import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useSession } from 'next-auth/react';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { Role } from '@/types/permissions';

// Match the global UserRoleWithOrg interface from next-auth.d.ts
interface UserRoleWithOrg {
  role: Role;
  org: {
    id: number;
    org_uuid: string;
    name: string;
    slug: string;
  };
}

// Extended session data interface — matches actual NextAuth session shape
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
  roles: UserRoleWithOrg[] | undefined;
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

  const isLoading = session.status === 'loading';

  if (isLoading) {
    return <PageLoading />;
  }

  // Type assertion to ensure our extended interface
  const extendedSession: SessionContextType = {
    ...session,
    data: session.data as ExtendedSessionData | null,
    update: session.update as () => Promise<ExtendedSessionData | null>,
    isLoading,
  };

  return <SessionContext value={extendedSession}>{children}</SessionContext>;
};

export function usePlatformSession(): SessionContextType {
  const context = use(SessionContext);
  if (!context) {
    throw new Error('usePlatformSession must be used within a PlatformSessionProvider');
  }
  return context;
}

// Type guard to check if session data exists and is authenticated
export function isAuthenticated(session: SessionContextType): session is SessionContextType & {
  data: ExtendedSessionData;
} {
  return session.status === 'authenticated' && session.data !== null;
}

// Helper hook that ensures session data is available
export function useAuthenticatedSession(): ExtendedSessionData {
  const session = usePlatformSession();

  if (!isAuthenticated(session)) {
    throw new Error('useAuthenticatedSession must be used when user is authenticated');
  }

  return session.data;
}

// Helper functions for safe property access
export function getUserProperty<T>(
  session: SessionContextType,
  property: keyof ExtendedSessionData['user'],
  defaultValue?: T,
): T | undefined {
  if (!session.data?.user) return defaultValue;
  const value = session.data.user[property];
  return value !== undefined ? (value as T) : defaultValue;
}

export function getTokens(session: SessionContextType): ExtendedSessionData['tokens'] {
  return session.data?.tokens;
}

export function getRoles(session: SessionContextType): UserRoleWithOrg[] {
  return session.data?.roles || [];
}

export default PlatformSessionProvider;
