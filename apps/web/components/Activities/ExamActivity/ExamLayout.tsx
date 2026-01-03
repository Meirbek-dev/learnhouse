'use client';

import React from 'react';

interface ExamLayoutProps {
  title?: string;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export default function ExamLayout({
  title,
  children,
  sidebar,
}: ExamLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>{title && <h1 className="text-xl leading-tight font-semibold">{title}</h1>}</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,320px]">
        <main>{children}</main>

        <aside className="hidden lg:block">{sidebar}</aside>
      </div>
    </div>
  );
}
