import type { components } from '@/lib/api/generated';

export type UserSessionResponse = components['schemas']['UserSession'];

/**
 * Server-side session — backend-authoritative session snapshot with expiry metadata.
 */
export interface AppSession extends UserSessionResponse {
  /** Unix timestamp (ms) when the access token expires. */
  expiresAt: number;
}

/**
 * Client-safe session — no raw token, just user/permissions data + expiry.
 */
export interface ClientSession extends UserSessionResponse {
  expiresAt: number;
}
