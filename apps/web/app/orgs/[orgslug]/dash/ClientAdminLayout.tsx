'use client';
import DashMobileMenu from '@components/Dashboard/Menus/DashMobileMenu';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import DashSidebar from '@components/Dashboard/Menus/DashSidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ReactNode } from 'react';

const ClientAdminLayout = ({ children, params }: { children: ReactNode; params: any }) => {
  const isMobile = useIsMobile();

  return (
    <>
      {isMobile ? (
        <div className="flex flex-col">
          <DashMobileMenu />
          <div className="flex w-full">{children}</div>
        </div>
      ) : (
        <SidebarProvider>
          <DashSidebar className="z-50" />
          <SidebarInset className="bg-background/30 flex-1">{children}</SidebarInset>
        </SidebarProvider>
      )}
    </>
  );
};

export default ClientAdminLayout;
