import type { components } from '@/lib/api/generated';

export const CLIENT_SESSION_ACCESS_TOKEN_SENTINEL = '__cookie_session__';

export type UserSessionResponse = components['schemas']['UserSession'];

export interface SessionTokens {
  access_token?: string;
}

export interface AppSession extends UserSessionResponse {
  tokens?: SessionTokens;
  expires?: string;
}

export interface ClientAppSession extends UserSessionResponse {
  tokens?: SessionTokens;
  expires?: string;
}

export function toClientSession(session: AppSession | null): ClientAppSession | null {
  if (!session?.user) {
    return null;
  }

  return {
    ...session,
    tokens: {
      access_token: CLIENT_SESSION_ACCESS_TOKEN_SENTINEL,
    },
  };
}
