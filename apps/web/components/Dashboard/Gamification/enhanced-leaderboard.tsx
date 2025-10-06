'use client';

import { motion } from 'framer-motion';
import { Crown, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getRankTheme } from '@/lib/gamification';
import type { LeaderboardEntry } from '@/types/gamification';
import { cn } from '@/lib/utils';

interface EnhancedLeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: number;
  userRank?: number | null;
  className?: string;
}

/**
 * Enhanced Leaderboard with Context-Aware Positioning
 *
 * Improvements:
 * - Shows user's position with surrounding context
 * - Highlights rank changes (↑↓)
 * - Expandable to show full leaderboard
 * - Visual distinction for top 3
 * - "Distance to next rank" indicator
 */
export function EnhancedLeaderboard({
  entries,
  currentUserId,
  userRank,
  className
}: EnhancedLeaderboardProps) {
  const t = useTranslations('DashPage.UserAccountSettings.Gamification');
  const [showFull, setShowFull] = useState(false);

  const { displayEntries, currentUserEntry, rankContext } = useMemo(() => {
    const userEntry = entries.find(e => e.user_id === currentUserId);

    if (!userEntry || !userRank || showFull) {
      return {
        displayEntries: entries.slice(0, showFull ? undefined : 10),
        currentUserEntry: userEntry,
        rankContext: null,
      };
    }

    // Show top 3 + user's context (±2 ranks)
    const top3 = entries.slice(0, 3);
    const userRankIndex = userRank - 1;

    // Get surrounding context
    const contextStart = Math.max(3, userRankIndex - 2);
    const contextEnd = Math.min(entries.length, userRankIndex + 3);
    const contextEntries = entries.slice(contextStart, contextEnd);

    // Calculate XP to next rank
    const nextRankEntry = entries[userRankIndex - 1];
    const xpToNext = nextRankEntry ? nextRankEntry.total_xp - userEntry.total_xp : 0;

    return {
      displayEntries: userRank <= 3 ? top3 : [...top3, ...contextEntries],
      currentUserEntry: userEntry,
      rankContext: {
        rank: userRank,
        xpToNext,
        nextRankUsername: nextRankEntry?.username || null,
      },
    };
  }, [entries, currentUserId, userRank, showFull]);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-yellow-500" />
          {t('dashboard.leaderboard')}
        </CardTitle>
        {entries.length > 10 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFull(!showFull)}
            className="h-8 text-xs"
          >
            {showFull ? t('leaderboard.showLess') : t('leaderboard.showAll')}
            {showFull ? (
              <ChevronUp className="ml-1 h-3 w-3" />
            ) : (
              <ChevronDown className="ml-1 h-3 w-3" />
            )}
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* User's Rank Context */}
        {rankContext && !showFull && (
          <div className="rounded-lg bg-primary/5 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {t('leaderboard.yourPosition')}
              </span>
              <span className="font-bold">#{rankContext.rank}</span>
            </div>
            {rankContext.xpToNext > 0 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {t('leaderboard.xpToNextRank', {
                  xp: rankContext.xpToNext.toLocaleString(),
                  username: rankContext.nextRankUsername || '',
                })}
              </div>
            )}
          </div>
        )}

        {/* Leaderboard Entries */}
        <ScrollArea className={cn('pr-4', showFull ? 'h-[500px]' : 'h-[400px]')}>
          <div className="space-y-2">
            {displayEntries.map((entry, index) => {
              const rankTheme = getRankTheme(entry.rank);
              const isCurrentUser = entry.user_id === currentUserId;
              const isTop3 = entry.rank <= 3;

              // Show separator between top 3 and context
              const showSeparator = !showFull && index === 3 && userRank && userRank > 3;

              return (
                <div key={entry.user_id}>
                  {showSeparator && (
                    <div className="my-3 flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-px flex-1 bg-border" />
                      <span>...</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  <LeaderboardEntryRow
                    entry={entry}
                    isCurrentUser={isCurrentUser}
                    isTop3={isTop3}
                    rankTheme={rankTheme}
                  />
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

/**
 * Individual Leaderboard Entry Component
 */
function LeaderboardEntryRow({
  entry,
  isCurrentUser,
  isTop3,
  rankTheme,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  isTop3: boolean;
  rankTheme: ReturnType<typeof getRankTheme>;
}) {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className={cn(
        'flex items-center gap-3 rounded-lg p-3 transition-colors',
        isCurrentUser && 'bg-primary/10 ring-2 ring-primary/20',
        !isCurrentUser && 'hover:bg-muted/50'
      )}
    >
      {/* Rank Badge */}
      <div className="flex shrink-0 items-center justify-center">
        {isTop3 ? (
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Badge
              variant="secondary"
              className={cn(
                'h-8 w-8 justify-center rounded-full font-bold',
                rankTheme.color,
                'shadow-lg'
              )}
            >
              {entry.rank === 1 && <Crown className="h-4 w-4" />}
              {entry.rank > 1 && entry.rank}
            </Badge>
          </motion.div>
        ) : (
          <div className="flex h-8 w-8 items-center justify-center text-sm font-semibold text-muted-foreground">
            #{entry.rank}
          </div>
        )}
      </div>

      {/* Avatar */}
      <Avatar className="h-10 w-10">
        <AvatarImage src={entry.avatar_url || undefined} />
        <AvatarFallback>
          {entry.username?.slice(0, 2).toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'truncate font-semibold',
          isCurrentUser && 'text-primary'
        )}>
          {entry.username || 'Anonymous'}
          {isCurrentUser && (
            <span className="ml-2 text-xs text-muted-foreground">(You)</span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">
          Level {entry.level} • {entry.total_xp.toLocaleString()} XP
        </p>
      </div>

      {/* Rank Change Indicator */}
      {entry.rank_change !== undefined && entry.rank_change !== 0 && (
        <div className={cn(
          'flex items-center gap-1 text-xs font-semibold',
          entry.rank_change > 0 && 'text-green-500',
          entry.rank_change < 0 && 'text-red-500'
        )}>
          {entry.rank_change > 0 && (
            <>
              <TrendingUp className="h-3 w-3" />
              +{entry.rank_change}
            </>
          )}
          {entry.rank_change < 0 && (
            <>
              <TrendingDown className="h-3 w-3" />
              {entry.rank_change}
            </>
          )}
        </div>
      )}

      {entry.rank_change === 0 && (
        <Minus className="h-3 w-3 text-muted-foreground" />
      )}
    </motion.div>
  );
}
