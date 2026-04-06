import { getAPIUrl } from '@/services/config/config';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import type { AppSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';

const ACCESS_COOKIE_KEY = 'access_token_cookie';
const REFRESH_COOKIE_KEY = 'refresh_token_cookie';

function serializeCookieHeader(entries: { name: string; value: string }[]) {
  return entries.map(({ name, value }) => `${name}=${value}`).join('; ');
}

function extractCookieValue(setCookieHeader: string | null, cookieName: string): string | undefined {
  if (!setCookieHeader) {
    return undefined;
  }

  const match = setCookieHeader.match(new RegExp(`${cookieName}=([^;]+)`));
  return match?.[1];
}

export async function auth(): Promise<AppSession | null> {
  const cookieStore = await cookies();
  const requestCookies = cookieStore.getAll();

  if (requestCookies.length === 0) {
    return null;
  }

  const cookieHeader = serializeCookieHeader(requestCookies);
  const accessCookie = cookieStore.get(ACCESS_COOKIE_KEY)?.value;
  const refreshCookie = cookieStore.get(REFRESH_COOKIE_KEY)?.value;

  if (!accessCookie && !refreshCookie) {
    return null;
  }

  const headers = new Headers({
    Cookie: cookieHeader,
  });

  if (accessCookie) {
    headers.set('Authorization', `Bearer ${accessCookie}`);
  }

  const response = await fetchWithRetry(`${getAPIUrl()}users/session`, {
    method: 'GET',
    headers,
    redirect: 'follow',
    cache: 'no-cache',
  });

  if (!response.ok) {
    return null;
  }

  const session = (await response.json()) as AppSession;
  const refreshedAccessToken = extractCookieValue(response.headers.get('set-cookie'), ACCESS_COOKIE_KEY);

  return {
    ...session,
    tokens: {
      access_token: refreshedAccessToken ?? accessCookie,
    },
  };
}
