'use client';

import OrgMenu from '@components/Objects/Menus/org-menu';
import type { ReactElement, ReactNode } from 'react';
import { Children, cloneElement } from 'react';

interface WithMenuClientLayoutProps {
  children: ReactNode;
  orgslug: string;
}

/**
 * With Menu Client Layout
 *
 * Global layout for pages with menu. Does NOT include GamificationProvider
 * to avoid unnecessary API calls and infinite retry loops.
 *
 * Gamification should be added per-page basis where needed, with proper
 * server-side data fetching and error boundaries.
 */
export default function WithMenuClientLayout({ children, orgslug }: WithMenuClientLayoutProps) {
  return (
    <>
      <OrgMenu
        key={`${orgslug}-orgmenu`}
        orgslug={orgslug}
      />
      {/* Spacer for fixed header */}
      <div className="h-[52px]" />
      {Children.map(children, (child, index) =>
        cloneElement(child as ReactElement, {
          key: `${orgslug}-child-${index}`,
        }),
      )}
    </>
  );
}
