import { RequestBodyWithAuthHeader, errorHandling } from '@/services/utils/ts/requests';
import { getAPIUrl } from '@/services/config/config';

// Enhanced interfaces aligned with new server-authoritative architecture
export interface GamificationProfile {
  id: number;
  user_id: number;
  org_id: number;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  level_progress_percent: number; // Server-calculated progress
  current_login_streak: number;
  longest_login_streak: number;
  current_learning_streak: number;
  longest_learning_streak: number;
  current_daily_goal_streak?: number;
  longest_daily_goal_streak?: number;
  last_login_date: string | null;
  last_learning_activity_date: string | null;
  last_xp_award_date?: string | null;
  daily_xp_earned: number;
  daily_xp_limit: number;
  daily_goal_xp: number;
  total_activities_completed: number;
  total_courses_completed: number;
  total_sessions: number;
  profile_data: Record<string, any>; // Preferences and metadata
  creation_date: string;
  update_date: string;
  version?: number;
  login_streak_updated_today?: boolean; // Optimization flag from server
}

export interface XPTransaction {
  id: number;
  user_id: number;
  org_id: number;
  xp_amount: number;
  xp_source: string;
  xp_context: Record<string, any>;
  related_activity_id: string | null;
  related_course_id: string | null;
  related_trail_step_id: string | null;
  creation_date: string;
  level_before?: number;
  level_after?: number;
  level_up_occurred?: boolean;
  base_xp?: number;
  bonus_xp?: number;
  multiplier?: number;
}

export interface XPAwardRequest {
  source: string;
  source_id?: string;
  custom_amount?: number;
  multiplier?: number;
  idempotency_key?: string;
  metadata?: Record<string, any>;
}

export interface XPAwardResponse {
  transaction: XPTransaction;
  profile: GamificationProfile;
  level_up_occurred: boolean;
  previous_level: number;
  achievements_unlocked?: string[];
}

export interface StreakRecord {
  id: number;
  user_id: number;
  org_id: number;
  streak_type: string;
  activity_date: string;
  streak_count: number;
  activities_count: number;
  bonus_xp_awarded: number;
  milestone_reached: number | null;
  metadata: Record<string, any>;
}

export interface Achievement {
  id: number;
  org_id: number;
  achievement_key: string;
  achievement_type: string; // enum value
  title: string;
  description: string;
  icon_url?: string | null;
  requirements: Record<string, any>;
  xp_reward: number;
  unlock_level: number;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserAchievement {
  id: number;
  user_id: number;
  org_id: number;
  achievement_id: number;
  progress_percent: number;
  is_unlocked: boolean;
  unlocked_at: string | null;
  progress_data: Record<string, any>;
  achievement?: Achievement; // joined data
}

export interface GamificationDashboard {
  profile: GamificationProfile;
  recent_xp_transactions: XPTransaction[];
  daily_xp_history: {
    date: string;
    xp: number;
    transactions: number;
  }[];
  streak_status: {
    login: {
      current: number;
      longest: number;
      last_activity: string | null;
      status: string;
    };
    learning: {
      current: number;
      longest: number;
      last_activity: string | null;
      status: string;
    };
  };
  achievements: {
    total: number;
    recent: {
      key: string;
      title: string;
      type: string;
      xp_reward: number;
      unlocked_at: string | null;
    }[];
  };
  leaderboard_position?: number;
  next_level_preview: {
    level: number;
    xp_required: number;
    unlocks: string[];
  };
  daily_progress: {
    xp_earned: number;
    xp_limit: number;
    goal_xp: number;
    goal_progress: number;
    limit_progress: number;
  };
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  total_xp?: number;
  current_level?: number;
  current_login_streak?: number;
  current_learning_streak?: number;
  achievement_count?: number;
}

export interface OrganizationLeaderboard {
  org_id: number;
  leaderboard_type: string;
  period: string;
  leaderboard_entries: LeaderboardEntry[]; // backend field name
  total_participants: number;
  current_user_rank?: number | null;
  last_updated: string;
}

export type StreakStatus = 'active' | 'at_risk' | 'broken' | 'none';

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
 * Update user's learning streak (activity engagement)
 */
export async function updateLearningStreak(orgId: number, accessToken: string): Promise<GamificationProfile> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const result = await fetch(
    `${getAPIUrl()}gamification/learning-streak/${orgId}`,
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
 * Get organization leaderboard with enhanced filtering
 * @param orgId - Organization ID
 * @param accessToken - User's access token
 * @param leaderboardType - Type of leaderboard ('xp', 'streaks', 'achievements')
 * @param period - Time period ('all_time', 'monthly', 'weekly')
 * @param limit - Maximum number of entries to return (default: 50, max: 100)
 * @returns Promise<OrganizationLeaderboard>
 */
export async function getOrganizationLeaderboard(
  orgId: number,
  accessToken: string,
  leaderboardType: 'xp' | 'streaks' | 'achievements' = 'xp',
  period: 'all_time' | 'monthly' | 'weekly' = 'all_time',
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

  const params = new URLSearchParams({
    leaderboard_type: leaderboardType,
    period,
    limit: limit.toString(),
  });

  const result = await fetch(
    `${getAPIUrl()}gamification/leaderboard/${orgId}?${params}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );
  const data = await errorHandling(result);
  return data;
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
  max_level: number;
  max_daily_xp: number;
  sample_levels: { level: number; xp_required: number; cumulative_xp: number }[];
  calculation_note: string;
}> {
  const result = await fetch(`${getAPIUrl()}gamification/level-metadata`);
  return await errorHandling(result);
}

/**
 * Award XP (idempotent). Returns updated profile + transaction with achievement data.
 */
export async function awardXP(orgId: number, accessToken: string, payload: XPAwardRequest): Promise<XPAwardResponse> {
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
  // Use server-calculated progress directly
  if (typeof profile.level_progress_percent === 'number') {
    return Math.max(0, Math.min(100, profile.level_progress_percent));
  }

  // Fallback calculation (should be avoided in favor of server data)
  if (!profile.xp_to_next_level || profile.xp_to_next_level <= 0) {
    return 100; // Max level or invalid data
  }

  console.warn('Using client-side level progress calculation. Server should provide level_progress_percent.');

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
  xpToNextLevel: number;
  dailyXPEarned: number;
  dailyXPLimit: number;
  dailyGoalXP: number;
  serverCalculated: boolean;
} {
  return {
    currentLevel: profile.current_level,
    totalXP: profile.total_xp,
    progressPercent: profile.level_progress_percent ?? calculateLevelProgress(profile),
    xpToNextLevel: profile.xp_to_next_level,
    dailyXPEarned: profile.daily_xp_earned,
    dailyXPLimit: profile.daily_xp_limit,
    dailyGoalXP: profile.daily_goal_xp,
    serverCalculated: typeof profile.level_progress_percent === 'number',
  };
}

/**
 * Get display name for XP source
 */
export function getXPSourceDisplayName(source: string): string {
  const sourceMap: Record<string, string> = {
    daily_login: 'Daily Login',
    first_login: 'First Login',
    activity_completion: 'Activity Completed',
    course_completion: 'Course Completed',
    perfect_score: 'Perfect Score',
    streak_bonus: 'Streak Bonus',
    social_sharing: 'Social Sharing',
    peer_review: 'Peer Review',
    content_creation: 'Content Creation',
    milestone_reached: 'Milestone Reached',
    admin_award: 'Admin Award',
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
    if (diffDays === 1) return 'at_risk';
    return 'broken';
  } catch (error) {
    console.warn('Invalid date format in getStreakStatus:', lastActivityDate, error);
    return 'none';
  }
}
