'use client';

import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@/lib/auth/types';

export interface SessionContextValue {
  isAuthenticated: boolean;
  session: Session | null;
  user: Session['user'] | null;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  initialSession?: Session | null;
}

export function SessionProvider({ children, initialSession = null }: SessionProviderProps) {
  const value: SessionContextValue = {
    isAuthenticated: initialSession?.user !== undefined,
    session: initialSession,
    user: initialSession?.user ?? null,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSessionContext(): SessionContextValue {
  const context = use(SessionContext);

  if (context === undefined) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }

  return context;
}
