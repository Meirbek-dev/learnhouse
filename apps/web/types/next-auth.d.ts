// next-auth.d.ts
import 'next-auth';

// Ambient global auth domain types (no import needed elsewhere)
declare global {
  interface AuthTokens {
    access_token: string;
    refresh_token: string;
    /** Epoch ms when the access token expires */
    expiry?: number;
    [key: string]: any;
  }

  interface AuthUser {
    id: number;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
  }

  interface UserWithTokens extends AuthUser {
    tokens: AuthTokens;
  }

  interface SessionData {
    user: AuthUser;
    roles: string[];
    tokens: AuthTokens;
  }

  interface TokenRefreshResult {
    tokens: AuthTokens;
    refreshed: boolean;
  }
}

declare module 'next-auth' {
  interface Session {
    user: AuthUser;
    roles?: string[];
    tokens?: AuthTokens;
    expires: string;
  }

  // Use a type alias instead of an empty interface extension to avoid
  // '@typescript-eslint/no-empty-object-type'. This keeps `User` equivalent to
  // `UserWithTokens` for compatibility with next-auth's types.
  type User = UserWithTokens;
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: UserWithTokens;
  }
}
