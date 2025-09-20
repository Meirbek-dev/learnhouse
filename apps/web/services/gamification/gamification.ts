import type {
  DashboardData,
  OrganizationLeaderboard,
  StreakUpdate,
  UserGamificationProfile,
  XPAwardRequest,
  XPAwardResponse,
} from '@/types/gamification';
import {
  DashboardDataSchema,
  OrganizationLeaderboardSchema,
  StreakUpdateSchema,
  XPAwardResponseSchema,
} from '@/types/gamification';
import { RequestBodyWithAuthHeader, errorHandling } from '@/services/utils/ts/requests';
import { getAPIUrl } from '@/services/config/config';

/**
 * Get user's gamification profile for an organization
 */
export async function getGamificationProfile(orgId: number, accessToken: string): Promise<UserGamificationProfile> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  // Use simplified unified endpoint and extract profile
  const url = `${getAPIUrl()}simple-gamification/dashboard/${orgId}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, accessToken) as RequestInit);
  const data = await errorHandling(res);
  // The simplified dashboard returns { profile, ... }
  return data.profile as UserGamificationProfile;
}

/**
 * Get user's gamification dashboard (profile + recent transactions)
 */
export async function getGamificationDashboard(orgId: number, accessToken: string): Promise<DashboardData> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  const url = `${getAPIUrl()}simple-gamification/dashboard/${orgId}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, accessToken) as RequestInit);
  const data = await errorHandling(res);

  // Normalize backend payload to match frontend schemas
  const normalized: DashboardData = {
    profile: data.profile as UserGamificationProfile,
    recent_transactions: (data.recent_transactions || []).map((tx: any) => ({
      id: String(tx.id),
      user_id: String(tx.user_id),
      organization_id: String(tx.org_id),
      amount: Number(tx.amount),
      activity_type: tx.source,
      activity_id: tx.source_id ?? undefined,
      created_at: tx.created_at,
    })),
    leaderboard: {
      entries: (data.leaderboard?.entries || []).map((e: any) => ({
        rank: e.rank,
        user_id: Number(e.user_id),
        total_xp: Number(e.total_xp),
        level: Number(e.level),
        current_level: Number(e.level),
        username: e.username ?? null,
      })),
    },
    user_rank: data.user_rank,
    streak_info: {
      current_streak: data.streak_info.current_streak,
      longest_streak: data.streak_info.longest_streak,
      last_activity: data.streak_info.last_activity,
    },
  };

  const parsed = DashboardDataSchema.safeParse(normalized);
  if (!parsed.success) {
    console.error('Invalid dashboard data:', parsed.error);
    throw new Error('Invalid dashboard data received');
  }

  return parsed.data;
}

/**
 * Get organization leaderboard
 */
export async function getOrganizationLeaderboard(
  orgId: number,
  accessToken: string,
  limit: number = 10,
): Promise<OrganizationLeaderboard> {
  if (!orgId || orgId <= 0) {
    throw new Error('Invalid organization ID');
  }
  if (!accessToken) {
    throw new Error('Access token is required');
  }

  // Fetch from unified dashboard and extract leaderboard
  const url = `${getAPIUrl()}simple-gamification/dashboard/${orgId}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, accessToken) as RequestInit);
  const data = await errorHandling(res);

  const shaped = {
    entries: (data.leaderboard?.entries || []).slice(0, limit).map((e: any) => ({
      user_id: Number(e.user_id),
      total_xp: Number(e.total_xp),
      level: Number(e.level),
      current_level: Number(e.level),
      rank: e.rank,
      username: e.username ?? null,
    })),
  };

  const parsed = OrganizationLeaderboardSchema.safeParse(shaped);
  if (!parsed.success) {
    console.error('Invalid leaderboard data:', parsed.error);
    throw new Error('Invalid leaderboard data received');
  }

  return parsed.data;
}

/**
 * Award XP to the current user
 */
export async function awardXP(orgId: number, accessToken: string, payload: XPAwardRequest): Promise<XPAwardResponse> {
  if (!orgId) throw new Error('orgId required');
  if (!accessToken) throw new Error('access token required');
  if (!payload?.source) throw new Error('source required');

  const url = `${getAPIUrl()}simple-gamification/award-xp/${orgId}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('POST', payload, null, accessToken) as RequestInit);
  const data = await errorHandling(res);

  const parsed = XPAwardResponseSchema.safeParse(data);
  if (!parsed.success) {
    console.error('Invalid XP award response:', parsed.error);
    throw new Error('Invalid XP award response received');
  }

  // Trigger client-side cache revalidation
  try {
    fetch('/api/revalidate/gamification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    }).catch(() => {}); // Silent fail
  } catch {}

  return parsed.data;
}

/**
 * Update login streak
 */
