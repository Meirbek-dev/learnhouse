'use client';

import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import type { XPTransaction } from '@/types/gamification';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { useTranslations } from 'next-intl';
import { getXPSourceIcon, getXPSourceColor } from '@/lib/gamification/constants';
import { ActivityFeedSkeleton } from './shared/loading-states';
import { EmptyActivity } from './shared/empty-states';
import { GamificationCard } from './shared/gamification-card';

interface RecentActivityFeedProps {
  transactions: XPTransaction[];
  isLoading?: boolean;
}

export function RecentActivityFeed({ transactions, isLoading }: RecentActivityFeedProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const locale = useDateFnsLocale();

  if (isLoading) return <ActivityFeedSkeleton title={t('dashboard.recentActivity')} itemCount={5} />;
  if (!transactions || transactions.length === 0) {
    return <EmptyActivity title={t('dashboard.recentActivity')} message={t('dashboard.noActivity')} />;
  }

  return (
    <GamificationCard title={t('dashboard.recentActivity')}>
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
    </GamificationCard>
  );
}
