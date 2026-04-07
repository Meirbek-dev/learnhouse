import { NextResponse } from 'next/server';
import { getSession, toClientSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();

  if (!session) {
    return new NextResponse(null, { status: 401 });
  }

  return NextResponse.json(toClientSession(session), {
    headers: { 'Cache-Control': 'no-store, must-revalidate' },
  });
}
