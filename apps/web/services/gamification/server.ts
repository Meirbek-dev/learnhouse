// Server-only data fetchers with Next.js cache tags (simplified)

import type { DashboardData, OrganizationLeaderboard, UserGamificationProfile } from '@/types/gamification';
import { extractStreakInfo } from '@/types/gamification/profile';
import { getAPIUrl } from '@/services/config/config';
import { gamificationTags } from '@/lib/cacheTags';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';

interface GamificationFetchOptions {
  revalidate?: number | null;
  tags?: string[];
  cache?: RequestCache | null;
}

type RawDashboardResponse = {
  profile?: Record<string, unknown>;
  recent_transactions?: unknown[];
  user_rank?: number | null;
  leaderboard?: RawLeaderboardResponse | null;
};

type RawLeaderboardResponse = {
  entries?: unknown[];
  total_participants?: unknown;
  last_updated?: unknown;
};

const nowISO = () => new Date().toISOString();

const numberOr = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const stringOrNull = (value: unknown) => (typeof value === 'string' ? value : null);

const recordOrEmpty = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

function normalizeProfile(payload: Record<string, unknown> | undefined): UserGamificationProfile | null {
  if (!payload) return null;
  const createdAt = stringOrNull(payload.created_at) ?? nowISO();
  const updatedAt = stringOrNull(payload.updated_at) ?? createdAt;

  const profile: UserGamificationProfile = {
    id: payload.id !== undefined ? numberOr(payload.id) : undefined,
    user_id: numberOr(payload.user_id),
    org_id: numberOr(payload.org_id),
    total_xp: Math.max(0, numberOr(payload.total_xp)),
    level: Math.max(1, numberOr(payload.level, 1)),
    login_streak: Math.max(0, numberOr(payload.login_streak)),
    learning_streak: Math.max(0, numberOr(payload.learning_streak)),
    longest_login_streak: Math.max(0, numberOr(payload.longest_login_streak)),
    longest_learning_streak: Math.max(0, numberOr(payload.longest_learning_streak)),
    total_activities_completed: Math.max(0, numberOr(payload.total_activities_completed)),
    total_courses_completed: Math.max(0, numberOr(payload.total_courses_completed)),
    daily_xp_earned: Math.max(0, numberOr(payload.daily_xp_earned)),
    xp_to_next_level: payload.xp_to_next_level !== undefined ? numberOr(payload.xp_to_next_level) : undefined,
    level_progress_percent:
      payload.level_progress_percent !== undefined ? numberOr(payload.level_progress_percent) : undefined,
    xp_in_current_level: payload.xp_in_current_level !== undefined ? numberOr(payload.xp_in_current_level) : undefined,
    last_xp_award_date: stringOrNull(payload.last_xp_award_date),
    last_login_date: stringOrNull(payload.last_login_date),
    last_learning_date: stringOrNull(payload.last_learning_date),
    created_at: createdAt,
    updated_at: updatedAt,
    preferences: recordOrEmpty(payload.preferences),
  };

  return profile;
}

function normalizeTransactions(transactions: unknown[] | undefined) {
  const fallbackDate = nowISO();
  return (Array.isArray(transactions) ? transactions : []).map((tx) => {
    const transaction = tx as Record<string, unknown>;
    return {
      id: numberOr(transaction.id),
      user_id: numberOr(transaction.user_id),
      org_id: numberOr(transaction.org_id),
      amount: numberOr(transaction.amount),
      source: typeof transaction.source === 'string' ? transaction.source : 'unknown',
      source_id: transaction.source_id ?? null,
      triggered_level_up: Boolean(transaction.triggered_level_up),
      previous_level: numberOr(transaction.previous_level),
      created_at: stringOrNull(transaction.created_at) ?? fallbackDate,
    };
  });
}

