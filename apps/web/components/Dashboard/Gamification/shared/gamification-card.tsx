import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface GamificationCardProps {
  title: string;
  children: ReactNode;
  headerAction?: ReactNode;
  className?: string;
}

/**
 * Unified card wrapper for all gamification components
 * Provides consistent structure and styling
 */
export function GamificationCard({ title, children, headerAction, className }: GamificationCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle>{title}</CardTitle>
        {headerAction}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
