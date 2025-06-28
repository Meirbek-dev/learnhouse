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

// Add type declarations for session cache
declare global {
  var sessionCache: {
    [key: string]: {
      data: any;
      timestamp: number;
    };
  };
}

interface UserWithTokens {
  id?: string;
  email?: string;
  tokens?: {
    access_token?: string;
    refresh_token?: string;
    expiry?: number;
  };
  [key: string]: any;
}

export const isDevEnv = OPENU_TOP_DOMAIN === 'localhost';

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: true,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'jsmith' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const unsanitized_req = await loginAndGetToken(credentials.email, credentials.password);
        const res = await getResponseMetadata(unsanitized_req);

        if (res.success) {
          return res.data;
        }
        return null;
      },
    }),
    Google({
      clientId: process.env.OPENU_GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.OPENU_GOOGLE_CLIENT_SECRET || '',
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
  callbacks: {
    async jwt({ token, user, account }) {
      // First sign in with Credentials provider
      if (account?.provider === 'credentials' && user) {
        token.user = user as UserWithTokens;
      }

      // Sign up with Google
      if (account?.provider === 'google' && user?.email) {
        const unsanitized_req = await loginWithOAuthToken(user.email, 'google', account.access_token || '');
        const userFromOAuth = await getResponseMetadata(unsanitized_req);
        token.user = userFromOAuth.data as UserWithTokens;
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
              token.user = {
                ...userWithTokens,
                tokens: {
                  ...userWithTokens.tokens,
                  access_token: refreshedToken.access_token,
                  expiry: Date.now() + 60 * 60 * 1000, // 1 hour from now
                },
              } as UserWithTokens;
            }
          } catch (error) {
            console.error('Token refresh failed:', error);
            // Optionally return null to force re-authentication
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      // Include user information in the session
      const userWithTokens = token.user as UserWithTokens;
      if (userWithTokens) {
        // Cache the session for 5 minutes to avoid frequent API calls
        const cacheKey = `user_session_${userWithTokens.tokens?.access_token}`;
        const cachedSession = global.sessionCache?.[cacheKey];

        if (cachedSession && Date.now() - cachedSession.timestamp < 5 * 60 * 1000) {
          return cachedSession.data;
        }

        try {
          const accessToken = userWithTokens.tokens?.access_token;
          if (accessToken) {
            const api_SESSION = await getUserSession(accessToken);
            session.user = api_SESSION.user;
            session.roles = api_SESSION.roles;
            session.tokens = userWithTokens.tokens;

            // Cache the session
            if (!global.sessionCache) {
              global.sessionCache = {};
            }
            global.sessionCache[cacheKey] = {
              data: session,
              timestamp: Date.now(),
            };
          }
        } catch (error) {
          console.error('Failed to fetch user session:', error);
        }
      }
      return session;
    },
  },
});
