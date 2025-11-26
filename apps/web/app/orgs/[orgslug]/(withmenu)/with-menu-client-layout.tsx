'use client';

import OrgMenu from '@components/Objects/Menus/org-menu';
import type { ReactNode } from 'react';

interface WithMenuClientLayoutProps {
  children: ReactNode;
  orgslug: string;
}

/**
 * With Menu Client Layout
 *
 * This must remain a client component because OrgMenu uses client-side hooks
 * (useState, useEffect, useSyncExternalStore) for menu state, scroll detection,
 * focus mode from localStorage, and event listeners.
 *
 * Gamification should be added per-page basis where needed, with proper
 * server-side data fetching and error boundaries.
 */
export default function WithMenuClientLayout({ children, orgslug }: WithMenuClientLayoutProps) {
  return (
    <>
      <OrgMenu orgslug={orgslug} />
      {/* Spacer for fixed header */}
      <div className="h-[52px]" />
      {children}
    </>
  );
}
