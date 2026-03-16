'use client';

import { PlatformOrgContextProvider } from '@components/Contexts/OrgContext';
import type { ReactNode } from 'react';

export default function PlatformOrgProvider({ children, initialOrg }: { children: ReactNode; initialOrg?: unknown }) {
  return <PlatformOrgContextProvider initialOrg={initialOrg}>{children}</PlatformOrgContextProvider>;
}
