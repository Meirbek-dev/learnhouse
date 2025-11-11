'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getUser } from '@services/users/users';

interface UserProfile {
  id: number;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar?: string;
  user_uuid?: string;
  theme?: string;
  locale?: string;
  [key: string]: any;
}

interface UserProfileContextValue {
  profile: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextValue | null>(null);

export function UserProfileProvider({ children }: { children: ReactNode }) {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const sessionUserId = session?.data?.user?.id;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!sessionUserId || !access_token) {
      setProfile(null);
      return;
    }

    // Don't refetch if we already have profile data for this user
    if (profile?.id === sessionUserId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await getUser(sessionUserId, access_token);
      setProfile(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch user profile');
      setError(error);
      console.error('Failed to fetch user profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionUserId, access_token, profile?.id]);

  const refetch = useCallback(async () => {
    if (!sessionUserId || !access_token) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await getUser(sessionUserId, access_token);
      setProfile(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch user profile');
      setError(error);
      console.error('Failed to refetch user profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [sessionUserId, access_token]);

  // Fetch profile when user changes or on mount
  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return (
    <UserProfileContext.Provider value={{ profile, isLoading, error, refetch }}>{children}</UserProfileContext.Provider>
  );
}

/**
 * Hook to access user profile data
 * Consolidates multiple user profile fetches into a single context
 */
export function useUserProfile() {
  const context = useContext(UserProfileContext);
  if (!context) {
    throw new Error('useUserProfile must be used within a UserProfileProvider');
  }
  return context;
}

/**
 * Optional hook that returns null if used outside provider
 * Useful for components that may or may not be wrapped in the provider
 */
export function useOptionalUserProfile() {
  return useContext(UserProfileContext);
}
