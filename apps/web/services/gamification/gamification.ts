import { RequestBodyWithAuthHeader, errorHandling } from '@/services/utils/ts/requests';
import { getAPIUrl } from '@/services/config/config';

// ---------------------------------------------------------------------------
// NOTE: Backend gamification models were refactored (Python side) and some field
// names diverged from the legacy frontend expectations. We normalize all
// responses here so components can continue to rely on a stable shape without
// hunting for snake_case vs legacy aliases. This is the ONLY place that should
// know about backend naming differences.
// ---------------------------------------------------------------------------

// Modern gamification interfaces aligned with new server architecture
export interface GamificationProfile {
  id: number;
  user_id: number;
  org_id: number;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  level_progress_percent: number; // 0-100 authoritative percent
  xp_in_level?: number;
  last_xp_award_date?: string | null;
  // Nested structures (authoritative)
  streaks: {
    login: { current: number; longest: number };
    learning: { current: number; longest: number };
  };
  last_activity: { login: string | null; learning: string | null };
  daily: { xp_earned: number; xp_limit: number; goal_xp: number };
  totals: { activities_completed: number; courses_completed: number };
  total_sessions?: number;
  avg_session_duration?: number;
  preferences: Record<string, any>;
  version?: number;
  created_at?: string;
  updated_at?: string;
}

export interface XPTransaction {
  id: number;
  user_id: number;
  org_id: number;
  xp_amount: number;
  source: string;
  source_id?: string | null;
  multiplier_applied?: number;
  bonus_xp?: number;
  reason?: string | null;
  transaction_metadata?: Record<string, any>;
  created_at: string;
  created_by_admin?: boolean;
  admin_user_id?: number | null;
  triggered_level_up?: boolean;
  previous_level?: number;
  new_level?: number;
  idempotency_key?: string | null;
}

export interface XPAwardRequest {
  source: string;
  source_id?: string;
  custom_amount?: number;
  idempotency_key?: string;
  metadata?: Record<string, any>;
}

export interface XPAwardResponse {
  transaction: XPTransaction;
  profile: GamificationProfile;
  level_up_occurred: boolean;
  previous_level: number;
  achievements_unlocked?: string[];
  is_new_transaction?: boolean; // new backend field
}

export interface GamificationDashboard {
  profile: GamificationProfile;
  // Normalized list of transactions (from either XPTransactionRead or simplified recent_transactions)
  recent_xp_transactions: XPTransaction[];
  // These legacy fields may not be provided by new backend; keep optional
  daily_xp_history?: { date: string; xp: number; transactions: number }[];
  streak_status?: any; // Not yet fully aligned; kept loose to avoid breaking UI placeholders
  next_level_preview?: { level: number; xp_required: number; unlocks?: string[] };
  daily_progress?: {
    xp_earned: number;
    xp_limit: number;
    goal_xp: number;
    goal_progress: number;
    limit_progress: number;
  };
  // Additional server-provided raw fragments allowed
  level_details?: {
    level: number;
    xp_in_level: number;
    xp_to_next_level: number;
    progress_percent?: number; // derived percent
    progress?: number; // 0-1 (server forms)
  };
  statistics?: Record<string, any>;
}

// --------------------------- Normalization Utilities -----------------------