function normalizeLeaderboard(payload?: RawLeaderboardResponse | null): OrganizationLeaderboard {
  const fallbackDate = nowISO();
  const entries = Array.isArray(payload?.entries) ? payload?.entries : [];
  return {
    entries: entries.map((entry, index) => {
      const data = entry as Record<string, unknown>;
      return {
        user_id: numberOr(data.user_id),
        total_xp: Math.max(0, numberOr(data.total_xp)),
        level: Math.max(1, numberOr(data.level, 1)),
        rank: Math.max(1, numberOr(data.rank, index + 1)),
        username: typeof data.username === 'string' ? data.username : null,
        first_name: 'first_name' in data ? ((data.first_name as string | null) ?? null) : null,
        last_name: 'last_name' in data ? ((data.last_name as string | null) ?? null) : null,
        avatar_url: 'avatar_url' in data ? ((data.avatar_url as string | null) ?? null) : null,
        rank_change: typeof data.rank_change === 'number' ? data.rank_change : undefined,
      };
    }),
    total_participants: Math.max(0, numberOr(payload?.total_participants)),
    last_updated: stringOrNull(payload?.last_updated) ?? fallbackDate,
  };
}

/**
 * Get access token from session without throwing
 * Returns null if no session or error occurs
 */
async function getAccessToken(): Promise<string | null> {
  try {
    const session = await auth();
    const token = (session as any)?.tokens?.access_token as string | undefined;
    return token || null;
  } catch {
    // Silently fail for unauthorized users - this is expected behavior
    return null;
  }
}

async function requireAccessToken(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('Authentication required');
  return token;
}

function buildCacheOptions(
  orgId: number,
  opts: GamificationFetchOptions | undefined,
  fallbackRevalidate: number,
): { next?: Record<string, any>; cache?: RequestCache } {
  const next: Record<string, any> = {};
  const tags = opts?.tags ?? gamificationTags(orgId);
  if (tags?.length) {
    next.tags = tags;
  }

  let cache: RequestCache | undefined;
  if (opts?.cache) {
    cache = opts.cache;
  }

  // Only set revalidate if cache is not 'no-store'
  if (cache !== 'no-store') {
    const revalidate = opts?.revalidate;
    if (revalidate !== undefined && revalidate !== null) {
      const parsed = Number(revalidate);
      if (Number.isFinite(parsed) && parsed > 0) {
        next.revalidate = parsed;
      } else {
        cache = 'no-store';
      }
    } else if (fallbackRevalidate > 0) {
      next.revalidate = fallbackRevalidate;
    }
  }

  if (Object.keys(next).length === 0) {
    return cache ? { cache } : {};
  }

  return cache ? { next, cache } : { next };
}
/**
 * Fetch unified gamification data from API
 * Returns null if user is not authenticated or if fetch fails
 */
async function getUnifiedServerData(
  orgId: number,
  opts?: GamificationFetchOptions,
): Promise<RawDashboardResponse | null> {
  // Check if user is authenticated first
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null; // Expected: user not authenticated
  }

  try {
    // New unified endpoint returns DashboardRead (profile + recent_transactions)
    const { next, cache } = buildCacheOptions(orgId, opts, 30);
    const fetchOptions: RequestInit & { next?: Record<string, any> } = {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    if (cache) {
      fetchOptions.cache = cache;
    }
    if (next) {
      fetchOptions.next = next;
    }
    const res = await fetch(`${getAPIUrl()}gamification/${orgId}`, fetchOptions);

    if (!res.ok) {
      // Don't log for auth errors (expected for unauthorized users)
      if (res.status === 401 || res.status === 403) {
        return null;
      }
      // Log unexpected errors but still return null to prevent crashes
      console.error(`Failed to fetch gamification data: ${res.status}`);
      return null;
    }
    return res.json();
  } catch (error) {
    // Only log if it's not a network error (which can happen when API is down)
    if (error instanceof Error && !error.message.includes('fetch')) {
      console.error('Error fetching gamification data:', error);
    }
    return null;
  }
}

