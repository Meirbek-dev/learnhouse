'use client';

import Toast from '@components/Objects/StyledElements/Toast/Toast';
import { OrgProvider } from '@components/Contexts/OrgContext';
import NextTopLoader from 'nextjs-toploader';
import type { ReactNode } from 'react';

interface OrgClientProvidersProps {
  children: ReactNode;
  orgslug: string;
}

export default function OrgClientProviders({ children, orgslug }: OrgClientProvidersProps) {
  return (
    <OrgProvider orgslug={orgslug}>
      <NextTopLoader
        color="#2b75ee"
        initialPosition={0.1}
        crawlSpeed={300}
        height={2}
        easing="ease"
        speed={1000}
        showSpinner={false}
        shadow="0 0 10px #2b75ee, 0 0 5px #2b75ee"
        crawl
      />
      <Toast />
      {children}
    </OrgProvider>
  );
}
