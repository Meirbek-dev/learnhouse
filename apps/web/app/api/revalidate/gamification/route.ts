import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(request: Request) {
  try {
    const { orgId } = await request.json();
    if (!orgId || typeof orgId !== 'number') {
      return NextResponse.json({ ok: false, error: 'orgId required' }, { status: 400 });
    }
    // Revalidate common gamification tags for this org
    revalidateTag(`gamification:profile:${orgId}`);
    revalidateTag(`gamification:dashboard:${orgId}`);
    revalidateTag(`gamification:leaderboard:${orgId}`);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 });
  }
}
