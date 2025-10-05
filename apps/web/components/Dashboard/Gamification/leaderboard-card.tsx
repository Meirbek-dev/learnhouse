'use client';

import type { LeaderboardEntry } from '@/types/gamification';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { getRankIcon, getRankColor, getRankBgColor } from '@/lib/gamification/constants';
import { LeaderboardSkeleton } from './shared/loading-states';
import { EmptyLeaderboard } from './shared/empty-states';
import { GamificationCard } from './shared/gamification-card';

interface LeaderboardCardProps {
  entries: LeaderboardEntry[];
  currentUserId?: number;
  isLoading?: boolean;
}

export function LeaderboardCard({ entries, currentUserId, isLoading }: LeaderboardCardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  if (isLoading) return <LeaderboardSkeleton title={t('dashboard.leaderboard')} itemCount={5} />;
  if (!entries || entries.length === 0) {
    return <EmptyLeaderboard title={t('dashboard.leaderboard')} message={t('dashboard.noLeaderboard')} />;
  }

  return (
    <GamificationCard title={t('dashboard.leaderboard')}>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {entries.map((entry) => {
            const RankIcon = getRankIcon(entry.rank);
            const rankColor = getRankColor(entry.rank);
            const rankBgColor = getRankBgColor(entry.rank);
            const isCurrentUser = entry.user_id === currentUserId;

            return (
              <div
                key={entry.user_id}
                className={cn(
                  'flex items-center gap-3 rounded-lg p-2 transition-colors',
                  isCurrentUser && 'bg-primary/5 ring-1 ring-primary/20',
                )}
              >
                {/* Rank */}
                <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full', RankIcon && rankBgColor)}>
                  {RankIcon ? (
                    <RankIcon className={cn('h-4 w-4', rankColor)} />
                  ) : (
                    <span className="text-muted-foreground text-sm font-medium">{entry.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="bg-muted relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  {entry.avatar_url && (
                    <Image
                      src={entry.avatar_url}
                      alt={entry.username || ''}
                      fill
                      className="object-cover"
                    />
                  )}
                </div>

                {/* User Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {entry.username}
                    {isCurrentUser && (
                      <Badge
                        variant="outline"
                        className="ml-2"
                      >
                        {t('leaderboard.you')}
                      </Badge>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">{t('leaderboard.level', { level: entry.level })}</p>
                </div>

                {/* XP */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold">{entry.total_xp.toLocaleString()}</p>
                  <p className="text-muted-foreground text-xs">XP</p>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </GamificationCard>
  );
}
