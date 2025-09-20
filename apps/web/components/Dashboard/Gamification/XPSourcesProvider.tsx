'use client';
import React, { createContext, useContext, useMemo } from 'react';
import { useXPSources } from '@/hooks/useXPSources';

interface XPSourcesContextValue {
  map: Record<string, any> | null;
  isLoading: boolean;
  error: string | null;
  getLabel: (key: string) => string;
}

const XPSourcesContext = createContext<XPSourcesContextValue | undefined>(undefined);

export const XPSourcesProvider = ({ children }: { children: React.ReactNode }) => {
  const { map, isLoading, error } = useXPSources(true);

  const value = useMemo<XPSourcesContextValue>(
    () => ({
      map,
      isLoading,
      error,
      getLabel: (key: string) => {
        const label = map?.[key]?.label;
        if (label) return label;
        return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
      },
    }),
    [map, isLoading, error],
  );

  return <XPSourcesContext.Provider value={value}>{children}</XPSourcesContext.Provider>;
};

export function useXPSourcesContext() {
  const ctx = useContext(XPSourcesContext);
  if (!ctx) {
    throw new Error('useXPSourcesContext must be used within XPSourcesProvider');
  }
  return ctx;
}

// Optional variant that doesn't throw when the provider isn't mounted.
// Useful for components that can operate with graceful fallbacks.
export function useOptionalXPSourcesContext() {
  return useContext(XPSourcesContext);
}

export default XPSourcesProvider;
