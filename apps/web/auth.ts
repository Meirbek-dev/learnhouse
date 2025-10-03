import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { createHash } from 'node:crypto';
import NextAuth from 'next-auth';

import {
  getNewAccessTokenUsingRefreshTokenServer,
  getUserSession,
  loginAndGetToken,
  loginWithOAuthToken,
} from '@/services/auth/auth';
import { getTopLevelCookieDomain, getUriWithOrg } from '@/services/config/config';
import { getResponseMetadata } from '@/services/utils/ts/requests';

// Session cache with TTL and size limits
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

// Constants
const CACHE_TTL = 1 * 60 * 1000; // 1 minute
const TOKEN_REFRESH_BUFFER = 2 * 60 * 1000; // 2 minutes before expiry
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const SESSION_UPDATE_AGE = 24 * 60 * 60; // 24 hours

// Cache implementation with size limits and cleanup
const getSessionCache = () => {
  if (typeof globalThis !== 'undefined') {
    if (!(globalThis.sessionCache && globalThis.sessionCache instanceof Map)) {
      globalThis.sessionCache = new Map();
    }

    const cache = globalThis.sessionCache;

    // Cleanup old entries and limit size
    if (cache.size > MAX_CACHE_SIZE) {
      const entries = [...cache.entries()];
      const now = Date.now();

      // Remove expired entries first
      for (const [key, value] of entries) {
        if (now - value.timestamp > CACHE_TTL) {
          cache.delete(key);
        }
      }

      // If still over limit, remove oldest entries
      if (cache.size > MAX_CACHE_SIZE) {
        const sortedEntries = entries
          .toSorted((a, b) => a[1].timestamp - b[1].timestamp)
          .slice(0, cache.size - MAX_CACHE_SIZE);

        for (const [key] of sortedEntries) {
          cache.delete(key);
        }
      }
    }

    return cache;
  }
  // Fallback for environments without globalThis
  return new Map();
};

export const isDevEnv = process.env.NODE_ENV !== 'production';

// Helper function to validate token expiry
const isTokenExpiringSoon = (expiry: number, bufferMs: number = TOKEN_REFRESH_BUFFER): boolean => {
  // Handle missing or invalid expiry
  if (!expiry || typeof expiry !== 'number' || expiry <= 0) {
    console.warn('Invalid token expiry, triggering refresh');
    return true; // Force refresh if expiry is invalid
  }

  return Date.now() + bufferMs >= expiry;
};

// Helper function to create cache key
const createCacheKey = (accessToken: string): string => {
  if (!accessToken) return 'user_session_anonymous';

  // Hash the full token to avoid collisions while still not storing raw tokens.
  const tokenHash = createHash('sha256').update(accessToken).digest('hex');
  return `user_session_${tokenHash}`;
};

const cookieDomain = !isDevEnv ? getTopLevelCookieDomain() : undefined;

const normalizeBoolean = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  return undefined;
};

const httpsFlag = normalizeBoolean(process.env.NEXT_PUBLIC_OPENU_HTTPS);
const sslFlag = normalizeBoolean(process.env.OPENU_SSL);
const nextAuthUrl = process.env.NEXTAUTH_URL;
const isHttpsUrl = typeof nextAuthUrl === 'string' && nextAuthUrl.startsWith('https://');
const cookieSecure = !isDevEnv && (isHttpsUrl || httpsFlag === true || sslFlag === true);
const cookieNamePrefix = cookieSecure ? '__Secure-' : '';

