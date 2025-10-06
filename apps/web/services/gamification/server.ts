// Server-only data fetchers with Next.js cache tags (simplified)

import type { DashboardData, OrganizationLeaderboard, UserGamificationProfile } from '@/types/gamification';
import { getAPIUrl } from '@/services/config/config';
import { gamificationTags } from '@/lib/cacheTags';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';

interface GamificationFetchOptions {
  revalidate?: number | null;
  tags?: string[];
  cache?: RequestCache | null;
}

async function requireAccessToken(): Promise<string> {
  const session = await auth();
  const token = (session as any)?.tokens?.access_token as string | undefined;
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
async function getUnifiedServerData(orgId: number, opts?: GamificationFetchOptions) {
  const accessToken = await requireAccessToken();
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

  if (!res.ok) throw new Error(`Failed to fetch gamification data: ${res.status}`);
  return res.json();
}

export async function getServerGamificationProfile(
  orgId: number,
  opts?: GamificationFetchOptions,
): Promise<UserGamificationProfile> {
  const json = await getUnifiedServerData(orgId, opts);

  // Transform API response to frontend UserGamificationProfile type
  const p = json?.profile ?? json;
  const profile: UserGamificationProfile = {
    id: Number(p.id) || 0,
    user_id: Number(p.user_id) || 0,
    org_id: Number(p.org_id) || 0,
    total_xp: Number(p.total_xp) || 0,
    level: Number(p.level) || 1,
    login_streak: Number(p.login_streak) || 0,
    learning_streak: Number(p.learning_streak) || 0,
    longest_login_streak: Number(p.longest_login_streak) || 0,
    longest_learning_streak: Number(p.longest_learning_streak) || 0,
    total_activities_completed: Number(p.total_activities_completed) || 0,
    total_courses_completed: Number(p.total_courses_completed) || 0,
    daily_xp_earned: Number(p.daily_xp_earned) || 0,
    xp_to_next_level: p.xp_to_next_level ?? undefined,
    level_progress_percent: p.level_progress_percent ?? undefined,
    xp_in_current_level: p.xp_in_current_level ?? undefined,
    last_xp_award_date: p.last_xp_award_date ?? null,
    last_login_date: p.last_login_date ?? null,
    last_learning_date: p.last_learning_date ?? null,
    created_at: p.created_at,
    updated_at: p.updated_at,
    preferences: p.preferences || {},
  };

  return profile;
}

export async function getServerGamificationDashboard(
  orgId: number,
  opts?: GamificationFetchOptions,
): Promise<DashboardData> {
  const json = await getUnifiedServerData(orgId, opts);

  // Transform backend DashboardRead (profile + recent_transactions)
  const profile = json.profile ?? {};
  const dashboardData: DashboardData = {
    profile: {
      id: Number(profile.id) || 0,
      user_id: Number(profile.user_id) || 0,
      org_id: Number(profile.org_id) || 0,
      total_xp: Number(profile.total_xp) || 0,
      level: Number(profile.level) || 1,
      login_streak: Number(profile.login_streak) || 0,
      learning_streak: Number(profile.learning_streak) || 0,
      longest_login_streak: Number(profile.longest_login_streak) || 0,
      longest_learning_streak: Number(profile.longest_learning_streak) || 0,
      total_activities_completed: Number(profile.total_activities_completed) || 0,
      total_courses_completed: Number(profile.total_courses_completed) || 0,
      daily_xp_earned: Number(profile.daily_xp_earned) || 0,
      xp_to_next_level: profile.xp_to_next_level ?? undefined,
      level_progress_percent: profile.level_progress_percent ?? undefined,
      xp_in_current_level: profile.xp_in_current_level ?? undefined,
      last_xp_award_date: profile.last_xp_award_date ?? null,
      last_login_date: profile.last_login_date ?? null,
      last_learning_date: profile.last_learning_date ?? null,
      created_at: profile.created_at || new Date().toISOString(),
      updated_at: profile.updated_at || new Date().toISOString(),
      preferences: profile.preferences || {},
    },
    recent_transactions: (json.recent_transactions || []).map((tx: any) => ({
      id: Number(tx?.id) || 0,
      user_id: Number(tx?.user_id) || 0,
      org_id: Number(tx?.org_id) || 0,
      amount: Number(tx?.amount) || 0,
      source: String(tx?.source ?? 'unknown'),
      source_id: tx?.source_id ?? null,
      triggered_level_up: Boolean(tx?.triggered_level_up ?? false),
      previous_level: Number(tx?.previous_level ?? 0),
      created_at: tx?.created_at || new Date().toISOString(),
    })),
    // Keep API stable: fill optional derived sections with sane defaults
    leaderboard: {
      entries: [],
      total_participants: 0,
      last_updated: new Date().toISOString(),
    },
    user_rank: (() => {
      return json.user_rank !== undefined && json.user_rank !== null ? Number(json.user_rank) : null;
    })(),
    streak_info: {
      login: {
        current: Number(profile.login_streak) || 0,
        longest: Number(profile.longest_login_streak) || 0,
        lastDate: profile.last_login_date ?? null,
      },
      learning: {
        current: Number(profile.learning_streak) || 0,
        longest: Number(profile.longest_learning_streak) || 0,
        lastDate: profile.last_learning_date ?? null,
      },
    },
  };

  return dashboardData;
}

export async function getServerOrganizationLeaderboard(
  orgId: number,
  limit = 20,
  opts?: GamificationFetchOptions,
): Promise<OrganizationLeaderboard> {
  const accessToken = await requireAccessToken();
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
  if (!res.ok) throw new Error(`Failed to fetch leaderboard: ${res.status}`);
  const json = await res.json();

  const transformed: OrganizationLeaderboard = {
    entries: (json?.entries ?? []).map((entry: any, index: number) => ({
      user_id: Number(entry.user_id) || 0,
      total_xp: Number(entry.total_xp) || 0,
      level: Number(entry.level) || 1,
      rank: Number(entry.rank ?? index + 1),
      username: entry.username ?? null,
      first_name: entry.first_name ?? null,
      last_name: entry.last_name ?? null,
      avatar_url: entry.avatar_url ?? null,
      rank_change: entry.rank_change,
    })),
    total_participants: Number(json?.total_participants) || 0,
    last_updated: json?.last_updated || new Date().toISOString(),
  };
  return transformed;
}

// Server-only revalidation utility after successful mutations
export async function revalidateGamificationTags(orgId: number) {
  if (!orgId) return;
  for (const tag of gamificationTags(orgId)) {
    revalidateTag(tag);
  }
}

// Server-side mutation helpers
export async function awardXPOnServer(orgId: number, payload: Record<string, any>) {
  const accessToken = await requireAccessToken();
  const body = {
    source: payload.source,
    source_id: payload.source_id,
    amount: payload.amount ?? payload.custom_amount,
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
