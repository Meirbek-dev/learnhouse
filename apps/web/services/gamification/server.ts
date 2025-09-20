// Server-only data fetchers with Next.js cache tags (simplified)

import type { DashboardData, OrganizationLeaderboard, UserGamificationProfile } from '@/types/gamification';
import { getAPIUrl } from '@/services/config/config';
import { auth } from '@/auth';

async function requireAccessToken(): Promise<string> {
  const session = await auth();
  const token = (session as any)?.tokens?.access_token as string | undefined;
  if (!token) throw new Error('Authentication required');
  return token;
}

export async function getServerGamificationProfile(
  orgId: number,
  opts?: { revalidate?: number; tags?: string[] },
): Promise<UserGamificationProfile> {
  const accessToken = await requireAccessToken();
  // Use simplified unified endpoint and extract profile
  const res = await fetch(`${getAPIUrl()}simple-gamification/dashboard/${orgId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    next: {
      revalidate: opts?.revalidate ?? 30,
      tags: opts?.tags ?? [`gamification:profile:${orgId}`],
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch profile: ${res.status}`);
  const json = await res.json();

  // Transform API response to frontend UserGamificationProfile type (aligned with new types)
  const p = json?.profile ?? json; // support both dashboard payload and direct profile (if ever used)
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
  opts?: { revalidate?: number; tags?: string[] },
): Promise<DashboardData> {
  const accessToken = await requireAccessToken();
  const res = await fetch(`${getAPIUrl()}simple-gamification/dashboard/${orgId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    next: {
      revalidate: opts?.revalidate ?? 30,
      tags: opts?.tags ?? [`gamification:dashboard:${orgId}`, `gamification:profile:${orgId}`],
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch dashboard: ${res.status}`);
  const json = await res.json();

  // Transform the backend dashboard data to match the frontend DashboardData interface
  const dashboardData: DashboardData = {
    profile: {
      id: Number(json.profile?.id) || 0,
      user_id: Number(json.profile?.user_id) || 0,
      org_id: Number(json.profile?.org_id) || 0,
      total_xp: Number(json.profile?.total_xp) || 0,
      level: Number(json.profile?.level) || 1,
      login_streak: Number(json.profile?.login_streak) || 0,
      learning_streak: Number(json.profile?.learning_streak) || 0,
      longest_login_streak: Number(json.profile?.longest_login_streak) || 0,
      longest_learning_streak: Number(json.profile?.longest_learning_streak) || 0,
      total_activities_completed: Number(json.profile?.total_activities_completed) || 0,
      total_courses_completed: Number(json.profile?.total_courses_completed) || 0,
      daily_xp_earned: Number(json.profile?.daily_xp_earned) || 0,
      xp_to_next_level: json.profile?.xp_to_next_level ?? undefined,
      level_progress_percent: json.profile?.level_progress_percent ?? undefined,
      xp_in_current_level: json.profile?.xp_in_current_level ?? undefined,
      last_xp_award_date: json.profile?.last_xp_award_date ?? null,
      last_login_date: json.profile?.last_login_date ?? null,
      last_learning_date: json.profile?.last_learning_date ?? null,
      created_at: json.profile?.created_at || new Date().toISOString(),
      updated_at: json.profile?.updated_at || new Date().toISOString(),
      preferences: json.profile?.preferences || {},
    },
    recent_transactions: (json.recent_transactions || []).map((tx: any) => ({
      id: tx?.id?.toString() || '0',
      user_id: tx?.user_id?.toString() || '0',
      organization_id: tx?.org_id?.toString() || tx?.organization_id?.toString() || '0',
      amount: tx?.xp_amount ?? tx?.amount ?? 0,
      activity_type: tx?.source ?? tx?.activity_type ?? 'unknown',
      activity_id: tx?.source_id?.toString() || tx?.activity_id?.toString() || undefined,
      reason: tx?.reason || undefined,
      created_at: tx?.created_at || new Date().toISOString(),
    })),
    leaderboard: {
      entries: (json.leaderboard?.entries || []).map((entry: any, index: number) => ({
        rank: entry?.rank || index + 1,
        user_id: Number(entry?.user_id) || 0,
        total_xp: entry?.total_xp || 0,
        current_level: entry?.level || 1,
        level: entry?.level || 1,
        username: entry?.username || entry?.user?.username || null,
      })),
    },
    streak_info: {
      current_streak: json.streak_info?.current_streak || 0,
      longest_streak: json.streak_info?.longest_streak || 0,
      last_activity: json.streak_info?.last_activity || null,
    },
  };

  return dashboardData;
}

export async function getServerOrganizationLeaderboard(
  orgId: number,
  limit = 20,
  opts?: { revalidate?: number; tags?: string[] },
): Promise<OrganizationLeaderboard> {
  const accessToken = await requireAccessToken();
  // Use the unified dashboard endpoint and extract leaderboard
  const res = await fetch(`${getAPIUrl()}simple-gamification/dashboard/${orgId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
    next: {
      revalidate: opts?.revalidate ?? 30,
      tags: opts?.tags ?? [`gamification:leaderboard:${orgId}`, `gamification:dashboard:${orgId}`],
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch leaderboard: ${res.status}`);
  const json = await res.json();

  const entries = (json?.leaderboard?.entries ?? []) as any[];
  const limited = entries.slice(0, Math.max(0, limit));

  const transformedLeaderboard: OrganizationLeaderboard = {
    entries: limited.map((entry: any, index: number) => ({
      user_id: Number(entry.user_id) || 0,
      total_xp: entry.total_xp || 0,
      level: entry.level || entry.current_level || 1,
      current_level: entry.current_level || entry.level || 1,
      rank: entry.rank || index + 1,
      username: entry.username || entry.user?.username || null,
    })),
  };

  return transformedLeaderboard;
}
