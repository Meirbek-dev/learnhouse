'use client';
import AdminAuthorization from '@components/Security/AdminAuthorization';
import DashMobileMenu from '@components/Dashboard/Menus/DashMobileMenu';
import DashLeftMenu from '@components/Dashboard/Menus/DashLeftMenu';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { ReactNode } from 'react';

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
