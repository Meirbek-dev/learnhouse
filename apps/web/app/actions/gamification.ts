'use server';

import {
  awardXPOnServer,
  getServerGamificationDashboard,
  getServerOrganizationLeaderboard,
  revalidateGamificationTags,
  updatePreferencesOnServer,
  updateStreakOnServer,
} from '@/services/gamification/server';
import type { DashboardData, OrganizationLeaderboard, XPAwardResponse } from '@/types/gamification';

export async function getDashboardDataAction(orgId: number): Promise<DashboardData | null> {
  if (!orgId) return null;
  const data = await getServerGamificationDashboard(orgId, { revalidate: 0 });
  return data ?? null;
}

export async function getLeaderboardAction(orgId: number, limit = 20): Promise<OrganizationLeaderboard | null> {
  if (!orgId) return null;
  const data = await getServerOrganizationLeaderboard(orgId, limit, { revalidate: 0 });
  return data ?? null;
}

export async function awardXPAction(orgId: number, payload: Record<string, any>): Promise<XPAwardResponse> {
  const result = await awardXPOnServer(orgId, payload);
  await revalidateGamificationTags(orgId);
  return result as XPAwardResponse;
}

export async function updateStreakAction(orgId: number, type: 'login' | 'learning') {
  const result = await updateStreakOnServer(orgId, type);
  await revalidateGamificationTags(orgId);
  return result;
}

export async function updatePreferencesAction(orgId: number, preferences: Record<string, any>) {
  const result = await updatePreferencesOnServer(orgId, preferences);
  await revalidateGamificationTags(orgId);
  return result;
}