export async function updateLoginStreak(orgId: number, accessToken: string): Promise<StreakUpdate> {
  const url = `${getAPIUrl()}simple-gamification/update-streak/${orgId}`;
  // Simplified endpoint expects { streak_type: 'login' }
  const res = await fetch(
    url,
    RequestBodyWithAuthHeader('POST', { streak_type: 'login' }, null, accessToken) as RequestInit,
  );
  const data = await errorHandling(res);

  const parsed = StreakUpdateSchema.safeParse(data);
  if (!parsed.success) {
    console.error('Invalid streak update response:', parsed.error);
    throw new Error('Invalid streak update response received');
  }

  return parsed.data;
}

/**
 * Update learning streak
 */
export async function updateLearningStreak(orgId: number, accessToken: string): Promise<StreakUpdate> {
  const url = `${getAPIUrl()}simple-gamification/update-streak/${orgId}`;
  const res = await fetch(
    url,
    RequestBodyWithAuthHeader('POST', { streak_type: 'learning' }, null, accessToken) as RequestInit,
  );
  const data = await errorHandling(res);

  const parsed = StreakUpdateSchema.safeParse(data);
  if (!parsed.success) {
    console.error('Invalid streak update response:', parsed.error);
    throw new Error('Invalid streak update response received');
  }

  return parsed.data;
}

/**
 * Get gamification preferences
 */
export async function getGamificationPreferences(orgId: number, accessToken: string): Promise<Record<string, any>> {
  const res = await fetch(
    `${getAPIUrl()}simple-gamification/preferences/${orgId}`,
    RequestBodyWithAuthHeader('GET', null, null, accessToken) as RequestInit,
  );
  const data = await errorHandling(res);
  return (data?.preferences as Record<string, any>) ?? {};
}

/**
 * Update gamification preferences
 */
export async function updateGamificationPreferences(
  orgId: number,
  accessToken: string,
  preferences: Record<string, any>,
): Promise<Record<string, any>> {
  const res = await fetch(
    `${getAPIUrl()}simple-gamification/preferences/${orgId}`,
    RequestBodyWithAuthHeader('PUT', { preferences }, null, accessToken) as RequestInit,
  );
  const data = await errorHandling(res);
  return (data?.preferences as Record<string, any>) ?? preferences;
}

/**
 * Get XP sources metadata
 */
export async function getXPSourcesMetadata(): Promise<
  { key: string; label: string; description: string; default_xp: number; category: string }[]
> {
  const res = await fetch(`${getAPIUrl()}simple-gamification/config`);
  const data = await errorHandling(res);
  return data.xp_sources;
}

/**
 * Get gamification configuration
 */
export async function getGamificationConfig() {
  const res = await fetch(`${getAPIUrl()}simple-gamification/config`);
  return errorHandling(res);
}

// Utility Functions

/**
 * Get level progression data from profile
 */
export function getLevelProgressionData(profile: UserGamificationProfile): {
  currentLevel: number;
  totalXP: number;
  progressPercent: number;
  xpToNextLevel: number;
  xpInLevel?: number;
} {
  return {
    currentLevel: profile.level,
    totalXP: profile.total_xp,
    progressPercent: profile.level_progress_percent ?? 0,
    xpToNextLevel: profile.xp_to_next_level ?? 0,
    xpInLevel: profile.xp_in_current_level ?? 0,
  };
}

/**
 * Format XP amount for display
 */
export function formatXP(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M XP`;
  }
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}K XP`;
  }
  return `${amount} XP`;
}

/**
 * Get XP source display name
 */
// XP Source metadata cache (module-level)
let _xpSourceMetaCache: Record<
  string,
  { label: string; description: string; default_xp: number; category: string }
> | null = null;
let _xpSourceMetaPromise: Promise<
  Record<string, { label: string; description: string; default_xp: number; category: string }>
> | null = null;

async function ensureXPSourcesMetadata(): Promise<
  Record<string, { label: string; description: string; default_xp: number; category: string }>
> {
  if (_xpSourceMetaCache) return _xpSourceMetaCache;
  if (_xpSourceMetaPromise) return _xpSourceMetaPromise;
  _xpSourceMetaPromise = (async () => {
    try {
      const meta = await getXPSourcesMetadata();
      _xpSourceMetaCache = meta.reduce(
        (acc, m) => {
          acc[m.key] = {
            label: m.label,
            description: m.description,
            default_xp: m.default_xp,
            category: m.category,
          };
          return acc;
        },
        {} as Record<string, { label: string; description: string; default_xp: number; category: string }>,
      );
      return _xpSourceMetaCache;
    } catch {
      // Silent fail, keep null so we can retry later
      _xpSourceMetaCache = {} as Record<
        string,
        { label: string; description: string; default_xp: number; category: string }
      >;
      return _xpSourceMetaCache;
    } finally {
      _xpSourceMetaPromise = null;
    }
  })();
  return _xpSourceMetaPromise;
}

export async function getXPSourceDisplayName(source: string): Promise<string> {
  const meta = await ensureXPSourcesMetadata();
  const entry = meta?.[source];
  if (entry?.label) return entry.label;
  return source.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Calculate level progression data
 */
