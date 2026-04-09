import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { AUTH_REFRESH_BRIDGE_PATH, ACCESS_TOKEN_COOKIE_NAME } from './lib/auth/constants';
import { isAuthRoute } from './lib/auth/routes';
import { isAccessTokenExpired } from './lib/auth/cookie-bridge';
import { generateUUID } from './lib/utils';

const AUTH_REWRITE: Record<string, string> = {
  '/forgot': '/auth/forgot',
  '/login': '/auth/login',
  '/reset': '/auth/reset',
  '/signup': '/auth/signup',
};

const EDITOR_PATH_RE = /^\/course\/[\w-]+\/activity\/[\w-]+\/edit$/;

/**
 * Route prefixes that require an authenticated session.
 * Unauthenticated requests are redirected to /login with a ?returnTo param
 * so the user lands back at their intended destination after signing in.
 */
const PROTECTED_PREFIXES = [
  '/dash',
  '/courses',
  '/profile',
  '/settings',
  '/admin',
  '/analytics',
  '/editor',
  '/certificates',
] as const;

function buildRequestHeaders(req: NextRequest, requestId: string) {
  const headers = new Headers(req.headers);

  headers.set('x-forwarded-host', req.headers.get('host') ?? req.nextUrl.host);
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));
  headers.set('x-request-id', requestId);
  headers.set('x-pathname', req.nextUrl.pathname);

  if (req.nextUrl.port) {
    headers.set('x-forwarded-port', req.nextUrl.port);
  }

  return headers;
}

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set('x-request-id', requestId);
  return response;
}

function nextWithHeaders(req: NextRequest, requestId: string) {
  return withRequestId(
    NextResponse.next({
      request: {
        headers: buildRequestHeaders(req, requestId),
      },
    }),
    requestId,
  );
}

function rewriteWithHeaders(req: NextRequest, requestId: string, pathname: string) {
  return withRequestId(
    NextResponse.rewrite(new URL(pathname, req.url), {
      request: {
        headers: buildRequestHeaders(req, requestId),
      },
    }),
    requestId,
  );
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /fonts (inside /public)
     * 4. Umami Analytics
     * 5. /examples (inside /public)
     * 6. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|fonts|umami|examples|[\\w-]+\\.\\w+).*)',
    // Keep sitemap explicit so it still hits the proxy even though the regex skips extension paths.
    '/sitemap.xml',
  ],
};

export default async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const requestId = generateUUID();
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

  if (pathname === '/home') {
    return rewriteWithHeaders(req, requestId, `${pathname}${search}`);
  }

  const authRewrite = AUTH_REWRITE[pathname];
  if (authRewrite) {
    return rewriteWithHeaders(req, requestId, `${authRewrite}${search}`);
  }

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isProtected) {
    if (!accessToken || isAccessTokenExpired(accessToken)) {
      const refreshUrl = new URL(AUTH_REFRESH_BRIDGE_PATH, req.url);
      refreshUrl.searchParams.set('returnTo', pathname + search);
      return withRequestId(NextResponse.redirect(refreshUrl), requestId);
    }
  }

  if (accessToken && !isAuthRoute(pathname) && isAccessTokenExpired(accessToken)) {
    const refreshUrl = new URL(AUTH_REFRESH_BRIDGE_PATH, req.url);
    refreshUrl.searchParams.set('returnTo', pathname + search);
    return withRequestId(NextResponse.redirect(refreshUrl), requestId);
  }

  // Dynamic Pages Editor
  if (EDITOR_PATH_RE.test(pathname)) {
    return rewriteWithHeaders(req, requestId, `/editor${pathname}`);
  }

  // Health Check
  if (pathname.startsWith('/health')) {
    return rewriteWithHeaders(req, requestId, '/api/health');
  }

  // Auth Redirects
  if (pathname === '/redirect_from_auth') {
    const { searchParams } = req.nextUrl;
    const queryString = searchParams.toString();
    const redirectUrl = new URL('/', req.nextUrl.origin);

    if (queryString) {
      redirectUrl.search = queryString;
    }
    return withRequestId(NextResponse.redirect(redirectUrl), requestId);
  }

  if (pathname.startsWith('/sitemap.xml')) {
    return rewriteWithHeaders(req, requestId, '/api/sitemap');
  }

  return nextWithHeaders(req, requestId);
}
