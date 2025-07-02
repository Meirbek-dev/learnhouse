'use client';

import { OrgMenu } from '@components/Objects/Menus/OrgMenu';
import { Children, cloneElement, use } from 'react';
import '@styles/globals.css';

export default function RootLayout(props: { children: React.ReactNode; params: Promise<any> }) {
  const params = use(props.params);
  const { children } = props;

  return (
    <>
      <OrgMenu
        key={`${params?.orgslug}-orgmenu`}
        orgslug={params?.orgslug}
      />
      {Children.map(children, (child, index) =>
        cloneElement(child as React.ReactElement, {
          key: `${params.orgslug}-child-${index}`,
        }),
      )}
    </>
  );
}
