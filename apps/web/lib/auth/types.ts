import type { components } from '@/lib/api/generated';

export type UserSessionResponse = components['schemas']['UserSession'];
type SessionPayload = UserSessionResponse & {
  expires_at?: number | null;
  session_version?: number | null;
};

export interface Session extends UserSessionResponse {
  expiresAt: number;
  sessionVersion: number | null;
}

export function normalizeSession(payload: SessionPayload | null | undefined): Session | null {
  if (!payload || typeof payload !== 'object' || typeof payload.expires_at !== 'number') {
    return null;
  }

  const { expires_at, session_version, ...session } = payload;

  return {
    ...session,
    expiresAt: expires_at,
    sessionVersion: typeof session_version === 'number' ? session_version : null,
  } as Session;
}
