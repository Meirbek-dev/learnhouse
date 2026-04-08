import type { components } from '@/lib/api/generated';

type UserRead = components['schemas']['UserRead'];

/** Subset of UserRead fields the session UI actually consumes. */
export type SessionUser = Pick<
  UserRead,
  | 'id'
  | 'user_uuid'
  | 'username'
  | 'email'
  | 'first_name'
  | 'last_name'
  | 'middle_name'
  | 'avatar_image'
  | 'bio'
  | 'details'
  | 'profile'
  | 'theme'
>;

export type UserSessionResponse = components['schemas']['UserSession'];
type SessionPayload = UserSessionResponse & {
  expires_at?: number | null;
  session_version?: number | null;
};

export interface Session extends Omit<UserSessionResponse, 'user'> {
  user: SessionUser;
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
