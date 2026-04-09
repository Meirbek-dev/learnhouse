import type { Session, UserSessionResponse } from './types';

type SessionPayload = UserSessionResponse & {
  expires_at?: number | null;
  session_version?: number | null;
};

export function normalizeSession(payload: SessionPayload | null | undefined): Session | null {
  if (!payload || typeof payload !== 'object' || typeof payload.expires_at !== 'number') {
    return null;
  }

  const { expires_at, session_version, ...rest } = payload;

  const session: Session = {
    ...rest,
    expiresAt: expires_at,
    sessionVersion: typeof session_version === 'number' ? session_version : null,
  };

  return session;
}
