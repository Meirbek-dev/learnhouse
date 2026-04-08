import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AppSession, ClientSession, RawUserSessionResponse } from './types';
import { getServerAPIUrl } from '@services/config/config';

/** Cookie names forwarded to the backend for session validation. */
const AUTH_COOKIE_NAMES = ['access_token_cookie', 'refresh_token_cookie'] as const;

function toAppSession(payload: RawUserSessionResponse): AppSession | null {
  if (!payload || typeof payload !== 'object' || typeof payload.expires_at !== 'number') {
    return null;
  }

  const { expires_at, session_version, ...session } = payload;

  return {
    ...session,
    expiresAt: expires_at,
    sessionVersion: typeof session_version === 'number' ? session_version : null,
  } as AppSession;
}

export const getSession = cache(async (): Promise<AppSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token_cookie')?.value;

  if (!accessToken) return null;

  // Only forward auth cookies — not analytics, preferences, or other cookies.
  const cookieHeader = cookieStore
    .getAll()
    .filter((c) => (AUTH_COOKIE_NAMES as readonly string[]).includes(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  try {
    const response = await fetch(`${getServerAPIUrl()}users/session`, {
      headers: { Cookie: cookieHeader },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const sessionData = (await response.json()) as RawUserSessionResponse;
    return toAppSession(sessionData);
  } catch {
    return null;
  }
});

export async function requireSession(): Promise<AppSession> {
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

export function toClientSession(session: AppSession | null): ClientSession | null {
  if (!session) return null;
  return { ...session } as ClientSession;
}
