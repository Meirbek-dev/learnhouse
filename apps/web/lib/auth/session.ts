import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import type { AppSession, ClientSession } from './types';
import { getServerAPIUrl } from '@services/config/config';

// ---------------------------------------------------------------------------
// JWKS – fetched once per process, module-level singleton.
// ---------------------------------------------------------------------------
let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS() {
  if (!_jwks) {
    const uri = new URL(`${getServerAPIUrl()}.well-known/jwks.json`);
    _jwks = createRemoteJWKSet(uri);
  }
  return _jwks;
}

async function verifyAccessToken(token: string): Promise<{ sub: string; exp: number; sid: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getJWKS(), { algorithms: ['EdDSA'] });
    return {
      sub: payload.sub!,
      exp: payload.exp!,
      sid: payload.sid as string,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// getSession – deduplicated per render via React cache()
// ---------------------------------------------------------------------------
export const getSession = cache(async (): Promise<AppSession | null> => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token_cookie')?.value;

  if (!accessToken) return null;

  const claims = await verifyAccessToken(accessToken);
  if (!claims) return null;

  try {
    const response = await fetch(`${getServerAPIUrl()}users/session`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: `access_token_cookie=${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const sessionData = await response.json();
    return {
      ...sessionData,
      accessToken,
      expiresAt: claims.exp * 1000,
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

  const { accessToken: _t, ...rest } = session;
  return rest as ClientSession;
}
