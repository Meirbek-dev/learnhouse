import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AppSession, ClientSession } from './types';
import { getServerAPIUrl } from '@services/config/config';

function getAccessTokenExpiry(token: string): number | null {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment) return null;

    const padding = '='.repeat((4 - (payloadSegment.length % 4)) % 4);
    const jsonPayload = JSON.parse(Buffer.from(`${payloadSegment}${padding}`, 'base64url').toString('utf-8')) as {
      exp?: number;
    };

    return typeof jsonPayload.exp === 'number' ? jsonPayload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export const getSession = cache(async (): Promise<AppSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token_cookie')?.value;

  if (!accessToken) return null;

  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');

  try {
    const response = await fetch(`${getServerAPIUrl()}users/session`, {
      headers: {
        Cookie: cookieHeader,
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const sessionData = await response.json();
    const expiresAt = getAccessTokenExpiry(accessToken) ?? Date.now() + 30 * 60 * 1000;

    return {
      ...sessionData,
      expiresAt,
    } as AppSession;
  } catch {
    return null;
  }
});

export async function requireSession(): Promise<AppSession> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export function toClientSession(session: AppSession | null): ClientSession | null {
  if (!session) return null;
  return { ...session } as ClientSession;
}
