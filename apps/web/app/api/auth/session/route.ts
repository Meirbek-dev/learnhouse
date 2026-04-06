import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { toClientSession } from '@/lib/auth/session';

export async function GET() {
  const session = await auth();

  return NextResponse.json(toClientSession(session), {
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}
