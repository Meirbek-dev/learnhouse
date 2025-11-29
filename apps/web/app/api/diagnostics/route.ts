import { NextResponse } from 'next/server';

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    checks: {} as Record<string, any>,
  };

  try {
    // Check environment variables
    diagnostics.checks.envVars = {
      status: 'checking',
      NEXT_PUBLIC_PLATFORM_API_URL: !!process.env.NEXT_PUBLIC_PLATFORM_API_URL,
      NEXT_PUBLIC_PLATFORM_BACKEND_URL: !!process.env.NEXT_PUBLIC_PLATFORM_BACKEND_URL,
      NEXT_PUBLIC_PLATFORM_DOMAIN: !!process.env.NEXT_PUBLIC_PLATFORM_DOMAIN,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
    };

    // Check backend connectivity
    try {
      const backendUrl = process.env.NEXT_PUBLIC_PLATFORM_BACKEND_URL || process.env.NEXT_PUBLIC_PLATFORM_API_URL;
      if (backendUrl) {
        const response = await fetch(`${backendUrl}health`, {
          signal: AbortSignal.timeout(5000),
        });
        diagnostics.checks.backend = {
          status: response.ok ? 'healthy' : 'unhealthy',
          statusCode: response.status,
          url: backendUrl,
        };
      } else {
        diagnostics.checks.backend = {
          status: 'misconfigured',
          error: 'Backend URL not set',
        };
      }
    } catch (error: any) {
      diagnostics.checks.backend = {
        status: 'error',
        error: error.message,
        code: error.code,
      };
    }

    // Check cookies functionality
    try {
      const { cookies } = await import('next/headers');
      await cookies();
      diagnostics.checks.cookies = { status: 'working' };
    } catch (error: any) {
      diagnostics.checks.cookies = {
        status: 'error',
        error: error.message,
      };
    }

    // Check i18n
    try {
      const { getUserLocale } = await import('@/i18n/locale');
      const locale = await getUserLocale();
      diagnostics.checks.i18n = {
        status: 'working',
        currentLocale: locale,
      };
    } catch (error: any) {
      diagnostics.checks.i18n = {
        status: 'error',
        error: error.message,
        stack: error.stack,
      };
    }

    // Check auth
    try {
      const { auth } = await import('@/auth');
      const session = await auth();
      diagnostics.checks.auth = {
        status: 'working',
        hasSession: !!session,
        hasUser: !!session?.user,
      };
    } catch (error: any) {
      diagnostics.checks.auth = {
        status: 'error',
        error: error.message,
        stack: error.stack,
      };
    }

    return NextResponse.json(diagnostics, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Diagnostic failed',
        message: error.message,
        stack: error.stack,
        ...diagnostics,
      },
      { status: 500 },
    );
  }
}