function safeNumber(val: any, fallback = 0): number {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeProfile(input: any): GamificationProfile {
  if (!input || typeof input !== 'object') throw new Error('Invalid profile payload');
  // New backend always wraps under {data: {profile}} for profile/streak endpoints
  const raw = input.data?.profile ? input.data.profile : input.profile ? input.profile : input;

  const profile: GamificationProfile = {
    id: raw.id ?? 0,
    user_id: raw.user_id ?? raw.userId ?? 0,
    org_id: raw.org_id ?? raw.orgId ?? 0,
    total_xp: safeNumber(raw.total_xp),
    current_level: safeNumber(raw.current_level, 1),
    xp_to_next_level: safeNumber(raw.xp_to_next_level),
    level_progress_percent: safeNumber(
      raw.level_progress_percent ?? raw.levelProgressPercent ?? (raw.level_details?.progress ?? 0) * 100,
    ),
    xp_in_level: safeNumber(raw.xp_in_level ?? raw.level_details?.xp_in_level),
    last_xp_award_date: raw.last_xp_award_date ?? null,
    streaks: {
      login: {
        current: safeNumber(raw.streaks?.login?.current ?? raw.current_login_streak),
        longest: safeNumber(raw.streaks?.login?.longest ?? raw.longest_login_streak),
      },
      learning: {
        current: safeNumber(raw.streaks?.learning?.current ?? raw.current_learning_streak),
        longest: safeNumber(raw.streaks?.learning?.longest ?? raw.longest_learning_streak),
      },
    },
    last_activity: {
      login: raw.last_activity?.login ?? raw.last_login_date ?? null,
      learning: raw.last_activity?.learning ?? raw.last_learning_activity_date ?? null,
    },
    daily: {
      xp_earned: safeNumber(raw.daily?.xp_earned ?? raw.daily_xp_earned),
      xp_limit: safeNumber(raw.daily?.xp_limit ?? raw.daily_xp_limit),
      goal_xp: safeNumber(raw.daily?.goal_xp ?? raw.daily_goal_xp ?? 50),
    },
    totals: {
      activities_completed: safeNumber(raw.totals?.activities_completed ?? raw.total_activities_completed),
      courses_completed: safeNumber(raw.totals?.courses_completed ?? raw.total_courses_completed),
    },
    total_sessions: safeNumber(raw.total_sessions),
    avg_session_duration: safeNumber(raw.avg_session_duration),
    preferences: raw.preferences || {},
    version: safeNumber(raw.version, 1),
    created_at: raw.created_at ?? raw.creation_date,
    updated_at: raw.updated_at ?? raw.update_date,
  };

  if (!Number.isFinite(profile.level_progress_percent)) profile.level_progress_percent = 0;
  if (!Number.isFinite(profile.xp_to_next_level)) profile.xp_to_next_level = 0;
  // Populate nested convenience objects if backend didn't supply them
  // All nested objects always present now.
  return profile;
}

function normalizeTransaction(raw: any): XPTransaction {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid transaction payload');
  const tx: XPTransaction = {
    id: raw.id ?? 0,
    user_id: raw.user_id ?? 0,
    org_id: raw.org_id ?? 0,
    xp_amount: safeNumber(raw.xp_amount ?? raw.xp_awarded),
    source: raw.source ?? raw.xp_source ?? 'unknown',
    source_id: raw.source_id ?? null,
    multiplier_applied: safeNumber(raw.multiplier_applied, 1),
    bonus_xp: safeNumber(raw.bonus_xp),
    reason: raw.reason ?? null,
    transaction_metadata: raw.transaction_metadata ?? raw.metadata ?? {},
    created_at: raw.created_at ?? new Date().toISOString(),
    created_by_admin: raw.created_by_admin ?? false,
    admin_user_id: raw.admin_user_id ?? null,
    triggered_level_up: !!(raw.triggered_level_up ?? raw.level_up_occurred),
    previous_level: raw.previous_level ?? raw.level_before,
    new_level: raw.new_level ?? raw.level_after,
    idempotency_key: raw.idempotency_key ?? null,
  };
  return tx;
}

function normalizeAwardResponse(input: any): XPAwardResponse {
  const raw = input?.data ? input.data : input; // unwrap {data:{...}}
  const transaction = normalizeTransaction(raw.transaction || raw.tx || {});
  const profile = normalizeProfile(raw.profile || {});
  return {
    transaction,
    profile,
    level_up_occurred: !!(raw.level_up_occurred ?? transaction.triggered_level_up),
    previous_level: raw.previous_level ?? transaction.previous_level ?? profile.current_level,
    achievements_unlocked: raw.achievements_unlocked || [],
    is_new_transaction: raw.is_new_transaction,
  };
}

function normalizeDashboard(input: any): GamificationDashboard {
  if (!input || typeof input !== 'object') throw new Error('Invalid dashboard payload');
  const raw = input.data ? input.data : input; // server returns plain dict now
  const profile = normalizeProfile({ profile: raw.profile || raw.profile });
  const txListRaw = raw.recent_xp_transactions || raw.recent_transactions || [];
  const recent_xp_transactions: XPTransaction[] = Array.isArray(txListRaw)
    ? txListRaw.map((t: any) => {
        try {
          return normalizeTransaction(t);
        } catch {
          return {
            id: t?.id ?? 0,
            user_id: profile.user_id,
            org_id: profile.org_id,
            xp_amount: safeNumber(t?.xp_amount ?? t?.xp_awarded),
            source: t?.source ?? 'unknown',
            created_at: t?.created_at ?? new Date().toISOString(),
          } as XPTransaction;
        }
      })
    : [];
  const level_details = raw.level_details
    ? {
        level: safeNumber(raw.level_details.level, profile.current_level),
        xp_in_level: safeNumber(raw.level_details.xp_in_level),
        xp_to_next_level: safeNumber(raw.level_details.xp_to_next_level ?? raw.level_details.xp_to_next),
        progress_percent: safeNumber(raw.level_details.progress_percent ?? (raw.level_details.progress ?? 0) * 100),
        progress: raw.level_details.progress,
      }
    : undefined;
  return {
    profile,
    recent_xp_transactions,
    level_details,
    statistics: raw.statistics,
    daily_xp_history: raw.daily_xp_history,
    streak_status: raw.streak_status,
    next_level_preview: raw.next_level_preview,
    daily_progress: raw.daily_progress,
  };
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  total_xp?: number;
  current_level?: number;
  current_login_streak?: number;
  current_learning_streak?: number;
}

export interface OrganizationLeaderboard {
  org_id: number;
  leaderboard_type: string;
  period: string;
  leaderboard_entries: LeaderboardEntry[];
  total_participants: number;
  current_user_rank?: number | null;
  last_updated: string;
}

export type StreakStatus = 'active' | 'at_risk' | 'broken' | 'none';

// Core API Functions

/**
 * Get user's gamification profile for an organization
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

  const raw = await errorHandling(result);
  return normalizeProfile(raw); // normalizer now unwraps nested data
}

/**
 * Update user's login streak
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

  const raw = await errorHandling(result);
  return normalizeProfile(raw);
}

/**
 * Update user's learning streak
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

  const raw = await errorHandling(result);
  return normalizeProfile(raw);
}

/**
 * Get comprehensive gamification dashboard data
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

  const raw = await errorHandling(result);
  return normalizeDashboard(raw);
}

/**
 * Get organization leaderboard
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

  const params = new URLSearchParams({
    limit: limit.toString(),
  });

  const result = await fetch(
    `${getAPIUrl()}gamification/leaderboard/${orgId}?${params}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );
  const data = await errorHandling(result);
  // Basic numeric safety for leaderboard entries
  if (data?.leaderboard_entries) {
    data.leaderboard_entries = data.leaderboard_entries.map((e: any) => ({
      ...e,
      total_xp: safeNumber(e.total_xp),
      current_level: safeNumber(e.current_level, 1),
    }));
  }
  return data;
}

/**
 * Award XP (idempotent)
 */
export async function awardXP(orgId: number, accessToken: string, payload: XPAwardRequest): Promise<XPAwardResponse> {
  if (!orgId) throw new Error('orgId required');
  if (!accessToken) throw new Error('access token required');
  if (!payload?.source) throw new Error('source required');

  // Backend expects query params (source, source_id, custom_amount) + idempotency via header.
  const idem = payload.idempotency_key || `xp_${payload.source}_${payload.source_id || 'generic'}_${Date.now()}`;
  const params = new URLSearchParams({ source: payload.source });
  if (payload.source_id) params.set('source_id', payload.source_id);
  if (payload.custom_amount !== null) params.set('custom_amount', String(payload.custom_amount));
  // metadata currently ignored (backend treats it as query param if provided) – send if simple
  if (payload.metadata && Object.keys(payload.metadata).length > 0) {
    try {
      params.set('metadata', encodeURIComponent(JSON.stringify(payload.metadata)));
    } catch {
      /* ignore serialization issues */
    }
  }

  const url = `${getAPIUrl()}gamification/award-xp/${orgId}?${params}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-Idempotency-Key': idem,
    },
    credentials: 'include',
  });
  const raw = await errorHandling(res);
  return normalizeAwardResponse(raw);
}

/**
 * Get gamification preferences
 */
export async function getGamificationPreferences(orgId: number, accessToken: string) {
  const res = await fetch(
    `${getAPIUrl()}gamification/preferences/${orgId}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken),
  );
  return errorHandling(res);
}

