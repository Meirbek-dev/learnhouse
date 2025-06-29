import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { getDefaultOrg, getUriWithOrg, OPENU_TOP_DOMAIN } from './services/config/config';

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

// Helper to set orgslug cookie
function setOrgslugCookie(response: NextResponse, orgslug: string) {
  response.cookies.set({
    name: 'openu_current_orgslug',
    value: orgslug,
    domain: OPENU_TOP_DOMAIN === 'localhost' ? undefined : OPENU_TOP_DOMAIN,
    path: '/',
    secure: OPENU_TOP_DOMAIN !== 'localhost',
    sameSite: 'lax',
  });
}

export default auth(async (req) => {
  // Get initial data
  const default_org = getDefaultOrg() as string;
  const { pathname, search } = req.nextUrl;
  const cookie_orgslug = req.cookies.get('openu_current_orgslug')?.value;

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
    if (orgslug) setOrgslugCookie(response, orgslug);
    return response;
  }

  // Dynamic Pages Editor
  if (/^\/course\/[^/]+\/activity\/[^/]+\/edit$/.test(pathname)) {
    return NextResponse.rewrite(new URL(`/editor${pathname}`, req.url));
  }

  // Health Check
  if (pathname.startsWith('/health')) {
    return NextResponse.rewrite(new URL('/api/health', req.url));
  }

  // Auth Redirects
  if (pathname === '/redirect_from_auth') {
    if (cookie_orgslug) {
      const { searchParams } = req.nextUrl;
      const queryString = searchParams.toString();
      const redirectUrl = new URL(getUriWithOrg(cookie_orgslug, '/'), req.url);
      if (queryString) {
        redirectUrl.search = queryString;
      }
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.json({ error: 'Did not find the orgslug in the cookie' }, { status: 400 });
  }

  // Sitemap
  if (pathname.startsWith('/sitemap.xml')) {
    const sitemapUrl = new URL('/api/sitemap', req.url);
    const response = NextResponse.rewrite(sitemapUrl);
    response.headers.set('X-Sitemap-Orgslug', default_org);
    return response;
  }

  // Organization Mode Routing
  const response = NextResponse.rewrite(new URL(`/orgs/${default_org}${pathname}`, req.url));
  setOrgslugCookie(response, default_org);
  return response;
});
