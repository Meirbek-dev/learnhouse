'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivitySquare, Lock } from 'lucide-react';

interface AnalyticsEmptyStateProps {
  title: string;
  description: string;
}

export default function AnalyticsEmptyState({ title, description }: AnalyticsEmptyStateProps) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center justify-center px-4 py-10">
      <Card className="border-slate-200 bg-linear-to-br from-white via-slate-50 to-emerald-50 shadow-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-md">
            <ActivitySquare className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="max-w-2xl text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-3 text-sm text-slate-500">
          <Lock className="h-4 w-4" />
          Analytics are shown only when the organization feature is enabled and the current user has analytics access.
        </CardContent>
      </Card>
    </div>
  );
}
