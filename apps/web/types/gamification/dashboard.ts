import type { StreakInfo, UserGamificationProfile } from './profile';
import type { OrganizationLeaderboard } from './leaderboard';
import * as z from 'zod';

/**
 * Dashboard and Aggregate Types
 * Combined views and summary data
 */

// Main dashboard data
export interface DashboardData {
  profile: UserGamificationProfile;
  recent_transactions: any[];
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
