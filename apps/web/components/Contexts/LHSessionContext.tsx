'use client';

import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useSession } from 'next-auth/react';
import { createContext, use } from 'react';
import type { Session } from 'next-auth';
import type { ReactNode } from 'react';

// Extended session data interface to match actual usage patterns
interface ExtendedSessionData {
  user: {
    id: number;
    email: string;
    username: string;
    first_name: string | undefined;
    last_name: string | undefined;
    avatar_image: string | undefined;
    user_uuid: string | undefined;
    [key: string]: any; // Allow additional properties
  };
  roles: string[] | undefined;
  tokens:
    | {
        access_token: string;
        refresh_token: string;
        expiry?: number;
        [key: string]: any;
      }
    | undefined;
  // Also support direct username for backward compatibility
  username: string | undefined;
  expires: string;
  [key: string]: any; // Allow additional properties
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

const LHSessionProvider = ({ children }: { children: ReactNode }) => {
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

export function useLHSession(): SessionContextType {
  const context = use(SessionContext);
  if (!context) {
    throw new Error('useLHSession must be used within a LHSessionProvider');
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
  const session = useLHSession();

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

export function getRoles(session: SessionContextType): string[] {
  return session.data?.roles || [];
}

export default LHSessionProvider;
