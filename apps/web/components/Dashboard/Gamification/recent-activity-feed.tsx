'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import type { XPTransaction } from '@/types/gamification';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { getXPSourceIcon, getXPSourceColor } from '@/lib/gamification/constants';

interface RecentActivityFeedProps {
  transactions: XPTransaction[];
  isLoading?: boolean;
}

export function RecentActivityFeed({ transactions, isLoading }: RecentActivityFeedProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const locale = useDateFnsLocale();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3"
              >
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4 text-center">{t('dashboard.noActivity')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {transactions.map((transaction) => {
              const IconComponent = getXPSourceIcon(transaction.source);
              const iconColor = getXPSourceColor(transaction.source);
              const timeAgo = transaction.created_at
                ? formatDistanceToNow(new Date(transaction.created_at), {
                    addSuffix: true,
                    locale,
                  })
                : '';

              return (
                <div
                  key={transaction.id}
                  className="flex items-start gap-3"
                >
                  <div className="bg-primary/10 rounded-full p-2">
                    <IconComponent className={`h-4 w-4 ${iconColor}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t(`xpSources.${transaction.source}` as any)}</p>
                    <p className="text-muted-foreground text-xs">{timeAgo}</p>
                  </div>
                  <div className="shrink-0">
                    <span className="text-primary text-sm font-bold">+{transaction.amount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
