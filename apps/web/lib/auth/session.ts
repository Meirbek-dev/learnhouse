import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';
import { getServerAPIUrl } from '@services/config/config';
import { ACCESS_TOKEN_COOKIE_NAME } from './constants';
import type { AccessTokenPayload, Session } from './types';

// ── JWKS (cached in-process by jose, re-fetched only on key rotation) ─────────

/**
 * The JWKS URL points to the FastAPI backend's public-key endpoint.
 * jose caches the key in memory; re-fetches only when the KID is unknown
 * (i.e. key rotation).  Network overhead is effectively zero after the first
 * request per server process.
 */
const JWKS = createRemoteJWKSet(
  new URL('auth/.well-known/jwks.json', getServerAPIUrl()),
);

// ── Session construction ───────────────────────────────────────────────────────

/**
 * Build a fully-typed Session from a verified AccessTokenPayload.
 *
 * All fields required by the Session interface are sourced directly from JWT
 * claims — no backend call is made.  The shape satisfies
 * ``Session extends Omit<UserSessionResponse, 'user'>`` because:
 *
 *   roles            → payload.role_data wrapped as {role: RawRoleClaim}[]
 *   permissions      → payload.perms
 *   permissions_timestamp → payload.rvs
 *   expires_at       → payload.exp   (seconds)
 *   session_version  → payload.iat
 *   expiresAt        → payload.exp * 1000  (ms, added by Session)
 *   sessionVersion   → payload.iat         (added by Session)
 *   user             → payload.u           (SessionUser pick)
 */
function sessionFromPayload(payload: AccessTokenPayload): Session {
  return {
    user: {
      id: payload.u.id,
      user_uuid: payload.u.user_uuid,
      username: payload.u.username,
      email: payload.u.email,
      first_name: payload.u.first_name,
      last_name: payload.u.last_name,
      middle_name: payload.u.middle_name,
      avatar_image: payload.u.avatar_image,
      bio: payload.u.bio,
      details: payload.u.details,
      profile: payload.u.profile,
      theme: payload.u.theme,
    },
    roles: payload.role_data.map((r) => ({ role: r })),
    permissions: payload.perms,
    permissions_timestamp: payload.rvs,
    expires_at: payload.exp,
    session_version: payload.iat,
    expiresAt: payload.exp * 1000,
    sessionVersion: payload.iat,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Verify the access token locally using the backend's Ed25519 public key and
 * return a typed Session — with NO backend HTTP call.
 *
 * The result is deduplicated within a single RSC render tree via React.cache().
 * A new verification is performed for every incoming request.
 *
 * Returns null when:
 *   - No access token cookie is present.
 *   - The token has expired (JWTExpired).
 *   - The token signature is invalid.
 *   - The token is missing required claims (u, perms, role_data).
 *
 * Note: JTI blocklist checks (for logged-out tokens) happen server-side in
 * FastAPI on every authenticated API call.  Local verification intentionally
 * skips the blocklist to avoid a Redis round-trip on every page render.
 * The maximum window for a blocklisted-but-locally-valid token is the access
 * token TTL (30 minutes).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify<AccessTokenPayload>(token, JWKS, {
      issuer: 'ashyq-bilim-auth',
      audience: 'ashyq-bilim-api',
      algorithms: ['EdDSA'],
    });

    // Guard: tokens issued before the new claim fields were added will be
    // missing `u`, `perms`, or `role_data`.  Treat them as expired so the
    // user refreshes to a full token.
    if (!payload.u || !payload.perms || !payload.role_data) {
      return null;
    }

    return sessionFromPayload(payload);
  } catch (error) {
    // JWTExpired is the normal case when the access token has timed out.
    // The proxy.ts / refresh route handles getting a new token.
    if (error instanceof joseErrors.JWTExpired) {
      return null;
    }
    // Other errors (invalid signature, malformed token, JWKS fetch failure)
    // are unexpected — log and treat as unauthenticated.
    const message = error instanceof Error ? error.message : String(error);
    console.warn('[getSession] JWT verification failed:', message);
    return null;
  }
});

/**
 * Require an authenticated session or redirect to /login.
 *
 * The returnTo path comes from the x-pathname header injected by proxy.ts,
 * so the user lands back at their intended destination after signing in.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const headersList = await headers();
    const returnTo = headersList.get('x-pathname') ?? '/';
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}