export async function getServerGamificationProfile(
  orgId: number,
  opts?: GamificationFetchOptions,
): Promise<UserGamificationProfile | null> {
  const json = await getUnifiedServerData(orgId, opts);

  // Return null if no data (unauthorized or error)
  if (!json) {
    return null;
  }

  return normalizeProfile((json.profile ?? json) as Record<string, unknown> | undefined);
}

export async function getServerGamificationDashboard(
  orgId: number,
  opts?: GamificationFetchOptions,
): Promise<DashboardData | null> {
  const json = await getUnifiedServerData(orgId, opts);

  // Return null if no data (unauthorized or error)
  if (!json) {
    return null;
  }

  const profile = normalizeProfile(json.profile as Record<string, unknown> | undefined);
  if (!profile) {
    return null;
  }

  const userRank = json.user_rank === null || json.user_rank === undefined ? null : numberOr(json.user_rank);

  const dashboardData: DashboardData = {
    profile,
    recent_transactions: normalizeTransactions(json.recent_transactions),
    leaderboard: normalizeLeaderboard(json.leaderboard),
    user_rank: userRank,
    streak_info: extractStreakInfo(profile),
  };

  return dashboardData;
}

/**
 * Fetch organization leaderboard
 * Returns null if user is not authenticated or if fetch fails
 */
export async function getServerOrganizationLeaderboard(
  orgId: number,
  limit = 20,
  opts?: GamificationFetchOptions,
): Promise<OrganizationLeaderboard | null> {
  // Check if user is authenticated first
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null; // Expected: user not authenticated
  }

  try {
    const { next, cache } = buildCacheOptions(orgId, opts, 30);
    const fetchOptions: RequestInit & { next?: Record<string, any> } = {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    };
    if (cache) {
      fetchOptions.cache = cache;
    }
    if (next) {
      fetchOptions.next = next;
    }
    const res = await fetch(
      `${getAPIUrl()}gamification/${orgId}/leaderboard?limit=${encodeURIComponent(String(limit))}`,
      fetchOptions,
    );

    if (!res.ok) {
      // Don't log for auth errors (expected for unauthorized users)
      if (res.status === 401 || res.status === 403) {
        return null;
      }
      // Log unexpected errors but return null
      console.error(`Failed to fetch leaderboard: ${res.status}`);
      return null;
    }

    const json = (await res.json()) as RawLeaderboardResponse;
    return normalizeLeaderboard(json);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return null;
  }
}

// Server-only revalidation utility after successful mutations
export async function revalidateGamificationTags(orgId: number) {
  if (!orgId) return;
  for (const tag of gamificationTags(orgId)) {
    // Match Next.js typings: second argument is profile string or CacheLifeConfig
    await revalidateTag(tag, { expire: 0 });
  }
}

// Server-side mutation helpers
export async function awardXPOnServer(orgId: number, payload: Record<string, any>) {
  const accessToken = await requireAccessToken();
  const body = {
    source: payload.source,
    source_id: payload.source_id,
    custom_amount: payload.custom_amount ?? payload.amount,
    idempotency_key: payload.idempotency_key,
  };
  const res = await fetch(`${getAPIUrl()}gamification/${orgId}/xp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to award XP: ${res.status}`);
  const json = await res.json();
  await revalidateGamificationTags(orgId);
  return json;
}

export async function updateStreakOnServer(orgId: number, type: 'login' | 'learning') {
  const accessToken = await requireAccessToken();
  const res = await fetch(`${getAPIUrl()}gamification/${orgId}/streaks/${encodeURIComponent(type)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) throw new Error(`Failed to update streak: ${res.status}`);
  const json = await res.json();
  await revalidateGamificationTags(orgId);
  return json;
}

export async function updatePreferencesOnServer(orgId: number, preferences: Record<string, any>) {
  const accessToken = await requireAccessToken();
  const res = await fetch(`${getAPIUrl()}gamification/${orgId}/preferences`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preferences),
  });
  if (!res.ok) throw new Error(`Failed to update preferences: ${res.status}`);
  const json = await res.json();
  await revalidateGamificationTags(orgId);
  return json;
}
