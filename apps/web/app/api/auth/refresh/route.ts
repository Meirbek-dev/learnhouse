import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerAPIUrl } from '@services/config/config';
import { REFRESH_TOKEN_COOKIE_NAME } from '@/lib/auth/constants';
import {
  applyResponseCookiesToNextResponse,
  buildRequestCookieHeader,
  clearAuthCookies,
} from '@/lib/auth/cookie-bridge';
import { buildLoginRedirect, getPostAuthRedirect, normalizeReturnTo } from '@/lib/auth/redirect';
import { isProtectedRoute } from '@/lib/auth/routes';

function resolveReturnTo(request: NextRequest): string {
  return normalizeReturnTo(request.nextUrl.searchParams.get('returnTo'));
}

function redirectTarget(request: NextRequest, returnTo: string): URL {
  return new URL(getPostAuthRedirect(returnTo), request.url);
}

export async function GET(request: NextRequest) {
  const returnTo = resolveReturnTo(request);
  const cookieHeader = buildRequestCookieHeader(request);

  if (!cookieHeader.includes(`${REFRESH_TOKEN_COOKIE_NAME}=`)) {
    const target = isProtectedRoute(returnTo) ? buildLoginRedirect(returnTo) : getPostAuthRedirect(returnTo);
    return clearAuthCookies(NextResponse.redirect(new URL(target, request.url)));
  }

  const response = await fetch(`${getServerAPIUrl()}auth/refresh`, {
    method: 'POST',
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    const target = isProtectedRoute(returnTo) ? buildLoginRedirect(returnTo) : getPostAuthRedirect(returnTo);
    return clearAuthCookies(NextResponse.redirect(new URL(target, request.url)));
  }

  const redirectResponse = NextResponse.redirect(redirectTarget(request, returnTo));
  applyResponseCookiesToNextResponse(response.headers, redirectResponse);
  return redirectResponse;
}

export async function POST(request: NextRequest) {
  return GET(request);
}