export const { handlers, signIn, signOut, auth } = NextAuth({
  debug: isDevEnv,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<any> {
        // Type & presence validation (credentials props are unknown by default)
        if (!credentials || typeof credentials !== 'object') {
          console.warn('Missing credentials object in authorization attempt');
          return null;
        }

        const rawEmail = (credentials as Record<string, unknown>).email;
        const rawPassword = (credentials as Record<string, unknown>).password;

        if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
          console.warn('Credentials must be strings');
          return null;
        }

        if (!(rawEmail.trim() && rawPassword.trim())) {
          console.warn('Empty email or password provided');
          return null;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(rawEmail)) {
          console.warn('Invalid email format in authorization attempt');
          return null;
        }

        try {
          const sanitizedEmail = rawEmail.toLowerCase().trim();
          // password trimming avoided to preserve intentional leading/trailing spaces (only strip line breaks)
          const password = rawPassword;
          const unsanitized_req = await loginAndGetToken(sanitizedEmail, password);
          const res = await getResponseMetadata(unsanitized_req);

          if (res.success && res.data) {
            // Validate required user data
            const userData = res.data as UserWithTokens;
            if (!(userData.tokens?.access_token && userData.tokens?.refresh_token)) {
              console.error('Missing required tokens in authorization response');
              return null;
            }
            // Cast to NextAuth User shape (augment ensures tokens allowed)
            return userData as any;
          }

          console.warn('Authorization failed: Invalid credentials or server error');
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
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],
  pages: {
    signIn: getUriWithOrg('auth', '/'),
    verifyRequest: getUriWithOrg('auth', '/'),
    error: getUriWithOrg('auth', '/'),
  },
  cookies: {
    sessionToken: {
      name: `${cookieNamePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        domain: cookieDomain ? `.${cookieDomain}` : undefined,
        secure: cookieSecure,
      },
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  trustHost: true, // Required for NextAuth v5
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      try {
        // Handle sign in with Credentials provider
        if (account?.provider === 'credentials' && user) {
          const userWithTokens = user as unknown as UserWithTokens;

          // Validate token data
          if (!(userWithTokens.tokens?.access_token && userWithTokens.tokens?.refresh_token)) {
            console.error('Invalid token data from credentials provider');
            return null;
          }

          token.user = userWithTokens;
          return token;
        }

        // Handle Google OAuth sign in
        if (account?.provider === 'google' && user?.email && account.access_token) {
          try {
            const unsanitized_req = await loginWithOAuthToken(
              user.email.toLowerCase().trim(),
              'google',
              account.access_token,
            );
            const userFromOAuth = await getResponseMetadata(unsanitized_req);

            if (userFromOAuth.success && userFromOAuth.data) {
              const userData = userFromOAuth.data as UserWithTokens;

              // Validate OAuth token data
              if (!(userData.tokens?.access_token && userData.tokens?.refresh_token)) {
                console.error('Invalid token data from OAuth provider');
                return null;
              }

              token.user = userData;
              return token;
            }
            console.error('OAuth authentication failed:', userFromOAuth);
            return null;
          } catch (error) {
            console.error('OAuth authentication error:', error);
            return null;
          }
        }

        // Handle token refresh for existing sessions
        const userWithTokens = token.user as UserWithTokens;
        if (!userWithTokens?.tokens) {
          console.warn('No user tokens found in JWT callback');
          return token;
        }

        const { tokens } = userWithTokens;

        // Ensure expiry exists and is valid
        const tokenExpiry =
          tokens.expiry && typeof tokens.expiry === 'number' && tokens.expiry > 0
            ? tokens.expiry
            : Date.now() - 1; // Force refresh if invalid

        // Check if token needs refreshing
        if (isTokenExpiringSoon(tokenExpiry)) {
          console.log('Token is expiring soon, attempting refresh...');

          try {
            const { refresh_token } = tokens;
            if (!refresh_token) {
              console.error('No refresh token available');
              return null;
            }

            const refreshedToken = await getNewAccessTokenUsingRefreshTokenServer(refresh_token);

            if (refreshedToken?.access_token) {
              // Ensure new expiry is set and valid
              const newExpiry =
                refreshedToken.expiry && typeof refreshedToken.expiry === 'number' && refreshedToken.expiry > 0
                  ? refreshedToken.expiry
                  : Date.now() + 8 * 60 * 60 * 1000; // Default 8 hours

              token.user = {
                ...userWithTokens,
                tokens: {
                  ...tokens,
                  access_token: refreshedToken.access_token,
                  refresh_token: refreshedToken.refresh_token || refresh_token,
                  expiry: newExpiry,
                },
              } as UserWithTokens;

              console.log('Token refreshed successfully', { newExpiry });
            } else {
              console.error('Token refresh failed: No access token in response');
              return null; // Kill session on refresh failure
            }
          } catch (error) {
            console.error('Token refresh failed:', error);
            const cache = getSessionCache();
            const cacheKey = createCacheKey(tokens.access_token);
            cache.delete(cacheKey);
            return null; // Kill session on error
          }
        }

        return token;
      } catch (error) {
        console.error('JWT callback error:', error);
        return null;
      }
    },

    async session({ session, token }) {
      const userWithTokens = token.user as UserWithTokens;
      if (!userWithTokens) {
        console.warn('No user data in token for session callback');
        return session;
      }

      const { tokens } = userWithTokens;
      if (!tokens?.access_token) {
        console.warn('No access token available for session');
        return session;
      }

      // Caching with proper key management
      const cacheKey = createCacheKey(tokens.access_token);
      const cache = getSessionCache();
      const cachedSession = cache.get(cacheKey);

      // Return cached session if valid
      if (cachedSession && Date.now() - cachedSession.timestamp < CACHE_TTL) {
        return {
          ...session,
          user: cachedSession.data.user,
          roles: cachedSession.data.roles,
          tokens: cachedSession.data.tokens,
        };
      }

      try {
        const api_SESSION = await getUserSession(tokens.access_token);

        if (!api_SESSION?.user) {
          console.error('Invalid session data from getUserSession');
          return session;
        }

        const sessionData: SessionData = {
          user: api_SESSION.user,
          roles: api_SESSION.roles || [],
          tokens: tokens,
        };

        const updatedSession = {
          ...session,
          user: sessionData.user,
          roles: sessionData.roles,
          tokens: sessionData.tokens,
        };

        // Cache the fresh session data
        cache.set(cacheKey, {
          data: sessionData,
          timestamp: Date.now(),
        });

        return updatedSession;
      } catch (error) {
        console.error('Failed to fetch user session:', error);

        // Clear potentially stale cache entry
        cache.delete(cacheKey);

        // Return session with available token data
        return {
          ...session,
          user: {
            id: userWithTokens.id,
            email: userWithTokens.email,
            username: userWithTokens.username,
            first_name: userWithTokens.first_name,
            last_name: userWithTokens.last_name,
          },
          roles: [],
          tokens: tokens,
        };
      }
    },

    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isAuthPage = nextUrl.pathname.startsWith('/auth');

      if (isAuthPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/redirect_from_auth', nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
  },
  events: {
    async signOut(message) {
      // Defensive extraction: event shape may differ across versions
      const token = (message as any)?.token;
      const userWithTokens = token?.user as UserWithTokens | undefined;
      if (userWithTokens?.tokens?.access_token) {
        const cache = getSessionCache();
        const cacheKey = createCacheKey(userWithTokens.tokens.access_token);
        cache.delete(cacheKey);
      }
    },
    async signIn({ user, account, profile, isNewUser }) {
      // Log successful sign-ins for monitoring
      console.log(`User signed in: ${user.email} via ${account?.provider}`);
    },
  },
});
