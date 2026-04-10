const AUTH_ROUTE_PREFIXES = ['/login', '/signup', '/forgot', '/reset', '/verify-email'] as const;

const PROTECTED_ROUTE_PREFIXES = [
  '/dash',
  '/courses',
  '/profile',
  '/settings',
  '/admin',
  '/analytics',
  '/editor',
  '/certificates',
] as const;

export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
