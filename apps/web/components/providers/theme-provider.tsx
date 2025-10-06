'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyTheme, getStoredTheme, getTheme } from '@/lib/themes';
import { loadTheme } from '@/lib/theme-lazy-loader';
import type { Theme } from '@/lib/themes';
import type { ReactNode } from 'react';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (themeName: string, syncToServer?: boolean) => Promise<void>;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultThemeName?: string;
  userTheme?: string | null;
}

export function ThemeProvider({ children, defaultThemeName = 'default', userTheme }: ThemeProviderProps) {
  const [themeName, setThemeName] = useState<string>(() => {
    // Initialize with stored theme or fallback
    if (typeof window !== 'undefined') {
      return getStoredTheme() || userTheme || defaultThemeName;
    }
    return userTheme || defaultThemeName;
  });
  const [isLoading, setIsLoading] = useState(true);
  const serverSyncTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Memoize theme object to prevent unnecessary re-renders
  const theme = useMemo(() => getTheme(themeName), [themeName]);

  // Initialize theme on mount
  useEffect(() => {
    const effectiveTheme = getStoredTheme() || userTheme || defaultThemeName;
    const initialTheme = getTheme(effectiveTheme);

    applyTheme(initialTheme);
    setThemeName(effectiveTheme);
    setIsLoading(false);
  }, [defaultThemeName, userTheme]);

  // Track pending theme sync
  const pendingThemeSyncRef = useRef<string | null>(null);

  // Debounced server sync function
  const debouncedServerSync = useCallback((theme: string) => {
    pendingThemeSyncRef.current = theme;

    // Clear existing timeout
    if (serverSyncTimeoutRef.current) {
      clearTimeout(serverSyncTimeoutRef.current);
    }

    // Set new timeout for server sync (1000ms debounce)
    serverSyncTimeoutRef.current = setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('themeChange', {
            detail: { theme },
          }),
        );
        pendingThemeSyncRef.current = null;
      }
    }, 1000);
  }, []);

  // Sync pending theme on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingThemeSyncRef.current) {
        // Sync immediately before leaving using beacon API (non-blocking)
        const data = JSON.stringify({ theme: pendingThemeSyncRef.current });
        navigator.sendBeacon('/api/user/theme', data);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (serverSyncTimeoutRef.current) {
        clearTimeout(serverSyncTimeoutRef.current);
      }
    };
  }, []);

  const setTheme = useCallback(
    async (newThemeName: string, syncToServer = true) => {
      // Lazy load theme (uses cache for core themes like 'default' and 'black')
      const newTheme = await loadTheme(newThemeName);

      if (newTheme) {
        setThemeName(newThemeName);
        applyTheme(newTheme);

        // Debounced sync to server
        if (syncToServer) {
          debouncedServerSync(newThemeName);
        }
      } else {
        // Fallback to default theme if load fails
        console.warn(`Failed to load theme: ${newThemeName}, falling back to default`);
        const fallbackTheme = getTheme('default');
        setThemeName('default');
        applyTheme(fallbackTheme);
      }
    },
    [debouncedServerSync],
  );

  // Memoize context value to prevent re-renders
  const contextValue = useMemo(
    () => ({
      theme,
      setTheme,
      isLoading,
    }),
    [theme, setTheme, isLoading],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);

  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
