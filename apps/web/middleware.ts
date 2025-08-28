import {
  OPENU_DOMAIN,
  OPENU_TOP_DOMAIN,
  getDefaultOrg,
  getUriWithOrg,
  isMultiOrgModeEnabled,
} from './services/config/config';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

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
    '/sitemap.xml',
    '/payments/stripe/connect/oauth',
  ],
};

const STANDARD_PATHS = ['/home'] as const;
const AUTH_PATHS = ['/login', '/signup', '/reset', '/forgot'] as const;
const COOKIE_NAME = 'openu_current_orgslug';
const COURSE_ACTIVITY_EDIT_PATTERN = /^\/course\/[^/]+\/activity\/[^/]+\/edit$/;

// Helper functions
function getCookieDomain(): string | undefined {
  return OPENU_TOP_DOMAIN === 'localhost' ? '' : OPENU_TOP_DOMAIN;
}

function extractOrgslugFromHost(host: string): string {
  return host.replace(`.${OPENU_DOMAIN}`, '');
}

function createCookieConfig(value: string) {
  return {
    name: COOKIE_NAME,
    value,
    domain: getCookieDomain(),
    path: '/',
    // Add security settings for production
    ...(OPENU_TOP_DOMAIN !== 'localhost' && {
      secure: true,
      sameSite: 'lax' as const,
    }),
  };
}

function setOrgslugCookie(response: NextResponse, orgslug: string): void {
  response.cookies.set(createCookieConfig(orgslug));
}

function handleStandardPaths(pathname: string, search: string, req: NextRequest): NextResponse | null {
  if (STANDARD_PATHS.includes(pathname as any)) {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, req.url));
  }
  return null;
}

function handleAuthPaths(pathname: string, search: string, req: NextRequest): NextResponse | null {
  if (AUTH_PATHS.includes(pathname as any)) {
    const response = NextResponse.rewrite(new URL(`/auth${pathname}${search}`, req.url));

    const searchParams = new URLSearchParams(search);
    const orgslug = searchParams.get('orgslug');

    if (orgslug) {
      setOrgslugCookie(response, orgslug);
    }

    return response;
  }
  return null;
}

function handleCourseActivityEdit(pathname: string, req: NextRequest): NextResponse | null {
  if (COURSE_ACTIVITY_EDIT_PATTERN.test(pathname)) {
    return NextResponse.rewrite(new URL(`/editor${pathname}`, req.url));
  }
  return null;
}

function handleStripeCallback(req: NextRequest): NextResponse | null {
  if (!req.nextUrl.pathname.startsWith('/payments/stripe/connect/oauth')) {
    return null;
  }

  const { searchParams } = req.nextUrl;
  const state = searchParams.get('state');
  const orgslug = state?.split('_')[0];

  const redirectUrl = new URL('/payments/stripe/connect/oauth', req.url);

  // Preserve all original search parameters
  searchParams.forEach((value, key) => {
    redirectUrl.searchParams.append(key, value);
  });

  // Add orgslug if available
  if (orgslug) {
    redirectUrl.searchParams.set('orgslug', orgslug);
  }

  return NextResponse.rewrite(redirectUrl);
}

function handleHealthCheck(pathname: string, req: NextRequest): NextResponse | null {
  if (pathname.startsWith('/health')) {
    return NextResponse.rewrite(new URL('/api/health', req.url));
  }
  return null;
}

function handleAuthRedirect(
  pathname: string,
  cookieOrgslug: string | undefined,
  req: NextRequest,
): NextResponse | string | null {
  if (pathname !== '/redirect_from_auth') {
    return null;
  }

  if (!cookieOrgslug) {
    return 'Did not find the orgslug in the cookie';
  }

  const { searchParams } = req.nextUrl;
  const queryString = searchParams.toString();
  const redirectUrl = new URL(getUriWithOrg(cookieOrgslug, '/'), req.url);

  if (queryString) {
    redirectUrl.search = queryString;
  }

  return NextResponse.redirect(redirectUrl);
}

