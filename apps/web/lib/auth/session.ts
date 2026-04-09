import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeSession } from './session-utils';
import type { Session, UserSessionResponse } from './types';
import { getServerAPIUrl } from '@services/config/config';
import { ACCESS_TOKEN_COOKIE_NAME, AUTH_COOKIE_NAMES } from './constants';

export const getSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

  if (!accessToken) return null;

  // Only forward auth cookies — not analytics, preferences, or other cookies.
  const cookieHeader = cookieStore
    .getAll()
    .filter((c) => (AUTH_COOKIE_NAMES as readonly string[]).includes(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const response = await fetch(`${getServerAPIUrl()}users/session`, {
    headers: { Cookie: cookieHeader },
    cache: 'no-store',
  });

  if (response.status === 401 || !response.ok) {
    return null;
  }

  const sessionData = (await response.json()) as UserSessionResponse;
  return normalizeSession(sessionData);
});

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    // x-pathname is set by middleware.ts on every request.
    let returnTo = '/';
    try {
      const headersList = await headers();
      const path = headersList.get('x-pathname');
      if (path) returnTo = path;
    } catch {
      // headers() may not be available in all contexts; fall back to '/'
    }
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}
