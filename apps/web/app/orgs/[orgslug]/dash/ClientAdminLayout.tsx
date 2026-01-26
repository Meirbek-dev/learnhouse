'use client';

import DashMobileMenu from '@components/Dashboard/Menus/DashMobileMenu';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import DashSidebar from '@components/Dashboard/Menus/DashSidebar';
import type { ReactNode } from 'react';

/**
 * Dashboard layout with CSS-based responsive design.
 *
 * Uses CSS visibility instead of JS-based conditional rendering to:
 * 1. Avoid hydration mismatches between SSR and client
 * 2. Provide instant layout switching without re-render flicker
 * 3. Allow CSS to handle breakpoints natively
 */
const ClientAdminLayout = ({ children, params }: { children: ReactNode; params: any }) => {
  return (
    <>
      {/* Mobile layout - hidden on md+ screens */}
      <div className="flex flex-col md:hidden">
        <DashMobileMenu />
        <div className="flex w-full">{children}</div>
      </div>

      {/* Desktop layout - hidden on mobile */}
      <div className="hidden md:contents">
        <SidebarProvider>
          <DashSidebar className="z-50" />
          <SidebarInset className="bg-background/30 flex-1">{children}</SidebarInset>
        </SidebarProvider>
      </div>
    </>
  );
};

export default ClientAdminLayout;
