import { RequestBodyWithAuthHeader, errorHandling } from '@/services/utils/ts/requests';
import { getAPIUrl } from '@/services/config/config';

// Enhanced interfaces with better typing and server-authoritative data
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
  profile_data: {
    // Server-calculated level progression data (server-authoritative)
    current_level_base_xp?: number;
    current_level_total_xp?: number;
    current_level_current_xp?: number;
    progress_percent?: number;
    xp_for_current_level?: number;
    server_calculated_at?: string;

    // Level-up tracking
    last_level_up?: string;
    levels_gained?: number;
    old_level?: number;
    new_level?: number;

    // Additional metadata
    [key: string]: any;
  };
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
  if (limit <= 0 || limit > 200) {
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
 * Get level calculation metadata from server to prevent drift
 */
export async function getLevelMetadata(): Promise<{
  base_xp_per_level: number;
  xp_multiplier_per_level: number;
  sample_levels: Array<{ level: number; xp_required: number; cumulative_xp: number }>;
  calculation_note: string;
}> {
  const result = await fetch(`${getAPIUrl()}gamification/level-metadata`);
  return await errorHandling(result);
}

/**
 * Award XP (idempotent). Returns updated profile + transaction.
 */
export async function awardXP(
  orgId: number,
  accessToken: string,
  payload: {
    source: string;
    source_id?: string;
    xp_amount?: number;
    idempotency_key?: string;
    transaction_metadata?: Record<string, any>;
  },
): Promise<any> {
  if (!orgId) throw new Error('orgId required');
  if (!accessToken) throw new Error('access token required');
  const body = { ...payload };
  if (!body.idempotency_key) {
    body.idempotency_key = `xp_${payload.source}_${payload.source_id || 'generic'}_${Date.now()}`;
  }
  const res = await fetch(
    `${getAPIUrl()}gamification/award-xp/${orgId}`,
    RequestBodyWithAuthHeader('POST', JSON.stringify(body), 'application/json', accessToken),
  );
  return errorHandling(res);
}

// Preferences
export async function getGamificationPreferences(orgId: number, accessToken: string) {
  const res = await fetch(
    `${getAPIUrl()}gamification/preferences/${orgId}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );
  return errorHandling(res);
}

export async function updateGamificationPreferences(orgId: number, accessToken: string, preferences: any) {
  const res = await fetch(
    `${getAPIUrl()}gamification/preferences/${orgId}`,
    RequestBodyWithAuthHeader('PUT', JSON.stringify({ preferences }), 'application/json', accessToken),
  );
  return errorHandling(res);
}

/**
 * Calculate progress percentage within current level (server-authoritative)
 * Uses server-calculated data to prevent drift between frontend and backend.
 */
export function calculateLevelProgress(profile: GamificationProfile): number {
  // Prefer server-calculated progress if available
  if (profile.profile_data?.progress_percent !== undefined) {
    return Math.max(0, Math.min(100, profile.profile_data.progress_percent));
  }

  // Fallback calculation (should be avoided in favor of server data)
  if (!profile.xp_to_next_level || profile.xp_to_next_level <= 0) {
    return 100; // Max level or invalid data
  }

  // Use server-provided level data if available
  if (profile.profile_data?.current_level_total_xp && profile.profile_data?.current_level_current_xp) {
    const totalXPForLevel = profile.profile_data.current_level_total_xp;
    const currentXPInLevel = profile.profile_data.current_level_current_xp;
    return Math.max(0, Math.min(100, (currentXPInLevel / totalXPForLevel) * 100));
  }

  // Legacy fallback - warn that server data should be used
  console.warn('Using client-side level progress calculation. Server should provide progress_percent in profile_data.');

  // Rough approximation based on exponential progression (not authoritative)
  const baseXP = 100;
  const multiplier = 1.2;
  const xpForCurrentLevel = Math.floor(baseXP * multiplier ** (profile.current_level - 1));
  const currentProgress = Math.max(0, xpForCurrentLevel - profile.xp_to_next_level);

  return Math.max(0, Math.min(100, (currentProgress / xpForCurrentLevel) * 100));
}

/**
 * Get level progression data from server-authoritative profile
 * This replaces client-side level calculations entirely.
 */
export function getLevelProgressionData(profile: GamificationProfile): {
  currentLevel: number;
  totalXP: number;
  progressPercent: number;
  currentLevelBaseXP: number;
  currentLevelTotalXP: number;
  currentLevelCurrentXP: number;
  xpToNextLevel: number;
  serverCalculated: boolean;
} {
  const serverData = profile.profile_data || {};

  return {
    currentLevel: profile.current_level,
    totalXP: profile.total_xp,
    progressPercent: serverData.progress_percent ?? calculateLevelProgress(profile),
    currentLevelBaseXP: serverData.current_level_base_xp ?? 0,
    currentLevelTotalXP: serverData.current_level_total_xp ?? 100,
    currentLevelCurrentXP: serverData.current_level_current_xp ?? 0,
    xpToNextLevel: profile.xp_to_next_level,
    serverCalculated: serverData.server_calculated_at !== undefined,
  };
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
 * @param amount - The XP amount to format
 * @param locale - Optional locale for number formatting
 */
export function formatXPAmount(amount: number, locale?: string): string {
  const sign = amount > 0 ? '+' : '';
  const formattedNumber = locale ? amount.toLocaleString(locale) : amount.toLocaleString();
  return `${sign}${formattedNumber} XP`;
}

/**
 * Check if a streak is at risk (user hasn't completed action today)
 * @param lastActivityDate - ISO date string of last activity
 * @returns boolean indicating if streak is at risk
 */
export function isStreakAtRisk(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false;

  try {
    const lastDate = new Date(lastActivityDate);
    const today = new Date();

    // Reset time to compare dates only
    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays >= 1;
  } catch (error) {
    console.warn('Invalid date format in isStreakAtRisk:', lastActivityDate, error);
    return false;
  }
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

    // Validate date is valid
    if (Number.isNaN(lastDate.getTime())) {
      throw new Error('Invalid date');
    }

    // Reset time to compare dates only
    lastDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffTime = today.getTime() - lastDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'active';
    if (diffDays === 1) return 'at-risk';
    return 'broken';
  } catch (error) {
    console.warn('Invalid date format in getStreakStatus:', lastActivityDate, error);
    return 'none';
  }
}
