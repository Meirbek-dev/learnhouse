import { getDefaultOrg, getTopLevelCookieDomain, getUriWithOrg } from './services/config/config';
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
  ],
};

export default async function proxy(req: NextRequest) {
  // Get initial data
  const default_org = getDefaultOrg();
  const cookieDomain = getTopLevelCookieDomain();
  const { pathname, search } = req.nextUrl;
  const cookie_orgslug = req.cookies.get('current_orgslug')?.value;

  // If path already starts with /orgs/, allow it to pass through
  if (pathname.startsWith('/orgs/')) {
    return NextResponse.next();
  }

  // Out of orgslug paths & rewrite
  const standard_paths = ['/home'];
  const auth_paths = ['/login', '/signup', '/reset', '/forgot'];
  if (standard_paths.includes(pathname)) {
    // Redirect to the same pathname with the original search params
    return NextResponse.rewrite(new URL(`${pathname}${search}`, req.url));
  }

  if (auth_paths.includes(pathname)) {
    const response = NextResponse.rewrite(new URL(`/auth${pathname}${search}`, req.url));

    // Parse the search params
    const searchParams = new URLSearchParams(search);
    const orgslug = searchParams.get('orgslug');

    if (orgslug) {
      response.cookies.set({
        name: 'current_orgslug',
        value: orgslug,
        domain: cookieDomain,
      });
    }
    return response;
  }

  // Dynamic Pages Editor
  if (pathname.match(/^\/course\/[^/]+\/activity\/[^/]+\/edit$/)) {
    return NextResponse.rewrite(new URL(`/editor${pathname}`, req.url));
  }

  // Health Check
  if (pathname.startsWith('/health')) {
    return NextResponse.rewrite(new URL('/api/health', req.url));
  }

  // Auth Redirects
  if (pathname === '/redirect_from_auth') {
    if (cookie_orgslug) {
      const searchParams = req.nextUrl.searchParams;
      const queryString = searchParams.toString();
      const redirectPathname = '/';
      const redirectUrl = new URL(getUriWithOrg(cookie_orgslug, redirectPathname), req.url);

      if (queryString) {
        redirectUrl.search = queryString;
      }
      return NextResponse.redirect(redirectUrl);
    }
    return 'Did not find the orgslug in the cookie';
  }

  if (pathname.startsWith('/sitemap.xml')) {
    let orgslug: string = default_org as string;

    const sitemapUrl = new URL('/api/sitemap', req.url);

    // Create a response object
    const response = NextResponse.rewrite(sitemapUrl);

    // Set the orgslug in a header
    response.headers.set('X-Sitemap-Orgslug', orgslug);

    return response;
  }

  // Single Organization Mode
  const orgslug = default_org as string;
  const response = NextResponse.rewrite(new URL(`/orgs/${orgslug}${pathname}`, req.url));

  // Set the cookie with the orgslug value
  response.cookies.set({
    name: 'current_orgslug',
    value: orgslug,
    domain: cookieDomain,
    path: '/',
  });

  return response;
}
