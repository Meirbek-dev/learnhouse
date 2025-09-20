import { z } from 'zod';

/**
 * Gamification types - unified and simplified
 */

// Error handling types
export type GamificationErrorType =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'DAILY_LIMIT_EXCEEDED'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR';

export interface GamificationError {
  type: GamificationErrorType;
  message: string;
  details?: any;
}

export interface UserGamificationProfile {
  id: number; // Consistent with backend
  user_id: number; // Consistent with backend
  org_id: number; // Consistent naming
  total_xp: number;
  level: number;

  // Consistent streak naming
  login_streak: number;
  learning_streak: number;
  longest_login_streak: number;
  longest_learning_streak: number;

  // Activity counters
  total_activities_completed: number;
  total_courses_completed: number;
  daily_xp_earned: number;

  // Computed properties from backend
  xp_to_next_level?: number;
  level_progress_percent?: number;
  xp_in_current_level?: number;

  // Timestamps
  last_xp_award_date?: string | null;
  last_login_date?: string | null;
  last_learning_date?: string | null;
  created_at: string;
  updated_at: string;

  // User preferences
  preferences: Record<string, any>;
}

export interface XPAwardRequest {
  source: string;
  sourceId?: string;
  customAmount?: number;
}

export interface XPTransaction {
  id: string;
  user_id: string;
  organization_id: string;
  amount: number;
  activity_type: string;
  activity_id?: string;
  reason?: string;
  created_at: string;
}

export interface StreakRecord {
  id: string;
  user_id: string;
  organization_id: string;
  activity_type: string;
  activity_date: string;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: number; // Changed from string to number for frontend compatibility
  total_xp: number;
  level: number;
  current_level: number; // Required for frontend compatibility
  rank: number;
  username?: string | null; // Optional enriched field
}

export interface OrganizationLeaderboard {
  entries: LeaderboardEntry[];
}

export interface DashboardData {
  profile: UserGamificationProfile;
  recent_transactions: XPTransaction[];
  leaderboard: OrganizationLeaderboard;
  user_rank?: number | null;
  streak_info: {
    current_streak: number;
    longest_streak: number;
    last_activity: string | null;
  };
}

export interface XPAwardResponse {
  transaction: XPTransaction;
  new_total_xp: number;
  new_level: number;
  level_up: boolean;
  profile: UserGamificationProfile;
}

export interface StreakUpdate {
  current_streak: number;
  longest_streak: number;
  streak_maintained: boolean;
  streak_broken: boolean;
}

export interface GamificationPreferences {
  notifications_enabled: boolean;
  public_profile: boolean;
  show_on_leaderboard: boolean;
  preferred_activity_types: string[];
}

// Zod schemas for validation
export const UserGamificationProfileSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  org_id: z.number(),
  total_xp: z.number(),
  level: z.number(),
  login_streak: z.number(),
  learning_streak: z.number(),
  longest_login_streak: z.number(),
  longest_learning_streak: z.number(),
  total_activities_completed: z.number(),
  total_courses_completed: z.number(),
  daily_xp_earned: z.number(),
  xp_in_current_level: z.number().optional(),
  xp_to_next_level: z.number().optional(),
  level_progress_percent: z.number().optional(),
  last_xp_award_date: z.string().nullable().optional(),
  last_login_date: z.string().nullable().optional(),
  last_learning_date: z.string().nullable().optional(),
  preferences: z.record(z.string(), z.any()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const XPTransactionSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  organization_id: z.string(),
  amount: z.number(),
  activity_type: z.string(),
  activity_id: z.string().optional(),
  reason: z.string().optional(),
  created_at: z.string(),
});

export const StreakRecordSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  organization_id: z.string(),
  activity_type: z.string(),
  activity_date: z.string(),
  created_at: z.string(),
});

export const LeaderboardEntrySchema = z.object({
  user_id: z.number(), // Changed from string to number
  total_xp: z.number(),
  level: z.number(),
  current_level: z.number(), // Required
  rank: z.number(),
  username: z.string().nullable().optional(),
});

export const OrganizationLeaderboardSchema = z.object({
  entries: z.array(LeaderboardEntrySchema),
});

export const DashboardDataSchema = z.object({
  profile: UserGamificationProfileSchema,
  recent_transactions: z.array(XPTransactionSchema),
  leaderboard: OrganizationLeaderboardSchema,
  user_rank: z.number().nullable().optional(),
  streak_info: z.object({
    current_streak: z.number(),
    longest_streak: z.number(),
    last_activity: z.string().nullable(),
  }),
});

export const XPAwardResponseSchema = z.object({
  transaction: XPTransactionSchema,
  new_total_xp: z.number(),
  new_level: z.number(),
  level_up: z.boolean(),
  profile: UserGamificationProfileSchema,
});

export const StreakUpdateSchema = z.object({
  current_streak: z.number(),
  longest_streak: z.number(),
  streak_maintained: z.boolean(),
  streak_broken: z.boolean(),
});

export const GamificationPreferencesSchema = z.object({
  notifications_enabled: z.boolean(),
  public_profile: z.boolean(),
  show_on_leaderboard: z.boolean(),
  preferred_activity_types: z.array(z.string()),
});
