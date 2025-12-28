'use client';

import ExamTimer from './ExamTimer';
import React from 'react';

interface ExamLayoutProps {
  title?: string;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  startedAt?: string;
  timeLimitMinutes?: number | null;
  onExpire?: (reason?: string) => void;
}

export default function ExamLayout({
  title,
  children,
  sidebar,
  startedAt,
  timeLimitMinutes,
  onExpire,
}: ExamLayoutProps) {
  return (
    <div className="mx-auto max-w-7xl p-4">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>{title && <h1 className="text-xl leading-tight font-semibold">{title}</h1>}</div>
        <div className="flex items-center gap-3">
          <ExamTimer
            startedAt={startedAt ?? ''}
            timeLimitMinutes={timeLimitMinutes ?? null}
            onExpire={onExpire}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr,320px]">
        <main>{children}</main>

        <aside className="hidden lg:block">{sidebar}</aside>
      </div>
    </div>
  );
}
