'use client';

import { GamificationProvider } from '@/components/Contexts/GamificationContext';
import { LoginBonusHandler } from './_components/LoginBonusHandler';
import OrgMenu from '@components/Objects/Menus/org-menu';
import { useOrg } from '@components/Contexts/OrgContext';
import type { ReactElement, ReactNode } from 'react';
import { Children, cloneElement } from 'react';

interface WithMenuClientLayoutProps {
  children: ReactNode;
  orgslug: string;
}

export default function WithMenuClientLayout({ children, orgslug }: WithMenuClientLayoutProps) {
  const org = useOrg() as any;
  return (
    <>
      <OrgMenu
        key={`${orgslug}-orgmenu`}
        orgslug={orgslug}
      />
      {/* Spacer for fixed header */}
      <div className="h-[52px]" />
      {org?.id ? (
        <GamificationProvider orgId={org.id}>
          <LoginBonusHandler orgId={org.id} />
          {Children.map(children, (child, index) =>
            cloneElement(child as ReactElement, {
              key: `${orgslug}-child-${index}`,
            }),
          )}
        </GamificationProvider>
      ) : (
        Children.map(children, (child, index) =>
          cloneElement(child as ReactElement, {
            key: `${orgslug}-child-${index}`,
          }),
        )
      )}
    </>
  );
}
