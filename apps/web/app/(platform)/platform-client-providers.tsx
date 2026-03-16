'use client';

import PlatformOrgProvider from '@components/Contexts/PlatformOrgProvider';
import { useTheme } from '@/components/providers/theme-provider';
import NextTopLoader from 'nextjs-toploader';
import type { ReactNode } from 'react';

interface PlatformClientProvidersProps {
  children: ReactNode;
  initialOrg?: unknown;
}

export default function PlatformClientProviders({ children, initialOrg }: PlatformClientProvidersProps) {
  const { theme: currentTheme } = useTheme();

  const topLoaderProps = {
    color: currentTheme.colors.primary,
    initialPosition: 0.1,
    crawlSpeed: 300,
    height: 3,
    easing: 'ease' as const,
    speed: 1000,
    showSpinner: false,
    shadow: `0 0 10px ${currentTheme.colors.primary}, 0 0 5px ${currentTheme.colors.primary}`,
    crawl: true,
  };

  return (
    <PlatformOrgProvider initialOrg={initialOrg}>
      <NextTopLoader {...topLoaderProps} />
      {children}
    </PlatformOrgProvider>
  );
}
