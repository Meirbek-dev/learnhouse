'use client';
import type { ReactNode } from 'react';

import { useIsMobile } from '@/hooks/useIsMobile';
import DashLeftMenu from '@components/Dashboard/Menus/DashLeftMenu';
import DashMobileMenu from '@components/Dashboard/Menus/DashMobileMenu';
import AdminAuthorization from '@components/Security/AdminAuthorization';

function ClientAdminLayout({ children, params }: { children: ReactNode; params: any }) {
  const isMobile = useIsMobile();

  return (
    <AdminAuthorization authorizationMode="page">
      <div className="flex flex-col md:flex-row">
        {isMobile ? <DashMobileMenu /> : <DashLeftMenu />}
        <div className="flex w-full">{children}</div>
      </div>
    </AdminAuthorization>
  );
}

export default ClientAdminLayout;