function handleSitemap(
  pathname: string,
  hostingMode: string,
  fullhost: string,
  defaultOrg: string,
  req: NextRequest,
): NextResponse | null {
  if (!pathname.startsWith('/sitemap.xml')) {
    return null;
  }

  let orgslug: string;

  if (hostingMode === 'multi') {
    orgslug = fullhost ? extractOrgslugFromHost(fullhost) : defaultOrg;
  } else {
    orgslug = defaultOrg;
  }

  const sitemapUrl = new URL('/api/sitemap', req.url);
  const response = NextResponse.rewrite(sitemapUrl);

  // Set the orgslug in a header for the API route to use
  response.headers.set('X-Sitemap-Orgslug', orgslug);

  return response;
}

function handleOrganizationMode(
  hostingMode: string,
  fullhost: string,
  defaultOrg: string,
  pathname: string,
  req: NextRequest,
): NextResponse | null {
  let orgslug: string;

  if (hostingMode === 'multi') {
    orgslug = fullhost ? extractOrgslugFromHost(fullhost) : defaultOrg;
  } else if (hostingMode === 'single') {
    orgslug = defaultOrg;
  } else {
    // Fallback for unknown hosting mode
    console.warn(`Unknown hosting mode: ${hostingMode}, falling back to single mode`);
    orgslug = defaultOrg;
  }

  const response = NextResponse.rewrite(new URL(`/orgs/${orgslug}${pathname}`, req.url));
  setOrgslugCookie(response, orgslug);

  return response;
}

export default async function middleware(req: NextRequest) {
  try {
    const hostingMode = isMultiOrgModeEnabled() ? 'multi' : 'single';
    const defaultOrg = getDefaultOrg();

    if (!defaultOrg) {
      console.error('Default organization not found');
      return NextResponse.next();
    }

    const { pathname, search } = req.nextUrl;
    const fullhost = req.headers?.get('host') || '';
    const cookieOrgslug = req.cookies.get(COOKIE_NAME)?.value;

    // Handle different path types in order of specificity

    // 1. Standard paths (no org needed)
    const standardPathResponse = handleStandardPaths(pathname, search, req);
    if (standardPathResponse) return standardPathResponse;

    // 2. Auth paths
    const authPathResponse = handleAuthPaths(pathname, search, req);
    if (authPathResponse) return authPathResponse;

    // 3. Course activity editor
    const editorResponse = handleCourseActivityEdit(pathname, req);
    if (editorResponse) return editorResponse;

    // 4. Stripe callback
    const stripeResponse = handleStripeCallback(req);
    if (stripeResponse) return stripeResponse;

    // 5. Health check
    const healthResponse = handleHealthCheck(pathname, req);
    if (healthResponse) return healthResponse;

    // 6. Auth redirect
    const authRedirectResponse = handleAuthRedirect(pathname, cookieOrgslug, req);
    if (authRedirectResponse) return authRedirectResponse;

    // 7. Sitemap
    const sitemapResponse = handleSitemap(pathname, hostingMode, fullhost, defaultOrg, req);
    if (sitemapResponse) return sitemapResponse;

    // 8. Organization-specific routing (multi/single mode)
    const orgResponse = handleOrganizationMode(hostingMode, fullhost, defaultOrg, pathname, req);
    if (orgResponse) return orgResponse;

    // Fallback - should not reach here normally
    console.warn(`Unhandled middleware path: ${pathname}`);
    return NextResponse.next();
  } catch (error) {
    console.error('Middleware error:', {
      error: error instanceof Error ? error.message : String(error),
      pathname: req.nextUrl.pathname,
      host: req.headers?.get('host'),
      userAgent: req.headers?.get('user-agent'),
    });

    // Return a safe fallback response instead of breaking the app
    return NextResponse.next();
  }
}
