'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { LeaderboardEntry } from '@/types/gamification';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { getRankIcon, getRankColor, getRankBgColor } from '@/lib/gamification/constants';

interface LeaderboardCardProps {
  entries: LeaderboardEntry[];
  currentUserId?: number;
  isLoading?: boolean;
}

export function LeaderboardCard({ entries, currentUserId, isLoading }: LeaderboardCardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.leaderboard')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3"
              >
                <Skeleton className="h-6 w-6" />
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.leaderboard')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-4 text-center">{t('dashboard.noLeaderboard')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.leaderboard')}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
