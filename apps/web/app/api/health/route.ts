export const dynamic = 'force-dynamic'; // defaults to auto
export const revalidate = 0;

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || 'unknown',
        node: process.version,
        environment: process.env.NODE_ENV,
      },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
