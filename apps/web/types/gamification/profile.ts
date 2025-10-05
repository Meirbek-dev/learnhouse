import type { LucideIcon } from 'lucide-react';
import { z } from 'zod';

/**
 * User Profile and Level Types
 * Core gamification profile data
 */

// Backend-aligned profile interface
export interface UserGamificationProfile {
  id?: number; // Optional; not always present in backend ProfileRead
  user_id: number;
  org_id: number;
  total_xp: number;
  level: number;

  // Streak data
  login_streak: number;
  learning_streak: number;
  longest_login_streak: number;
  longest_learning_streak: number;

  // Activity counters
  total_activities_completed: number;
  total_courses_completed: number;
  daily_xp_earned: number;

  // Computed level progression
  xp_to_next_level?: number;
  level_progress_percent?: number;
  xp_in_current_level?: number;

  // Timestamps
  last_xp_award_date?: string | null;
  last_login_date?: string | null;
  last_learning_date?: string | null;
  created_at: string;
  updated_at: string;

  // User preferences (typed separately)
  preferences: Record<string, unknown>;
}

// Level information with UI metadata
export interface LevelInfo {
  level: number;
  title: string;
  titleKey?: string; // Translation key (optional for backward compatibility)
  color: string; // Tailwind color class
  icon: LucideIcon; // Icon component
  minXP: number;
  maxXP?: number; // undefined for max level
  unlocks?: string[]; // Translation keys for unlocked features (optional)
}

// Streak information
export interface StreakInfo {
  login: {
    current: number;
    longest: number;
    lastDate: string | null;
  };
  learning: {
    current: number;
    longest: number;
    lastDate: string | null;
  };
}

// Level milestone for UI
export interface LevelMilestone {
  level: number;
  title: string;
  titleKey: string;
  color: string;
  minXP: number;
  unlocks: string[];
}

// Dashboard profile data
export interface DashboardProfile {
  profile: UserGamificationProfile;
  streaks: StreakInfo;
  nextMilestone: LevelMilestone | null;
  levelProgress: {
    currentLevelXP: number;
    nextLevelXP: number;
    progressPercent: number;
    xpToNext: number;
  };
}

// Zod schemas
export const UserGamificationProfileSchema = z.object({
  id: z.number().optional(),
  user_id: z.number(),
  org_id: z.number(),
  total_xp: z.number().min(0),
  level: z.number().min(1).max(100),
  login_streak: z.number().min(0),
  learning_streak: z.number().min(0),
  longest_login_streak: z.number().min(0),
  longest_learning_streak: z.number().min(0),
  total_activities_completed: z.number().min(0),
  total_courses_completed: z.number().min(0),
  daily_xp_earned: z.number().min(0),
  xp_in_current_level: z.number().min(0).optional(),
  xp_to_next_level: z.number().min(0).optional(),
  level_progress_percent: z.number().min(0).max(100).optional(),
  last_xp_award_date: z.string().nullable().optional(),
  last_login_date: z.string().nullable().optional(),
  last_learning_date: z.string().nullable().optional(),
  preferences: z.record(z.string(), z.unknown()),
  created_at: z.string(),
  updated_at: z.string(),
});

export const LevelInfoSchema = z.object({
  level: z.number(),
  title: z.string(),
  titleKey: z.string().optional(),
  color: z.string(),
  icon: z.any(), // Can't validate React component with Zod
  minXP: z.number(),
  maxXP: z.number().optional(),
  unlocks: z.array(z.string()).optional(),
});

export const StreakInfoSchema = z.object({
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
});

export const LevelMilestoneSchema = z.object({
  level: z.number(),
  title: z.string(),
  titleKey: z.string(),
  color: z.string(),
  minXP: z.number(),
  unlocks: z.array(z.string()),
});

export const DashboardProfileSchema = z.object({
  profile: UserGamificationProfileSchema,
  streaks: StreakInfoSchema,
  nextMilestone: LevelMilestoneSchema.nullable(),
  levelProgress: z.object({
    currentLevelXP: z.number(),
    nextLevelXP: z.number(),
    progressPercent: z.number(),
    xpToNext: z.number(),
  }),
});

// Helper functions
export function extractStreakInfo(profile: UserGamificationProfile): StreakInfo {
  return {
    login: {
      current: profile.login_streak,
      longest: profile.longest_login_streak,
      lastDate: profile.last_login_date ?? null,
    },
    learning: {
      current: profile.learning_streak,
      longest: profile.longest_learning_streak,
      lastDate: profile.last_learning_date ?? null,
    },
  };
}

export function calculateLevelProgress(profile: UserGamificationProfile): {
  currentLevelXP: number;
  nextLevelXP: number;
  progressPercent: number;
  xpToNext: number;
} {
  const currentLevelXP = profile.xp_in_current_level ?? 0;
  const xpToNext = profile.xp_to_next_level ?? 100;
  const nextLevelXP = currentLevelXP + xpToNext;
  const progressPercent =
    profile.level_progress_percent ?? (nextLevelXP > 0 ? (currentLevelXP / nextLevelXP) * 100 : 0);

  return {
    currentLevelXP,
    nextLevelXP,
    progressPercent: Math.min(progressPercent, 100),
    xpToNext,
  };
}

// ===================================
// TYPE GUARDS
// ===================================

/**
 * Check if a profile has valid XP data
 */
export function hasValidXP(profile: unknown): profile is UserGamificationProfile {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    'total_xp' in profile &&
    typeof (profile as UserGamificationProfile).total_xp === 'number' &&
    (profile as UserGamificationProfile).total_xp >= 0
  );
}

/**
 * Check if profile has active streak
 */
export function hasActiveStreak(profile: UserGamificationProfile): boolean {
  return profile.login_streak > 0 || profile.learning_streak > 0;
}

/**
 * Check if profile is at max level
 */
export function isMaxLevel(profile: UserGamificationProfile): boolean {
  return profile.level >= 100;
}

/**
 * Check if profile can earn more XP today
 */
export function canEarnMoreXPToday(profile: UserGamificationProfile, dailyLimit = 500): boolean {
  return profile.daily_xp_earned < dailyLimit;
}

/**
 * Type guard for LevelInfo
 */
export function isLevelInfo(value: unknown): value is LevelInfo {
  return (
    typeof value === 'object' &&
    value !== null &&
    'level' in value &&
    'title' in value &&
    'color' in value &&
    'icon' in value &&
    'minXP' in value
  );
}