/**
 * Update gamification preferences
 */
export async function updateGamificationPreferences(orgId: number, accessToken: string, preferences: any) {
  const res = await fetch(
    `${getAPIUrl()}gamification/preferences/${orgId}`,
    RequestBodyWithAuthHeader('PUT', JSON.stringify({ preferences }), 'application/json', accessToken),
  );
  return errorHandling(res);
}

/**
 * Get XP sources metadata
 */
export async function getXPSourcesMetadata(): Promise<
  { key: string; label: string; description: string; default_xp: number; category: string }[]
> {
  const res = await fetch(`${getAPIUrl()}gamification/xp-sources`);
  const data = await errorHandling(res);
  return data.sources || [];
}

// Utility Functions

/**
 * Get level progression data from profile
 */
export function getLevelProgressionData(profile: GamificationProfile): {
  currentLevel: number;
  totalXP: number;
  progressPercent: number;
  xpToNextLevel: number;
  dailyXPEarned: number;
  dailyXPLimit: number;
  dailyGoalXP: number;
} {
  return {
    currentLevel: profile.current_level,
    totalXP: profile.total_xp,
    progressPercent: profile.level_progress_percent,
    xpToNextLevel: profile.xp_to_next_level,
    dailyXPEarned: profile.daily.xp_earned,
    dailyXPLimit: profile.daily.xp_limit,
    dailyGoalXP: profile.daily.goal_xp,
  };
}

