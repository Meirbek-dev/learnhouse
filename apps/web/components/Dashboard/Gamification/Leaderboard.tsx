'use client';

import { AlertCircle, Award, Crown, Medal, RefreshCw, TrendingUp, Trophy, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequestBodyWithAuthHeader } from '@/services/utils/ts/requests';
import { getUserAvatarMediaDirectory } from '@/services/media/media';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import UserAvatar from '@/components/Objects/UserAvatar';
import { getAPIUrl } from '@/services/config/config';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';

interface LeaderboardEntry {
  rank: number;
  user_id: number;
  total_xp: number;
  current_level: number;
  current_login_streak: number;
  current_learning_streak: number;
  username?: string;
  avatar_image?: string;
  user_uuid?: string;
  first_name?: string;
  last_name?: string;
}

interface OrganizationLeaderboard {
  org_id: number;
  leaderboard_entries: LeaderboardEntry[];
  total_participants: number;
}

interface LeaderboardProps {
  orgId: number;
  className?: string;
  limit?: number;
  compact?: boolean;
}

export function Leaderboard({ orgId, className = '', limit = 10, compact = false }: LeaderboardProps) {
  const { data: session } = useSession();
  const [leaderboard, setLeaderboard] = useState<OrganizationLeaderboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchLeaderboard = useCallback(async () => {
    if (!session?.tokens?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10 second timeout

      const response = await fetch(`${getAPIUrl()}gamification/leaderboard/${orgId}?limit=${limit}`, {
        ...RequestBodyWithAuthHeader('GET', null, null, session.tokens.access_token),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Failed to fetch leaderboard: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      setLeaderboard(data);
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        console.error('Error fetching leaderboard:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  }, [orgId, limit, session?.tokens?.access_token]);

  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      setRetryCount((prev) => prev + 1);
      fetchLeaderboard();
    }
  }, [retryCount, fetchLeaderboard]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Memoized utility functions for performance
  const getRankIcon = useCallback((rank: number) => {
    switch (rank) {
      case 1: {
        return (
          <Crown
            className="h-5 w-5 text-yellow-500"
            aria-label="1st place"
          />
        );
      }
      case 2: {
        return (
          <Medal
            className="h-5 w-5 text-gray-400"
            aria-label="2nd place"
          />
        );
      }
      case 3: {
        return (
          <Award
            className="h-5 w-5 text-amber-600"
            aria-label="3rd place"
          />
        );
      }
      default: {
        return <span className="text-muted-foreground text-sm font-bold">#{rank}</span>;
      }
    }
  }, []);

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
    (userId: number) => {
      return session?.user?.id === userId;
    },
    [session?.user?.id],
  );

  // Memoized calculations
  const topEntries = useMemo(() => {
    return leaderboard?.leaderboard_entries.slice(0, limit) || [];
  }, [leaderboard, limit]);

  // Enhanced loading state with accessibility
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div
            className="space-y-3"
            role="status"
            aria-label="Loading leaderboard"
          >
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
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

  // Enhanced error state with retry functionality
  if (error || !leaderboard) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error || 'Failed to load leaderboard'}</span>
              {retryCount < 3 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetry}
                  className="ml-2"
                >
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Retry
                </Button>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Compact view with enhanced accessibility
  if (compact) {
    return (
      <TooltipProvider>
        <Card className={className}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="h-4 w-4" />
              Top Learners
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              className="space-y-2"
              role="list"
              aria-label="Top learners"
            >
              {topEntries.slice(0, 3).map((entry) => (
                <Tooltip key={entry.user_id}>
                  <TooltipTrigger asChild>
                    <div
                      role="listitem"
                      className={`flex cursor-help items-center gap-2 rounded-lg p-2 transition-colors ${
                        isCurrentUser(entry.user_id)
                          ? 'bg-primary/10 border-primary/20 border'
                          : 'bg-muted/50 hover:bg-muted/70'
                      }`}
                    >
                      <div className="flex items-center gap-1">{getRankIcon(entry.rank)}</div>
                      <UserAvatar
                        size="sm"
                        avatar_url={
                          entry.avatar_image && entry.user_uuid
                            ? getUserAvatarMediaDirectory(entry.user_uuid, entry.avatar_image)
                            : ''
                        }
                        predefined_avatar={entry.avatar_image ? undefined : 'empty'}
                        userId={entry.user_id}
                        username={entry.username}
                        fallbackText={
                          entry.first_name && entry.last_name
                            ? `${entry.first_name[0]}${entry.last_name[0]}`.toUpperCase()
                            : entry.username && entry.username.length > 0
                              ? entry.username[0]!.toUpperCase()
                              : getUserInitials(entry.user_id)
                        }
                        showProfilePopup
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                          {entry.username || `User ${entry.user_id}`}
                          {isCurrentUser(entry.user_id) && <span className="text-primary ml-1">(You)</span>}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="px-1 text-xs"
                      >
                        L{entry.current_level}
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {entry.username || `User ${entry.user_id}`}: Level {entry.current_level},{' '}
                      {entry.total_xp.toLocaleString()} XP
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

  // Full leaderboard view with enhanced UX
  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Leaderboard
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-muted-foreground flex cursor-help items-center gap-1 text-sm">
                  <Users className="h-4 w-4" />
                  {leaderboard.total_participants} learners
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Total active learners in your organization</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="space-y-3"
            role="list"
            aria-label="Leaderboard rankings"
          >
            {topEntries.map((entry, index) => (
              <Tooltip key={entry.user_id}>
                <TooltipTrigger asChild>
                  <div
                    role="listitem"
                    className={`flex cursor-help items-center gap-4 rounded-lg border p-4 transition-all duration-200 ${
                      isCurrentUser(entry.user_id)
                        ? 'bg-primary/10 border-primary/20 ring-primary/10 shadow-sm ring-1'
                        : 'hover:bg-muted/50 hover:shadow-sm'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex w-8 items-center justify-center">{getRankIcon(entry.rank)}</div>

                    {/* Avatar and User Info */}
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar
                        size="md"
                        avatar_url={
                          entry.avatar_image && entry.user_uuid
                            ? getUserAvatarMediaDirectory(entry.user_uuid, entry.avatar_image)
                            : ''
                        }
                        predefined_avatar={entry.avatar_image ? undefined : 'empty'}
                        userId={entry.user_id}
                        username={entry.username}
                        fallbackText={
                          entry.first_name && entry.last_name
                            ? `${entry.first_name[0]?.toUpperCase()}${entry.last_name[0]?.toUpperCase()}`
                            : entry.username && entry.username.length > 0
                              ? entry.username[0]?.toUpperCase()
                              : getUserInitials(entry.user_id)
                        }
                        showProfilePopup
                      />

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          <p className="truncate font-medium">{entry.username || `User ${entry.user_id}`}</p>
                          {isCurrentUser(entry.user_id) && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                            >
                              You
                            </Badge>
                          )}
                        </div>

                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Level {entry.current_level}
                          </span>
                          <span>{entry.total_xp.toLocaleString()} XP</span>
                        </div>
                      </div>
                    </div>

                    {/* Streaks */}
                    <div className="flex items-center gap-2">
                      {entry.current_login_streak > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-help text-xs"
                            >
                              🔥 {entry.current_login_streak}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Login streak: {entry.current_login_streak} days</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {entry.current_learning_streak > 0 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-help text-xs"
                            >
                              ⭐ {entry.current_learning_streak}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Learning streak: {entry.current_learning_streak} days</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Rank Badge */}
                    <Badge variant={getRankBadgeVariant(entry.rank)}>#{entry.rank}</Badge>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <p className="font-medium">{entry.username || `User ${entry.user_id}`}</p>
                    <p className="text-sm">
                      Rank #{entry.rank} • Level {entry.current_level}
                    </p>
                    <p className="text-sm">{entry.total_xp.toLocaleString()} XP earned</p>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {leaderboard.total_participants > limit && (
            <div className="mt-4 text-center">
              <p className="text-muted-foreground text-sm">
                Showing top {limit} of {leaderboard.total_participants} learners
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
