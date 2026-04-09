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

/** Full UserSession schema from the OpenAPI-generated types. */
export type UserSessionResponse = components['schemas']['UserSession'];

/** Frontend session shape — fully constructable from JWT claims alone. */
export interface Session extends Omit<UserSessionResponse, 'user'> {
  user: SessionUser;
  expiresAt: number;
  sessionVersion: number | null;
}

// ── JWT claim types ───────────────────────────────────────────────────────────

/**
 * Role object embedded in the JWT ``role_data`` claim.
 * Shape matches the backend ``RoleRead`` Pydantic model / OpenAPI schema,
 * including the computed aggregate fields (permissions_count, users_count)
 * which are embedded as 0 since accurate counts are not needed for session UI.
 */
export interface RawRoleClaim {
  id: number;
  slug: string;
  name: string;
  description?: string | null;
  is_system: boolean;
  priority: number;
  /** ISO-8601 string. */
  created_at: string;
  /** ISO-8601 string. */
  updated_at: string;
  /** Embedded as 0 — not meaningful in session context. */
  permissions_count: number;
  /** Embedded as 0 — not meaningful in session context. */
  users_count: number;
}

/**
 * User display claims embedded in the JWT ``u`` claim.
 * Contains only the fields needed to render the UI without a backend round-trip.
 */
export interface RawUserClaims {
  id: number;
  user_uuid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  avatar_image: string | null;
  bio: string | null;
  details: Record<string, unknown> | null;
  profile: Record<string, unknown> | null;
  theme: string | null;
}

/**
 * Typed shape of the EdDSA access-token payload.
 *
 * Standard claims (sub, jti, iss, aud, iat, exp) are complemented by:
 *   rvs        — roles-version timestamp; compared against ``roles_updated:{uuid}``
 *                in Redis to detect stale role embeddings.
 *   roles      — role slugs (for display / logging).
 *   perms      — fully expanded permission strings ("resource:action:scope").
 *   u          — user display claims (rendered without a backend call).
 *   role_data  — full role objects matching the RoleRead OpenAPI schema.
 */
export interface AccessTokenPayload {
  /** User UUID — maps to Session.user.user_uuid. */
  sub: string;
  jti: string;
  /** Session ID — used by the backend for server-side session validation. */
  sid: string;
  iss: string;
  aud: string;
  /** Issued-at unix timestamp — maps to Session.sessionVersion / session_version. */
  iat: number;
  /** Expiry unix timestamp — maps to Session.expiresAt (×1000) / expires_at. */
  exp: number;
  /** Roles-version: unix timestamp when roles were embedded.
   *  Backend compares this to `roles_updated:{sub}` in Redis.
   *  Frontend maps this to Session.permissions_timestamp. */
  rvs: number;
  /** Role slugs — embedded for display and logging. */
  roles: string[];
  /** Fully expanded permission strings ("resource:action:scope").
   *  Frontend does exact Set.has() lookups; the backend expands wildcards
   *  and scope-broadening before embedding. */
  perms: string[];
  type: 'access';
  /** Minimal user display claims — lets the frontend render without a backend call. */
  u: RawUserClaims;
  /** Full role objects matching the RoleRead OpenAPI schema. */
  role_data: RawRoleClaim[];
}
