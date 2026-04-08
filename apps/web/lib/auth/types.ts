import type { components } from '@/lib/api/generated';

export type UserSessionResponse = components['schemas']['UserSession'];
export type RawUserSessionResponse = UserSessionResponse & {
  expires_at?: number | null;
  session_version?: number | null;
};

/**
 * Server-side session — backend-authoritative session snapshot with expiry metadata.
 */
export interface AppSession extends UserSessionResponse {
  /** Unix timestamp (ms) when the access token expires. */
  expiresAt: number;
  sessionVersion: number | null;
}

/**
 * Client-safe session — no raw token, just user/permissions data + expiry.
 */
export interface ClientSession extends UserSessionResponse {
  expiresAt: number;
  sessionVersion: number | null;
}
