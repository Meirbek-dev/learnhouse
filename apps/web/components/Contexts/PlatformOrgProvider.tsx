'use client';

import { OrgProvider } from '@components/Contexts/OrgContext';
import { PLATFORM_ORG_SLUG } from '@services/config/config';
import type { ReactNode } from 'react';

export default function PlatformOrgProvider({ children, initialOrg }: { children: ReactNode; initialOrg?: unknown }) {
  return (
    <OrgProvider
      orgslug={PLATFORM_ORG_SLUG}
      initialOrg={initialOrg}
    >
      {children}
    </OrgProvider>
  );
}
