import type { UserGamificationProfile, StreakInfo } from './profile';
import type { OrganizationLeaderboard } from './leaderboard';
import type { XPTransaction } from './transactions';
import { z } from 'zod';

/**
 * Dashboard and Aggregate Types
 * Combined views and summary data
 */

// Main dashboard data
export interface DashboardData {
  profile: UserGamificationProfile;
  recent_transactions: XPTransaction[];
  leaderboard: OrganizationLeaderboard;
  user_rank: number | null;
  streak_info: StreakInfo;
}

// Streak update response
export interface StreakUpdate {
  type: 'login' | 'learning';
  current_streak: number;
  longest_streak: number;
  streak_maintained: boolean;
  streak_broken: boolean;
  bonus_xp_awarded: number;
}

// Summary statistics
export interface GamificationSummary {
  total_xp: number;
  level: number;
  rank: number;
  total_participants: number;
  activities_completed: number;
  courses_completed: number;
  current_streak: number;
  longest_streak: number;
}

// Activity feed item
export interface ActivityFeedItem {
  id: string;
  type: 'xp_award' | 'level_up' | 'achievement' | 'streak';
  timestamp: string;
  title: string;
  description: string;
  xp_amount?: number;
  icon: string;
  color: string;
}

// Zod schemas
export const DashboardDataSchema = z.object({
  profile: z.any(), // Imported schema to avoid circular dependency
  recent_transactions: z.array(z.any()),
  leaderboard: z.any(),
  user_rank: z.number().nullable(),
  streak_info: z.object({
    login: z.object({
      current: z.number(),
      longest: z.number(),
      lastDate: z.string().nullable(),
    }),
    learning: z.object({
      current: z.number(),
      longest: z.number(),
      lastDate: z.string().nullable(),
    }),
  }),
});

export const StreakUpdateSchema = z.object({
  type: z.enum(['login', 'learning']),
  current_streak: z.number(),
  longest_streak: z.number(),
  streak_maintained: z.boolean(),
  streak_broken: z.boolean(),
  bonus_xp_awarded: z.number(),
});

export const GamificationSummarySchema = z.object({
  total_xp: z.number(),
  level: z.number(),
  rank: z.number(),
  total_participants: z.number(),
  activities_completed: z.number(),
  courses_completed: z.number(),
  current_streak: z.number(),
  longest_streak: z.number(),
});

export const ActivityFeedItemSchema = z.object({
  id: z.string(),
  type: z.enum(['xp_award', 'level_up', 'achievement', 'streak']),
  timestamp: z.string(),
  title: z.string(),
  description: z.string(),
  xp_amount: z.number().optional(),
  icon: z.string(),
  color: z.string(),
});

// Helper functions
export function createActivityFeedFromTransactions(transactions: XPTransaction[], limit = 10): ActivityFeedItem[] {
  return transactions.slice(0, limit).map((tx) => ({
    id: `tx-${tx.id}`,
    type: tx.triggered_level_up ? ('level_up' as const) : ('xp_award' as const),
    timestamp: tx.created_at,
    title: tx.triggered_level_up ? `Level Up! Reached Level ${tx.previous_level + 1}` : `Earned ${tx.amount} XP`,
    description: `From ${tx.source.replace(/_/g, ' ')}`,
    xp_amount: tx.amount,
    icon: tx.triggered_level_up ? '🎉' : '⭐',
    color: tx.triggered_level_up ? 'text-purple-500' : 'text-yellow-500',
  }));
}

export function extractSummary(dashboard: DashboardData): GamificationSummary {
  return {
    total_xp: dashboard.profile.total_xp,
    level: dashboard.profile.level,
    rank: dashboard.user_rank ?? 0,
    total_participants: dashboard.leaderboard.total_participants,
    activities_completed: dashboard.profile.total_activities_completed,
    courses_completed: dashboard.profile.total_courses_completed,
    current_streak: Math.max(dashboard.streak_info.login.current, dashboard.streak_info.learning.current),
    longest_streak: Math.max(dashboard.streak_info.login.longest, dashboard.streak_info.learning.longest),
  };
}
