'use client';

import { useTheme } from '@/components/providers/theme-provider';
import { OrgProvider } from '@components/Contexts/OrgContext';
import { Toaster } from '@/components/ui/sonner';
import NextTopLoader from 'nextjs-toploader';
import type { ReactNode } from 'react';

interface OrgClientProvidersProps {
  children: ReactNode;
  orgslug: string;
}

export default function OrgClientProviders({ children, orgslug }: OrgClientProvidersProps) {
  const { theme: currentTheme } = useTheme();

  // NextTopLoader props
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
    <OrgProvider orgslug={orgslug}>
      <NextTopLoader {...topLoaderProps} />
      <Toaster />
      {children}
    </OrgProvider>
  );
}
