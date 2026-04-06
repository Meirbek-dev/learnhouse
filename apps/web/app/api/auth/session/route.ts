import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { toClientSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();

  return NextResponse.json(toClientSession(session), {
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}
