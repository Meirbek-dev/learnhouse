'use client';

import { applyTheme, defaultTheme, getStoredTheme, getTheme } from '@/lib/themes';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Theme } from '@/lib/themes';
import type { ReactNode } from 'react';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (themeName: string) => void;
  isLoading: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultThemeName?: string;
}

export function ThemeProvider({ children, defaultThemeName = 'default' }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = getStoredTheme();
    const initialTheme = storedTheme ? getTheme(storedTheme) : getTheme(defaultThemeName);

    setThemeState(initialTheme);
    applyTheme(initialTheme);
    setIsLoading(false);
  }, [defaultThemeName]);

  const setTheme = (themeName: string) => {
    const newTheme = getTheme(themeName);
    setThemeState(newTheme);
    applyTheme(newTheme);
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
