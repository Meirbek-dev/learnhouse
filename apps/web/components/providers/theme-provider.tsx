'use client';

import { applyTheme, defaultTheme, getStoredTheme, getTheme } from '@/lib/themes';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Theme } from '@/lib/themes';
import type { ReactNode } from 'react';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (themeName: string, syncToServer?: boolean) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultThemeName?: string;
  userTheme?: string | null;
}

export function ThemeProvider({ children, defaultThemeName = 'default', userTheme }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize theme on mount
  useEffect(() => {
    // Priority: localStorage > userTheme from database > defaultThemeName
    // localStorage takes priority to ensure immediate theme changes persist on refresh
    const effectiveTheme = getStoredTheme() || userTheme || defaultThemeName;
    const initialTheme = getTheme(effectiveTheme);

    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setIsLoading(false);
  }, [defaultThemeName, userTheme]);

  const setTheme = (themeName: string, syncToServer = true) => {
    const newTheme = getTheme(themeName);
    setThemeState(newTheme);
    applyTheme(newTheme);

    // Sync to server if user is logged in (handled by the component using this)
    if (syncToServer && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('themeChange', {
          detail: { theme: themeName },
        }),
      );
    }
  };

  return <ThemeContext.Provider value={{ theme, setTheme, isLoading }}>{children}</ThemeContext.Provider>;
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