/**
 * Calculate level progress percentage
 */
export function calculateLevelProgress(profile: GamificationProfile): number {
  return Math.max(0, Math.min(100, profile.level_progress_percent || 0));
}

/**
 * Get display name for XP source
 */
export function getXPSourceDisplayName(source: string): string {
  // Runtime-populated cache
  if (!(globalThis as any).__xpSourceMetaCache) {
    (globalThis as any).__xpSourceMetaCache = { loaded: false, map: {} as Record<string, string> };
  }
  const cache = (globalThis as any).__xpSourceMetaCache as { loaded: boolean; map: Record<string, string> };

  // Load cache if not loaded
  if (!cache.loaded) {
    cache.loaded = true;
    fetch(`${getAPIUrl()}gamification/xp-sources`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.sources) {
          for (const s of data.sources as any[]) {
            cache.map[s.key] = s.label;
          }
        }
      })
      .catch(() => {});
  }

  if (cache.map[source]) return cache.map[source];

  return source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format XP amount with appropriate signs and formatting
 */
export function formatXPAmount(amount: number, locale?: string): string {
  const sign = amount > 0 ? '+' : '';
  const formattedNumber = locale ? amount.toLocaleString(locale) : amount.toLocaleString();
  return `${sign}${formattedNumber} XP`;
}

/**
 * Check if a streak is at risk
 */
export function isStreakAtRisk(lastActivityDate: string | null): boolean {
  if (!lastActivityDate) return false;

  try {
    const lastDate = new Date(lastActivityDate);
    const today = new Date();

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
 */
export function getStreakStatus(lastActivityDate: string | null): StreakStatus {
  if (!lastActivityDate) return 'none';

  try {
    const lastDate = new Date(lastActivityDate);
    const today = new Date();

    if (Number.isNaN(lastDate.getTime())) {
      throw new Error('Invalid date');
    }

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
