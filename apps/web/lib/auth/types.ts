import type { components } from '@/lib/api/generated';

export type UserSessionResponse = components['schemas']['UserSession'];

/**
 * Server-side session — includes the raw JWT for passing to `use cache` boundaries.
 */
export interface AppSession extends UserSessionResponse {
  /** Raw EdDSA access token. Server-only; never sent to the client. */
  accessToken: string;
  /** Unix timestamp (ms) when the access token expires. */
  expiresAt: number;
}

/**
 * Client-safe session — no raw token, just user/permissions data + expiry.
 */
export interface ClientSession extends UserSessionResponse {
  expiresAt: number;
}
