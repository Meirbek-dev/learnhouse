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

export interface Session extends Omit<UserSessionResponse, 'user'> {
  user: SessionUser;
  expiresAt: number;
  sessionVersion: number | null;
}
