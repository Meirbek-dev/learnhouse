'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, Calendar, Flame, RefreshCw, Star, Trophy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RequestBodyWithAuthHeader } from '@/services/utils/ts/requests';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getAPIUrl } from '@/services/config/config';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';

interface GamificationProfile {
  current_login_streak: number;
  longest_login_streak: number;
  current_learning_streak: number;
  longest_learning_streak: number;
  last_login_date: string | null;
  last_learning_activity_date: string | null;
}

interface StreakWidgetProps {
  orgId: number;
  className?: string;
  compact?: boolean;
}

export function StreakWidget({ orgId, className = '', compact = false }: StreakWidgetProps) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<GamificationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!session?.tokens?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10 second timeout

      const response = await fetch(`${getAPIUrl()}gamification/profile/${orgId}`, {
        ...RequestBodyWithAuthHeader('GET', null, null, session.tokens.access_token),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error(`Failed to fetch profile: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        console.error('Error fetching gamification profile:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  }, [orgId, session?.tokens?.access_token]);

  const handleRetry = useCallback(() => {
    if (retryCount < 3) {
      setRetryCount((prev) => prev + 1);
      fetchProfile();
    }
  }, [retryCount, fetchProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Memoized utility functions for performance
  const getStreakStatus = useCallback((lastActivityDate: string | null) => {
    if (!lastActivityDate) return 'none';

    const lastDate = new Date(lastActivityDate);
    const today = new Date();
    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0 || diffDays === 1) return 'active';
    if (diffDays === 2) return 'at-risk';
    return 'broken';
  }, []);

  const getStreakBadgeVariant = useCallback((status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'active': {
        return 'default';
      }
      case 'at-risk': {
        return 'secondary';
      }
      case 'broken': {
        return 'destructive';
      }
      default: {
        return 'outline';
      }
    }
  }, []);

  const getStreakMessage = useCallback((streak: number, status: string, type: 'login' | 'learning') => {
    if (status === 'active' && streak > 0) {
      return `${streak} day${streak > 1 ? 's' : ''} strong! 🔥`;
    }
    if (status === 'at-risk') {
      return `Don't break your streak! ${type === 'login' ? 'Log in' : 'Complete an activity'} today.`;
    }
    if (status === 'broken' || streak === 0) {
      return `Start your ${type} streak today!`;
    }
    return '';
  }, []);

  // Memoized calculations
  const streakData = useMemo(() => {
    if (!profile) return null;

    return {
      loginStatus: getStreakStatus(profile.last_login_date),
      learningStatus: getStreakStatus(profile.last_learning_activity_date),
      loginMessage: getStreakMessage(profile.current_login_streak, getStreakStatus(profile.last_login_date), 'login'),
      learningMessage: getStreakMessage(
        profile.current_learning_streak,
        getStreakStatus(profile.last_learning_activity_date),
        'learning',
      ),
    };
  }, [profile, getStreakStatus, getStreakMessage]);

  // Enhanced loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className={compact ? 'pb-3' : ''}>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-lg" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className={compact ? 'pt-0' : ''}>
          <div className={`space-y-4 ${compact ? 'space-y-2' : ''}`}>
            <div className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-orange-50 to-red-50 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-8" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
            <div className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-8" />
                </div>
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state with retry functionality
  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">{error}</span>
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

  // No data state with better messaging
  if (!(profile && streakData)) {
    return (
      <Card className={className}>
        <CardHeader className={compact ? 'pb-3' : ''}>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5" />
            {compact ? 'Streaks' : 'Your Streaks'}
          </CardTitle>
        </CardHeader>
        <CardContent className={compact ? 'pt-0' : ''}>
          <div className="py-4 text-center">
            <div className="mb-3 inline-block rounded-full bg-gray-100 p-4 dark:bg-gray-800">
              <Flame className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-muted-foreground mb-2 text-sm">No streak data available</p>
            <p className="text-muted-foreground text-xs">Complete activities to start building streaks!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { loginStatus, learningStatus, loginMessage, learningMessage } = streakData;

  if (compact) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">{profile.current_login_streak}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Login streak: {profile.current_login_streak} days</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex cursor-help items-center gap-2">
                  <Star className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">{profile.current_learning_streak}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Learning streak: {profile.current_learning_streak} days</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider>
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Streaks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Login Streak */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help rounded-lg border bg-gradient-to-br from-orange-50 to-red-50 p-4 transition-shadow hover:shadow-sm dark:from-orange-950/20 dark:to-red-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-500" />
                    <h3 className="font-semibold">Daily Login</h3>
                  </div>
                  <Badge variant={getStreakBadgeVariant(loginStatus)}>
                    {profile.current_login_streak} day{profile.current_login_streak !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <p className="text-muted-foreground mb-2 text-sm">{loginMessage}</p>

                {profile.longest_login_streak > profile.current_login_streak && (
                  <p className="text-muted-foreground text-xs">Personal best: {profile.longest_login_streak} days</p>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Keep logging in daily to maintain your streak and earn bonus XP!</p>
            </TooltipContent>
          </Tooltip>

          {/* Learning Streak */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="cursor-help rounded-lg border bg-gradient-to-br from-blue-50 to-indigo-50 p-4 transition-shadow hover:shadow-sm dark:from-blue-950/20 dark:to-indigo-950/20">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-blue-500" />
                    <h3 className="font-semibold">Learning</h3>
                  </div>
                  <Badge variant={getStreakBadgeVariant(learningStatus)}>
                    {profile.current_learning_streak} day{profile.current_learning_streak !== 1 ? 's' : ''}
                  </Badge>
                </div>

                <p className="text-muted-foreground mb-2 text-sm">{learningMessage}</p>

                {profile.longest_learning_streak > profile.current_learning_streak && (
                  <p className="text-muted-foreground text-xs">Personal best: {profile.longest_learning_streak} days</p>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Complete learning activities daily to build your learning streak!</p>
            </TooltipContent>
          </Tooltip>

          {/* Streak Tips */}
          <div className="bg-muted/50 rounded-lg p-3">
            <h4 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              <Trophy className="h-4 w-4" />
              Streak Tips
            </h4>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>• Daily logins earn bonus XP</li>
              <li>• Learning streaks unlock special rewards</li>
              <li>• Consistency is key to maintaining streaks</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
