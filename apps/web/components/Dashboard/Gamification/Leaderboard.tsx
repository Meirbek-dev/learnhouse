
'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Award, Crown, Medal, TrendingUp, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCallback, useMemo } from 'react';
import UserAvatar from '@/components/Objects/UserAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import type { OrganizationLeaderboard } from '@/types/gamification';

interface LeaderboardProps {
  orgId: number;
  className?: string;
  limit?: number;
  compact?: boolean;
  data?: OrganizationLeaderboard | null;
  currentUserId?: number;
}

export function Leaderboard({
  orgId,
  className = '',
  limit = 20,
  compact = false,
  data: serverData,
  currentUserId,
}: LeaderboardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const leaderboard = serverData ?? null;

  const getRankIcon = useCallback(
    (rank: number) => {
      switch (rank) {
        case 1: {
          return (
            <Crown
              className="h-5 w-5 text-yellow-500"
              aria-label={t('leaderboard.ranks.first')}
            />
          );
        }
        case 2: {
          return (
            <Medal
              className="h-5 w-5 text-gray-400"
              aria-label={t('leaderboard.ranks.second')}
            />
          );
        }
        case 3: {
          return (
            <Award
              className="h-5 w-5 text-amber-600"
              aria-label={t('leaderboard.ranks.third')}
            />
          );
        }
        default: {
          return <span className="text-muted-foreground text-sm font-bold">#{rank}</span>;
        }
      }
    },
    [t],
  );

  const getRankBadgeVariant = useCallback((rank: number): 'default' | 'secondary' | 'outline' => {
    switch (rank) {
      case 1: {
        return 'default';
      }
      case 2: {
        return 'secondary';
      }
      case 3: {
        return 'outline';
      }
      default: {
        return 'outline';
      }
    }
  }, []);

  const getUserInitials = useCallback((userId: number) => {
    // Generate consistent initials based on user ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const first = chars[userId % chars.length];
    const second = chars[(userId * 7) % chars.length];
    return `${first}${second}`;
  }, []);

  const isCurrentUser = useCallback(
    (userId: number) => currentUserId != null && currentUserId === userId,
    [currentUserId],
  );

  const topEntries = useMemo(() => {
    return leaderboard?.entries.slice(0, limit) || [];
  }, [leaderboard, limit]);

  // Loading state
  if (!leaderboard) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3" role="status" aria-label={t('leaderboard.loading')}>
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Compact view
  if (compact) {
    return (
      <TooltipProvider>
        <Card className={className}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              {t('leaderboard.topLearners')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className="space-y-2"
              role="list"
              aria-label={t('leaderboard.topLearners')}
            >
              {topEntries.slice(0, 10).map((entry) => (
                <Tooltip key={entry.user_id}>
                  <TooltipTrigger asChild>
                    <div
                      role="listitem"
                      className={`flex cursor-help items-center gap-2 rounded-lg p-2 transition-colors ${
                        isCurrentUser(entry.user_id)
                          ? 'border-primary/20 bg-primary/10 border'
                          : 'bg-muted/50 hover:bg-muted/70'
                      }`}
                    >
                      <div className="flex items-center gap-1">{getRankIcon(entry.rank)}</div>
                      <UserAvatar
                        size="sm"
                        userId={entry.user_id}
                        username={entry.username ?? undefined}
                        predefined_avatar="empty"
                        fallbackText={(entry.username?.[0] || getUserInitials(entry.user_id)).toUpperCase()}
                        showProfilePopup
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {entry.username || t('leaderboard.user', { id: entry.user_id })}
                          {isCurrentUser(entry.user_id) && (
                            <span className="text-primary ml-1">{t('leaderboard.you')}</span>
                          )}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="px-1 text-xs"
                      >
                        {t('leaderboard.levelShort', { level: entry.current_level })}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {t('leaderboard.tooltipUser', {
                        user: entry.username || t('leaderboard.user', { id: entry.user_id }),
                        level: entry.current_level,
                        xp: entry.total_xp.toLocaleString(),
                      })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </CardContent>
        </Card>
      </TooltipProvider>
    );
  }

  // Full leaderboard view
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {t('leaderboard.title')}
            </div>
            {/* Total participants removed from simplified leaderboard contract */}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="space-y-3"
            role="list"
            aria-label={t('leaderboard.aria.rankings')}
          >
            {topEntries.map((entry, index) => (
              <Tooltip key={entry.user_id}>
                <TooltipTrigger asChild>
                  <div
                    role="listitem"
                    className={`flex cursor-help items-center gap-4 rounded-lg border p-4 transition-all duration-200 ${
                      isCurrentUser(entry.user_id)
                        ? 'border-primary/20 bg-primary/10 ring-primary/10 shadow-sm ring-1'
                        : 'hover:bg-muted/50 hover:shadow-sm'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex w-8 items-center justify-center">{getRankIcon(entry.rank)}</div>

                    {/* Avatar and User Info */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar
                        size="md"
                        userId={entry.user_id}
                        username={entry.username ?? undefined}
                        predefined_avatar="empty"
                        fallbackText={(entry.username?.[0] || getUserInitials(entry.user_id)).toUpperCase()}
                        showProfilePopup
                      />

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="truncate font-medium">
                            {entry.username || t('leaderboard.user', { id: entry.user_id })}
                          </p>
                          {isCurrentUser(entry.user_id) && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                            >
                              {t('leaderboard.you')}
                            </Badge>
                          )}
                        </div>

                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {t('leaderboard.levelLabel', { level: entry.current_level })}
                          </span>
                          <span>{t('leaderboard.xp', { xp: entry.total_xp.toLocaleString() })}</span>
                        </div>
                      </div>
                    </div>

                    {/* Streaks intentionally omitted in compact contract; use streak summary endpoint if needed */}

                    {/* Rank Badge */}
                    <Badge variant={getRankBadgeVariant(entry.rank)}>#{entry.rank}</Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <p className="font-medium">{entry.username || t('leaderboard.user', { id: entry.user_id })}</p>
                    <p className="text-sm">
                      {t('leaderboard.rankLevel', { rank: entry.rank, level: entry.current_level })}
                    </p>
                    <p className="text-sm">{t('leaderboard.xpEarned', { xp: entry.total_xp.toLocaleString() })}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Pagination / total participants messaging removed with simplified data */}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
