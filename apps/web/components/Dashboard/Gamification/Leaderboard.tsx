'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import GamifiedUserAvatar from '@/components/Objects/GamifiedUserAvatar';
import type { OrganizationLeaderboard } from '@/types/gamification';
import { Trophy, Medal, Award, Crown, Search } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMemo, useState, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { LevelBadge } from './level-indicators';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';

interface LeaderboardProps {
  orgId: number;
  className?: string;
  limit?: number;
  compact?: boolean;
  data?: OrganizationLeaderboard | null;
  currentUserId?: number;
}

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'all-time';

export function Leaderboard({
  orgId,
  className = '',
  limit = 20,
  compact = false,
  data: serverData,
  currentUserId,
}: LeaderboardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('all-time');
  const leaderboard = serverData ?? null;

  const getRankIcon = useCallback(
    (rank: number) => {
      switch (rank) {
        case 1:
          return (
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <span className="text-yellow-500 font-bold">{t('leaderboard.gold')}</span>
            </div>
          );
        case 2:
          return (
            <div className="flex items-center gap-2">
              <Medal className="h-5 w-5 text-gray-400" />
              <span className="text-gray-400 font-bold">{t('leaderboard.silver')}</span>
            </div>
          );
        case 3:
          return (
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-600" />
              <span className="text-amber-600 font-bold">{t('leaderboard.bronze')}</span>
            </div>
          );
        default:
          return <span className="font-semibold text-muted-foreground">#{rank}</span>;
      }
    },
    [t],
  );

  const getRankBadgeVariant = useCallback((rank: number): 'default' | 'secondary' | 'outline' => {
    if (rank <= 3) return 'default';
    if (rank <= 10) return 'secondary';
    return 'outline';
  }, []);

  const isCurrentUser = useCallback(
    (userId: number) => currentUserId !== null && currentUserId === userId,
    [currentUserId],
  );

  // Filter and search entries
  const filteredEntries = useMemo(() => {
    if (!leaderboard?.entries) return [];

    let entries = leaderboard.entries;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      entries = entries.filter(
        (entry) => entry.username?.toLowerCase().includes(query) || entry.user_id.toString().includes(query),
      );
    }

    // Note: timeRange filter would need backend support
    // For now, we're showing all entries from the server

    return entries.slice(0, limit);
  }, [leaderboard, searchQuery, limit]);

  // Find current user's rank
  const currentUserEntry = useMemo(() => {
    if (!currentUserId || !leaderboard?.entries) return null;
    return leaderboard.entries.find((entry) => entry.user_id === currentUserId);
  }, [currentUserId, leaderboard]);

  // Loading state
  if (!leaderboard) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('leaderboard.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3"
              >
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-16" />
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
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              {t('leaderboard.title')}
            </div>
            {leaderboard.total_participants > 0 && (
              <Badge variant="secondary">
                {leaderboard.total_participants} {t('leaderboard.participants')}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredEntries.slice(0, 5).map((entry) => (
              <div
                key={entry.user_id}
                className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${
                  isCurrentUser(entry.user_id) ? 'bg-primary/10 ring-1 ring-primary/20' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2 w-12">
                  {entry.rank <= 3 ? (
                    <Trophy
                      className={`h-4 w-4 ${
                        entry.rank === 1 ? 'text-yellow-500' : entry.rank === 2 ? 'text-gray-400' : 'text-amber-600'
                      }`}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">#{entry.rank}</span>
                  )}
                </div>

                <GamifiedUserAvatar
                  size="sm"
                  userId={entry.user_id}
                  username={entry.username || undefined}
                  avatar_url={entry.avatar_url || undefined}
                  showLevelIndicator
                  showLevelBadge={false}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.username || t('leaderboard.user', { id: entry.user_id })}</p>
                  <p className="text-xs text-muted-foreground">{t('leaderboard.level')} {entry.level}</p>
                </div>

                <div className="text-right">
                  <p className="text-sm font-semibold">{entry.total_xp.toLocaleString()} XP</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full leaderboard view with filters
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            {t('leaderboard.title')}
          </div>
          {leaderboard.total_participants > 0 && (
            <Badge variant="secondary">
              {leaderboard.total_participants} {t('leaderboard.participants')}
            </Badge>
          )}
        </CardTitle>

        {/* Filters */}
        <div className="flex gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('leaderboard.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t('leaderboard.daily')}</SelectItem>
              <SelectItem value="weekly">{t('leaderboard.weekly')}</SelectItem>
              <SelectItem value="monthly">{t('leaderboard.monthly')}</SelectItem>
              <SelectItem value="all-time">{t('leaderboard.allTime')}</SelectItem>
            </SelectContent>
          </Select> */}
        </div>
      </CardHeader>

      <CardContent>
        {/* My Rank Header (Sticky) */}
        {currentUserEntry && (
          <div className="mb-4 rounded-lg border-2 border-primary bg-primary/5 p-3 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Badge
                variant="default"
                className="shrink-0"
              >
                {t('leaderboard.yourRank')}: #{currentUserEntry.rank}
              </Badge>

              <GamifiedUserAvatar
                size="md"
                userId={currentUserEntry.user_id}
                username={currentUserEntry.username || undefined}
                avatar_url={currentUserEntry.avatar_url || undefined}
                use_with_session
                showLevelIndicator
              />

              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">
                  {currentUserEntry.username || t('leaderboard.user', { id: currentUserEntry.user_id })}
                </p>
                <div className="flex items-center gap-2">
                  <LevelBadge
                    level={currentUserEntry.level}
                    size="sm"
                  />
                  <span className="text-sm text-muted-foreground">{currentUserEntry.total_xp.toLocaleString()} XP</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {filteredEntries.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {searchQuery ? t('leaderboard.noResults') : t('leaderboard.noEntries')}
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-4 rounded-lg border p-4 transition-all ${
                    isCurrentUser(entry.user_id)
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center w-20 shrink-0">{getRankIcon(entry.rank)}</div>

                  {/* Avatar */}
                  <GamifiedUserAvatar
                    size="lg"
                    userId={entry.user_id}
                    username={entry.username || undefined}
                    avatar_url={entry.avatar_url || undefined}
                    showLevelIndicator
                    showLevelBadge={false}
                    showProfilePopup
                  />

                  {/* User Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{entry.username || t('leaderboard.user', { id: entry.user_id })}</p>
                      {isCurrentUser(entry.user_id) && (
                        <Badge
                          variant="secondary"
                          className="shrink-0"
                        >
                          {t('leaderboard.you')}
                        </Badge>
                      )}
                      {entry.rank <= 3 && <Crown className="h-4 w-4 text-yellow-500 shrink-0" />}
                    </div>

                    <div className="flex items-center gap-2 mt-1">
                      <LevelBadge
                        level={entry.level}
                        size="sm"
                        showIcon={false}
                      />
                      {entry.rank_change && entry.rank_change !== 0 && (
                        <Badge
                          variant={entry.rank_change > 0 ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {entry.rank_change > 0 ? '↑' : '↓'} {Math.abs(entry.rank_change)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* XP */}
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold">{entry.total_xp.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">XP</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
