'use client';

import OrgMenu from '@components/Objects/Menus/org-menu';
import { PLATFORM_ORG_SLUG } from '@services/config/config';
import type { ReactNode } from 'react';

interface WithMenuClientLayoutProps {
  children: ReactNode;
}

export default function WithMenuClientLayout({ children }: WithMenuClientLayoutProps) {
  return (
    <>
      <OrgMenu orgslug={PLATFORM_ORG_SLUG} />
      <div className="h-[52px]" />
      {children}
    </>
  );
}
