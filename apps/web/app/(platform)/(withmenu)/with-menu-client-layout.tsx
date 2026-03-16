'use client';

import OrgMenu from '@components/Objects/Menus/org-menu';
import type { ReactNode } from 'react';

interface WithMenuClientLayoutProps {
  children: ReactNode;
}

export default function WithMenuClientLayout({ children }: WithMenuClientLayoutProps) {
  return (
    <>
      <OrgMenu />
      <div className="h-[52px]" />
      {children}
    </>
  );
}
