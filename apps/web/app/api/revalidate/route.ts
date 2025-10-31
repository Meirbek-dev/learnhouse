import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function GET(request: NextRequest) {
  const tag: any = request.nextUrl.searchParams.get('tag');
  // revalidateTag now requires a second argument describing profile/cache life per Next.js d.ts
  revalidateTag(tag, { expire: 0 });

  return NextResponse.json(
    { revalidated: true, now: Date.now(), tag },
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    },
  );
}
