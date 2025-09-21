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

// Backend-aligned enums (string unions) with known sources; keep extensible
export const XP_SOURCES = [
  'activity_completion',
  'course_completion',
  'login_bonus',
  'quiz_completion',
  'assignment_submission',
  'streak_bonus',
  'admin_award',
] as const;
export type XPSource = (typeof XP_SOURCES)[number] | (string & {}); // allow forward-compatible values

export type StreakType = 'login' | 'learning';

// Frontend profile type; backend ProfileRead omits `id`, but we keep it optional for forward-compat
export interface UserGamificationProfile {
  id?: number; // optional; not present in backend ProfileRead
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
  source: XPSource;
  amount?: number;
  source_id?: string;
  idempotency_key?: string;
}

export interface XPTransaction {
  id: number;
  user_id: number;
  org_id: number;
  amount: number;
  source: XPSource;
  source_id?: string | null;
  triggered_level_up: boolean;
  previous_level: number;
  created_at: string; // ISO string
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
  profile: UserGamificationProfile;

  // Optional convenience flags; prefer reading from transaction/profile
  triggered_level_up?: boolean; // mirrors transaction.triggered_level_up
  previous_level?: number; // mirrors transaction.previous_level
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
  id: z.number(),
  user_id: z.number(),
  org_id: z.number(),
  amount: z.number(),
  source: z.string(),
  source_id: z.string().nullable().optional(),
  triggered_level_up: z.boolean(),
  previous_level: z.number(),
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
  profile: UserGamificationProfileSchema,
  // Optional convenience flags
  triggered_level_up: z.boolean().optional(),
  previous_level: z.number().optional(),
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

// Optional: schema for award request (useful for client-side validation)
export const XPAwardRequestSchema = z.object({
  source: z.string(),
  amount: z.number().positive().optional(),
  source_id: z.string().optional(),
  idempotency_key: z.string().optional(),
});
