'use server';

import { CLIENT_SESSION_ACCESS_TOKEN_SENTINEL } from '@/lib/auth/session';
import { getOptionalSession } from '@/lib/get-optional-session';

export async function resolveServerAccessToken(accessToken?: string): Promise<string | undefined> {
  if (accessToken && accessToken !== CLIENT_SESSION_ACCESS_TOKEN_SENTINEL) {
    return accessToken;
  }

  const session = await getOptionalSession();
  return session?.tokens?.access_token ?? undefined;
}

export function hasUsableAccessToken(accessToken?: string): boolean {
  return Boolean(accessToken && accessToken !== CLIENT_SESSION_ACCESS_TOKEN_SENTINEL);
}
