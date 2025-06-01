import {
  OPENU_DOMAIN,
  OPENU_TOP_DOMAIN,
  getDefaultOrg,
  getUriWithOrg,
  isMultiOrgModeEnabled,
} from './services/config/config'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /fonts (inside /public)
     * 4. Umami Analytics
     * 4. /examples (inside /public)
     * 5. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|fonts|umami|examples|[\\w-]+\\.\\w+).*)',
    '/sitemap.xml',
    '/payments/stripe/connect/oauth',
  ],
}

// Helper to get orgslug from host or default
function extractOrgslug(
  fullhost: string,
  default_org: string,
  hosting_mode: string
): string {
  if (hosting_mode === 'multi') {
    return fullhost ? fullhost.replace(`.${OPENU_DOMAIN}`, '') : default_org
  }
  return default_org
}

// Helper to set orgslug cookie
function setOrgslugCookie(response: NextResponse, orgslug: string) {
  response.cookies.set({
    name: 'openu_current_orgslug',
    value: orgslug,
    domain: OPENU_TOP_DOMAIN == 'localhost' ? '' : OPENU_TOP_DOMAIN,
    path: '/',
  })
}

export default async function middleware(req: NextRequest) {
  // Get initial data
  const hosting_mode = isMultiOrgModeEnabled() ? 'multi' : 'single'
  const default_org = getDefaultOrg() as string
  const { pathname, search } = req.nextUrl
  const fullhost = req.headers?.get('host') || ''
  const cookie_orgslug = req.cookies.get('openu_current_orgslug')?.value

  // Out of orgslug paths & rewrite
  const standard_paths = ['/home']
  const auth_paths = ['/login', '/signup', '/reset', '/forgot']
  if (standard_paths.includes(pathname)) {
    // Redirect to the same pathname with the original search params
    return NextResponse.rewrite(new URL(`${pathname}${search}`, req.url))
  }

  if (auth_paths.includes(pathname)) {
    const response = NextResponse.rewrite(
      new URL(`/auth${pathname}${search}`, req.url)
    )

    // Parse the search params
    const searchParams = new URLSearchParams(search)
    const orgslug = searchParams.get('orgslug')
    if (orgslug) setOrgslugCookie(response, orgslug)
    return response
  }

  // Dynamic Pages Editor
  if (/^\/course\/[^/]+\/activity\/[^/]+\/edit$/.test(pathname)) {
    return NextResponse.rewrite(new URL(`/editor${pathname}`, req.url))
  }

  // Stripe callback URL
  if (pathname.startsWith('/payments/stripe/connect/oauth')) {
    const searchParams = req.nextUrl.searchParams
    const orgslug = searchParams.get('state')?.split('_')[0] // Assuming state parameter contains orgslug_randomstring

    // Construct the new URL with the required parameters
    const redirectUrl = new URL('/payments/stripe/connect/oauth', req.url)

    // Preserve all original search parameters
    searchParams.forEach((value, key) => {
      redirectUrl.searchParams.append(key, value)
    })

    // Add orgslug if available
    if (orgslug) {
      redirectUrl.searchParams.set('orgslug', orgslug)
    }
    return NextResponse.rewrite(redirectUrl)
  }

  // Health Check
  if (pathname.startsWith('/health')) {
    return NextResponse.rewrite(new URL('/api/health', req.url))
  }

  // Auth Redirects
  if (pathname === '/redirect_from_auth') {
    if (cookie_orgslug) {
      const searchParams = req.nextUrl.searchParams
      const queryString = searchParams.toString()
      const redirectUrl = new URL(getUriWithOrg(cookie_orgslug, '/'), req.url)
      if (queryString) {
        redirectUrl.search = queryString
      }
      return NextResponse.redirect(redirectUrl)
    }
    return 'Did not find the orgslug in the cookie'
  }

  // Sitemap
  if (pathname.startsWith('/sitemap.xml')) {
    const orgslug = extractOrgslug(fullhost, default_org, hosting_mode)
    const sitemapUrl = new URL('/api/sitemap', req.url)
    const response = NextResponse.rewrite(sitemapUrl)
    response.headers.set('X-Sitemap-Orgslug', orgslug)
    return response
  }

  // Organization Mode Routing
  const orgslug = extractOrgslug(fullhost, default_org, hosting_mode)
  const response = NextResponse.rewrite(
    new URL(`/orgs/${orgslug}${pathname}`, req.url)
  )
  setOrgslugCookie(response, orgslug)
  return response
}
