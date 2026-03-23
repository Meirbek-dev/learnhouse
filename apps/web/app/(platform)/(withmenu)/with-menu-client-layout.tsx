'use client';

import { GamificationProvider } from '@/components/Contexts/GamificationContext';
import NavBar from '@/components/Objects/Menus/nav-menu';
import type { ReactNode } from 'react';

interface WithMenuClientLayoutProps {
  children: ReactNode;
}

export default function WithMenuClientLayout({ children }: WithMenuClientLayoutProps) {
  return (
    <GamificationProvider>
      <NavBar />
      <div className="h-[52px]" />
      {children}
    </GamificationProvider>
  );
}
