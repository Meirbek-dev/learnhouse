'use client';

import type { ReactNode } from 'react';

interface EditorShellProps {
  children: ReactNode;
}

export function EditorShell({ children }: EditorShellProps) {
  return (
    <div className="flex h-screen w-full flex-col bg-background">
      {children}
    </div>
  );
}
