// next-auth.d.ts
import type { Role } from './permissions';
import 'next-auth';

interface UserRoleWithOrg {
  role: Role;
  org: {
    id: number;
    org_uuid: string;
    name: string;
    slug: string;
  };
}

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
    middle_name?: string;
    last_name?: string;
    [key: string]: any;
  }

  interface UserWithTokens extends AuthUser {
    tokens: AuthTokens;
  }

  interface SessionData {
    user: AuthUser;
    roles: UserRoleWithOrg[];
    tokens: AuthTokens;
    /** User's effective permissions as permission_name -> boolean */
    permissions: Record<string, boolean>;
  }

  interface TokenRefreshResult {
    tokens: AuthTokens;
    refreshed: boolean;
  }
}

declare module 'next-auth' {
  interface Session {
    user: AuthUser;
    roles?: UserRoleWithOrg[];
    tokens?: AuthTokens;
    expires: string;
    /** User's effective permissions as permission_name -> boolean */
    permissions?: Record<string, boolean>;
  }

  type User = UserWithTokens;
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: UserWithTokens;
    /** Cached permissions */
    permissions?: Record<string, boolean>;
  }
}
