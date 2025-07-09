import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';

import {
  getNewAccessTokenUsingRefreshTokenServer,
  getUserSession,
  loginAndGetToken,
  loginWithOAuthToken,
} from '@/services/auth/auth';
import { getUriWithOrg, OPENU_TOP_DOMAIN } from '@/services/config/config';
import { getResponseMetadata } from '@/services/utils/ts/requests';

// Improved type declarations for session cache - Edge Runtime compatible
declare global {
  var sessionCache:
    | Map<
        string,
        {
          data: SessionData;
          timestamp: number;
        }
      >
    | undefined;
}

// Edge Runtime compatible cache implementation
const getSessionCache = () => {
  if (typeof globalThis !== 'undefined') {
    if (!(globalThis.sessionCache && globalThis.sessionCache instanceof Map)) {
      globalThis.sessionCache = new Map();
    }
    return globalThis.sessionCache;
  }
  // Fallback for environments without globalThis
  return new Map();
};

interface SessionData {
  user: {
    id: number;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    [key: string]: any;
  };
  roles: string[];
  tokens: {
    access_token: string;
    refresh_token: string;
    expiry: number;
  };
}

interface UserWithTokens {
  id: number;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  tokens: {
    access_token: string;
    refresh_token: string;
    expiry: number;
  };
  [key: string]: any;
}

export const isDevEnv = OPENU_TOP_DOMAIN === 'localhost';

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: isDevEnv,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'jsmith' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!(credentials?.email && credentials?.password)) return null;

        try {
          const unsanitized_req = await loginAndGetToken(credentials.email, credentials.password);
          const res = await getResponseMetadata(unsanitized_req);

          if (res.success && res.data) {
            return res.data as UserWithTokens;
          }
          return null;
        } catch (error) {
          console.error('Authorization error:', error);
          return null;
        }
      },
    }),
    Google({
      clientId: process.env.OPENU_GOOGLE_CLIENT_ID,
      clientSecret: process.env.OPENU_GOOGLE_CLIENT_SECRET,
    }),
  ],
  pages: {
    signIn: getUriWithOrg('auth', '/'),
    verifyRequest: getUriWithOrg('auth', '/'),
    error: getUriWithOrg('auth', '/'),
  },
  cookies: {
    sessionToken: {
      name: `${!isDevEnv ? '__Secure-' : ''}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        domain: isDevEnv ? undefined : `.${OPENU_TOP_DOMAIN}`,
        secure: !isDevEnv,
      },
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  trustHost: true, // Required for NextAuth v5
  callbacks: {
    async jwt({ token, user, account }) {
      // First sign in with Credentials provider
      if (account?.provider === 'credentials' && user) {
        token.user = user as UserWithTokens;
        return token;
      }

      // Sign up with Google
      if (account?.provider === 'google' && user?.email && account.access_token) {
        try {
          const unsanitized_req = await loginWithOAuthToken(user.email, 'google', account.access_token);
          const userFromOAuth = await getResponseMetadata(unsanitized_req);
          if (userFromOAuth.success && userFromOAuth.data) {
            token.user = userFromOAuth.data as UserWithTokens;
          }
        } catch (error) {
          console.error('OAuth authentication error:', error);
          return null;
        }
      }

      // Refresh token only if it's close to expiring (5 minutes before expiry)
      const userWithTokens = token.user as UserWithTokens;
      if (userWithTokens?.tokens) {
        const tokenExpiry = userWithTokens.tokens.expiry || 0;
        const fiveMinutes = 5 * 60 * 1000;

        if (Date.now() + fiveMinutes >= tokenExpiry) {
          try {
            const refreshToken = userWithTokens.tokens.refresh_token;
            if (refreshToken) {
              const refreshedToken = await getNewAccessTokenUsingRefreshTokenServer(refreshToken);
              if (refreshedToken.access_token) {
                token.user = {
                  ...userWithTokens,
                  tokens: {
                    ...userWithTokens.tokens,
                    access_token: refreshedToken.access_token,
                    expiry: Date.now() + 60 * 60 * 1000, // 1 hour from now
                  },
                } as UserWithTokens;
              }
            }
          } catch (error) {
            console.error('Token refresh failed:', error);
            // Return null to force re-authentication
            return null;
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      const userWithTokens = token.user as UserWithTokens;
      if (!userWithTokens) {
        return session;
      }

      // Cache the session for 5 minutes to avoid frequent API calls
      const cacheKey = `user_session_${userWithTokens.tokens?.access_token}`;

      // Use Edge Runtime compatible cache
      const cache = getSessionCache();
      const cachedSession = cache.get(cacheKey);

      if (cachedSession && Date.now() - cachedSession.timestamp < 5 * 60 * 1000) {
        return {
          ...session,
          user: cachedSession.data.user,
          roles: cachedSession.data.roles,
          tokens: cachedSession.data.tokens,
        };
      }

      try {
        const accessToken = userWithTokens.tokens?.access_token;
        if (accessToken) {
          const api_SESSION = await getUserSession(accessToken);

          const updatedSession = {
            ...session,
            user: api_SESSION.user,
            roles: api_SESSION.roles,
            tokens: userWithTokens.tokens,
          };

          // Cache the session data using Edge Runtime compatible cache
          cache.set(cacheKey, {
            data: {
              user: api_SESSION.user,
              roles: api_SESSION.roles,
              tokens: userWithTokens.tokens,
            },
            timestamp: Date.now(),
          });

          return updatedSession;
        }
      } catch (error) {
        console.error('Failed to fetch user session:', error);
      }

      return session;
    },
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthPage = nextUrl.pathname.startsWith('/auth');

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL('/redirect_from_auth', nextUrl));
        return true;
      }

      return isLoggedIn;
    },
  },
});
