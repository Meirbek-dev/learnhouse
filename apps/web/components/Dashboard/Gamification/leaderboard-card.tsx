'use client';

import { GamificationCard, getRankTheme, LoadingState, EmptyState, CardTrendIndicator } from '@/lib/gamification';
import { animations } from '@/lib/gamification/design-tokens';
import type { LeaderboardEntry } from '@/types/gamification';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface LeaderboardCardProps {
  entries: LeaderboardEntry[];
  currentUserId?: number;
  isLoading?: boolean;
}

export function LeaderboardCard({ entries, currentUserId, isLoading }: LeaderboardCardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');

  if (isLoading) {
    return (
      <LoadingState
        title={t('dashboard.leaderboard')}
        variant="list"
        itemCount={5}
      />
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        title={t('dashboard.leaderboard')}
        message={t('dashboard.noLeaderboard')}
        variant="info"
      />
    );
  }

  return (
    <GamificationCard title={t('dashboard.leaderboard')}>
      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {entries.map((entry, index) => {
            const rankTheme = getRankTheme(entry.rank);
            const isCurrentUser = entry.user_id === currentUserId;

            return (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: index * 0.05,
                  duration: animations.duration.normal / 1000,
                }}
                className={cn(
                  'flex items-center gap-3 m-2 rounded-lg p-3 transition-all',
                  animations.css.fast,
                  isCurrentUser && 'bg-primary/10 ring-2 ring-primary/30 shadow-sm',
                  !isCurrentUser && 'hover:bg-muted/70 hover:scale-[1.02]',
                )}
              >
                {/* Rank with badge */}
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    rankTheme.badge && rankTheme.bgColor,
                  )}
                >
                  {rankTheme.badge ? (
                    <rankTheme.icon className={cn('h-4 w-4', rankTheme.color)} />
                  ) : (
                    <span className="text-sm font-semibold text-muted-foreground">{entry.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
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
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{entry.username}</p>
                    {isCurrentUser && (
                      <Badge
                        variant="outline"
                        className="text-xs"
                      >
                        {t('leaderboard.you')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{t('leaderboard.level', { level: entry.level })}</p>
                </div>

                {/* XP and Trend */}
                <div className="flex shrink-0 items-center gap-2 text-right">
                  <div>
                    <p className="text-sm font-bold tabular-nums">{entry.total_xp.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">XP</p>
                  </div>
                  {entry.rank_change !== undefined && entry.rank_change !== 0 && (
                    <CardTrendIndicator
                      value={-entry.rank_change}
                      size="sm"
                      showIcon
                    />
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </GamificationCard>
  );
}
