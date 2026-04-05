'use client';

import { createContext, useContext, useState } from 'react';
import { applyTheme, getStoredTheme, getTheme } from '@/lib/themes';
import { loadTheme } from '@/lib/theme-lazy-loader';
import type { Theme } from '@/lib/themes';
import type { ReactNode } from 'react';

interface ThemeContextValue {
  theme: Theme;
  themeName: string;
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
  // Initialize theme name and apply theme immediately during initialization
  const [themeName, setThemeName] = useState<string>(() => {
    if (typeof globalThis.window !== 'undefined') {
      const effectiveTheme = getStoredTheme() || userTheme || defaultThemeName;
      const initialTheme = getTheme(effectiveTheme);
      applyTheme(initialTheme);
      return effectiveTheme;
    }
    return userTheme || defaultThemeName;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Theme object
  const theme = getTheme(themeName);

  const setTheme = async (newThemeName: string, syncToServer = true) => {
    setIsLoading(true);
    // Lazy load theme (uses cache for core themes like 'default' and 'black')
    const newTheme = await loadTheme(newThemeName);
    setIsLoading(false);

    if (newTheme) {
      setThemeName(newThemeName);
      applyTheme(newTheme);
    } else {
      // Fallback to default theme if load fails
      console.warn(`Failed to load theme: ${newThemeName}, falling back to default`);
      const fallbackTheme = getTheme('default');
      setThemeName('default');
      applyTheme(fallbackTheme);
    }
  };

  // Context value (no memo)
  const contextValue = {
    theme,
    themeName,
    setTheme,
    isLoading,
  };

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
