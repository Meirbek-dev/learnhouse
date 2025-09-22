import {
  awardXPOnServer,
  getServerGamificationDashboard,
  getServerOrganizationLeaderboard,
  revalidateGamificationTags,
  updatePreferencesOnServer,
  updateStreakOnServer,
} from '@/services/gamification/server';
import { NextResponse, NextRequest } from 'next/server';

export async function GET(_req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  const params = await context.params;
  const orgId = Number(params.orgId);
  if (!orgId) return NextResponse.json({ error: 'Invalid orgId' }, { status: 400 });
  try {
    const [dashboard, leaderboard] = await Promise.all([
      getServerGamificationDashboard(orgId, { revalidate: 0 }),
      getServerOrganizationLeaderboard(orgId, 20, { revalidate: 0 }),
    ]);
    return NextResponse.json({ dashboard, leaderboard });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ orgId: string }> }) {
  const params = await context.params;
  const orgId = Number(params.orgId);
  if (!orgId) return NextResponse.json({ error: 'Invalid orgId' }, { status: 400 });
  try {
    const body = await req.json();
    const { action, ...payload } = body || {};
    if (action === 'award_xp') {
      const result = await awardXPOnServer(orgId, payload);
      await revalidateGamificationTags(orgId);
      return NextResponse.json(result);
    }
    if (action === 'update_streak') {
      const result = await updateStreakOnServer(orgId, payload?.streak_type);
      await revalidateGamificationTags(orgId);
      return NextResponse.json(result);
    }
    if (action === 'update_preferences') {
      const result = await updatePreferencesOnServer(orgId, payload?.preferences || {});
      await revalidateGamificationTags(orgId);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Action failed' }, { status: 500 });
  }
}
