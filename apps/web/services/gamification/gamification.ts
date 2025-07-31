import { RequestBodyWithAuthHeader, errorHandling } from '@/services/utils/ts/requests';
import { getAPIUrl } from '@/services/config/config';

// Enhanced interfaces with better typing
export interface GamificationProfile {
  id: number;
  user_id: number;
  org_id: number;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  current_login_streak: number;
  longest_login_streak: number;
  current_learning_streak: number;
  longest_learning_streak: number;
  last_login_date: string | null;
  last_learning_activity_date: string | null;
  profile_data: Record<string, any>;
  creation_date: string;
  update_date: string;
}

export interface XPTransaction {
  id: number;
  user_id: number;
  org_id: number;
  xp_amount: number;
  xp_source: string;
  xp_context: Record<string, any>;
  related_activity_id: number | null;
  related_course_id: number | null;
  related_trail_step_id: number | null;
  creation_date: string;
}

export interface StreakRecord {
  id: number;
  user_id: number;
  org_id: number;
  streak_type: string;
  current_count: number;
  longest_count: number;
  streak_start_date: string | null;
  last_activity_date: string | null;
  streak_end_date: string | null;
  streak_data: Record<string, any>;
  is_active: boolean;
  creation_date: string;
  update_date: string;
}

export interface GamificationDashboard {
  profile: GamificationProfile;
  recent_xp_transactions: XPTransaction[];
  active_streaks: StreakRecord[];
  total_activities_completed: number;
  total_courses_completed: number;
  total_certificates: number;
  rank_in_organization: number | null;
}

export interface LeaderboardEntry {
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

export interface OrganizationLeaderboard {
  org_id: number;
  leaderboard_entries: LeaderboardEntry[];
  total_participants: number;
}

export type StreakStatus = 'active' | 'at-risk' | 'broken' | 'none';

/**
 * Get user's gamification profile for an organization
 * @param orgId - Organization ID
 * @param accessToken - User's access token
 * @returns Promise<GamificationProfile>
 * @throws Error if request fails or user unauthorized
 */
export async function getGamificationProfile(orgId: number, accessToken: string): Promise<GamificationProfile> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const result = await fetch(
    `${getAPIUrl()}gamification/profile/${orgId}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );

  return await errorHandling(result);
}

/**
 * Update user's login streak
 * @param orgId - Organization ID
 * @param accessToken - User's access token
 * @returns Promise<GamificationProfile> Updated profile
 * @throws Error if request fails or user unauthorized
 */
export async function updateLoginStreak(orgId: number, accessToken: string): Promise<GamificationProfile> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const result = await fetch(
    `${getAPIUrl()}gamification/login-streak/${orgId}`,
    RequestBodyWithAuthHeader('POST', null, null, accessToken),
  );

  return await errorHandling(result);
}

/**
 * Get comprehensive gamification dashboard data
 * @param orgId - Organization ID
 * @param accessToken - User's access token
 * @returns Promise<GamificationDashboard>
 * @throws Error if request fails or user unauthorized
 */
export async function getGamificationDashboard(orgId: number, accessToken: string): Promise<GamificationDashboard> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const result = await fetch(
    `${getAPIUrl()}gamification/dashboard/${orgId}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );

  return await errorHandling(result);
}

/**
 * Get organization leaderboard
 * @param orgId - Organization ID
 * @param accessToken - User's access token
 * @param limit - Maximum number of entries to return (default: 50, max: 100)
 * @returns Promise<OrganizationLeaderboard>
 * @throws Error if request fails or user unauthorized
 */
export async function getOrganizationLeaderboard(
  orgId: number,
  accessToken: string,
  limit = 50,
): Promise<OrganizationLeaderboard> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }
  if (limit <= 0 || limit > 100) {
    throw new Error('Limit must be between 1 and 100');
  }

  const result = await fetch(
    `${getAPIUrl()}gamification/leaderboard/${orgId}?limit=${limit}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );

  return await errorHandling(result);
}

/**
 * Get XP reward structure
 */
export async function getXPRewards(): Promise<Record<string, number>> {
  const result = await fetch(`${getAPIUrl()}gamification/xp-rewards`);
  return await errorHandling(result);
}

/**
 * Calculate level from total XP (client-side utility)
 */
export function calculateLevel(totalXP: number): { level: number; xpToNext: number } {
  if (totalXP <= 0) {
    return { level: 1, xpToNext: 100 };
  }

  let level = 1;
  let xpRequired = 0;
  const baseXP = 100;
  const multiplier = 1.2;

  while (true) {
    const xpForThisLevel = Math.floor(baseXP * multiplier ** (level - 1));
    if (xpRequired + xpForThisLevel > totalXP) {
      const xpToNext = xpRequired + xpForThisLevel - totalXP;
      return { level, xpToNext };
    }

    xpRequired += xpForThisLevel;
    level += 1;

    // Safety limit
    if (level > 1000) {
      return { level, xpToNext: 0 };
    }
  }
}

/**
 * Calculate progress percentage within current level
 */
export function calculateLevelProgress(profile: GamificationProfile): number {
  const baseXP = 100;
  const multiplier = 1.2;

  const xpForCurrentLevel = Math.floor(baseXP * multiplier ** (profile.current_level - 1));
  const totalXpNeeded = xpForCurrentLevel;
  const currentProgress = totalXpNeeded - profile.xp_to_next_level;

  return Math.max(0, Math.min(100, (currentProgress / totalXpNeeded) * 100));
}

/**
 * Get display name for XP source
 */
export function getXPSourceDisplayName(source: string): string {
  const sourceMap: Record<string, string> = {
    login_daily: 'Daily Login',
    activity_completion: 'Activity Completed',
    course_completion: 'Course Completed',
    perfect_score: 'Perfect Score',
    first_activity: 'First Activity',
    login_streak_7_days: '7-Day Login Streak',
    login_streak_30_days: '30-Day Login Streak',
    login_streak_100_days: '100-Day Login Streak',
  };

  return sourceMap[source] || source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format XP amount with appropriate signs and formatting
 */
export function formatXPAmount(amount: number): string {
  const sign = amount > 0 ? '+' : '';
  return `${sign}${amount.toLocaleString()} XP`;
}

/**
 * Check if a streak is at risk (user hasn't completed action today)
 */
export function isStreakAtRisk(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false;

  const lastDate = new Date(lastActivityDate);
  const today = new Date();
  const diffTime = today.getTime() - lastDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays >= 1;
}

/**
 * Get streak status based on last activity date
 * @param lastActivityDate - ISO date string of last activity
 * @returns StreakStatus indicating current streak state
 */
export function getStreakStatus(lastActivityDate: string | null): StreakStatus {
  if (!lastActivityDate) return 'none';

  try {
    const lastDate = new Date(lastActivityDate);
    const today = new Date();

    // Reset time to compare dates only
    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'active';
    if (diffDays === 1) return 'at-risk';
    return 'broken';
  } catch {
    console.warn('Invalid date format in getStreakStatus:', lastActivityDate);
    return 'none';
  }
}
