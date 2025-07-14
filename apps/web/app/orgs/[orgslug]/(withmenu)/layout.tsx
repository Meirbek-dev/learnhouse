'use client';

import OrgMenu from '@components/Objects/Menus/org-menu';
import '@styles/globals.css';
import { Children, cloneElement, use } from 'react';

export default function RootLayout(props: { children: React.ReactNode; params: Promise<any> }) {
  const params = use(props.params);
  const { children } = props;

  return (
    <>
      <OrgMenu
        key={`${params?.orgslug}-orgmenu`}
        orgslug={params?.orgslug}
      />
      {/* Spacer for fixed header */}
      <div className="h-[52px]" />
      {Children.map(children, (child, index) =>
        cloneElement(child as React.ReactElement, {
          key: `${params.orgslug}-child-${index}`,
        }),
      )}
    </>
  );
}
