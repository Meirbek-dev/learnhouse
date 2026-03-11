import {
  getNewAccessTokenUsingRefreshTokenServer,
  getUserSession,
  loginAndGetToken,
  loginWithOAuthToken,
} from '@/services/auth/auth';
import { SESSION_CACHE_MAX_SIZE, SESSION_CACHE_TTL_MS, TOKEN_REFRESH_BUFFER_MS } from '@/lib/constants';
import { getTopLevelCookieDomain, getUriWithOrg } from '@/services/config/config';
import type { NextAuthConfig, NextAuthResult, Session } from 'next-auth';
import { getResponseMetadata } from '@/services/utils/ts/requests';
import Credentials from 'next-auth/providers/credentials';
import { getServerEnv } from '@/services/config/env';
import Google from 'next-auth/providers/google';
import type { JWT } from 'next-auth/jwt';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { LRUCache } from 'lru-cache';
import NextAuth from 'next-auth';

// ─── Session Cache Types ──────────────────────────────────────────────────────

declare global {
  var sessionCache: LRUCache<string, SessionData> | undefined;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const SESSION_UPDATE_AGE = 24 * 60 * 60; // 24 hours
const MAX_ACCESS_TOKEN_LIFETIME_MS = 60 * 60 * 1000; // 60 minutes

export const isDevEnv = process.env.NODE_ENV !== 'production';

// ─── Cache Helpers ────────────────────────────────────────────────────────────

const createSessionCache = (): LRUCache<string, SessionData> =>
  new LRUCache<string, SessionData>({
    max: SESSION_CACHE_MAX_SIZE,
    ttl: SESSION_CACHE_TTL_MS,
    updateAgeOnGet: false,
    updateAgeOnHas: false,
  });

const getSessionCache = (): LRUCache<string, SessionData> => {
  if (typeof globalThis === 'undefined') return createSessionCache();

  if (!(globalThis.sessionCache instanceof LRUCache)) {
    globalThis.sessionCache = createSessionCache();
  }

  return globalThis.sessionCache;
};

const createCacheKey = (accessToken: string): string | null => {
  if (!accessToken) return null;
  return `user_session_${createHash('sha256').update(accessToken).digest('hex')}`;
};

// ─── Token Helpers ────────────────────────────────────────────────────────────

const assertValidTokenExpiry = (expiry: unknown): number => {
  if (typeof expiry !== 'number' || !Number.isFinite(expiry) || expiry <= 0) {
    throw new Error('Token expiry claim is missing or invalid');
  }

  const now = Date.now();
  if (expiry <= now) {
    throw new Error('Token is already expired');
  }

  return expiry;
};

const isTokenExpiringSoon = (expiry: number, bufferMs = TOKEN_REFRESH_BUFFER_MS): boolean => {
  const expiring = Date.now() + bufferMs >= expiry;
  if (expiring) {
    console.log('Token expiring soon, will refresh', {
      expiresAt: new Date(expiry).toISOString(),
      bufferMs,
    });
  }
  return expiring;
};

// ─── Cookie / Secure Config ───────────────────────────────────────────────────
const normalizeBoolean = (value?: string | null): boolean | undefined => {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  return undefined;
};

const serverEnv = getServerEnv();
const cookieDomain = !isDevEnv ? getTopLevelCookieDomain() : undefined;
const sslFlag = normalizeBoolean(serverEnv.PLATFORM_SSL);
const nextAuthUrl = serverEnv.NEXTAUTH_URL;
const isHttpsUrl = typeof nextAuthUrl === 'string' && nextAuthUrl.startsWith('https://');
const cookieSecure = !isDevEnv && (isHttpsUrl || sslFlag);
const cookieNamePrefix = cookieSecure ? '__Secure-' : '';

// ─── Auth Config ──────────────────────────────────────────────────────────────

const authConfig: NextAuthConfig = {
  debug: isDevEnv,

  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text', placeholder: 'user@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<any> {
        if (!credentials || typeof credentials !== 'object') {
          console.warn('Missing credentials object');
          return null;
        }

        const { email: rawEmail, password: rawPassword } = credentials as Record<string, unknown>;

        if (typeof rawEmail !== 'string' || typeof rawPassword !== 'string') {
          console.warn('Credentials must be strings');
          return null;
        }

        if (!rawEmail.trim() || !rawPassword.trim()) {
          console.warn('Empty email or password');
          return null;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
          console.warn('Invalid email format');
          return null;
        }

        try {
          const res = await getResponseMetadata(await loginAndGetToken(rawEmail.toLowerCase().trim(), rawPassword));

          if (!res.success || !res.data) {
            console.warn('Authorization failed: invalid credentials or server error');
            return null;
          }

          const userData = res.data as UserWithTokens;
          if (!userData.tokens?.access_token || !userData.tokens?.refresh_token) {
            console.error('Missing required tokens in authorization response');
            return null;
          }

          return userData as any;
        } catch (error) {
          console.error('Authorization error:', error);
          return null;
        }
      },
    }),

    Google({
      clientId: serverEnv.PLATFORM_GOOGLE_CLIENT_ID,
      clientSecret: serverEnv.PLATFORM_GOOGLE_CLIENT_SECRET,
      authorization: {
        params: { prompt: 'consent', access_type: 'offline', response_type: 'code' },
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

  trustHost: true,

  callbacks: {
    // ── jwt ────────────────────────────────────────────────────────────────
    async jwt({ token, user, account }): Promise<JWT | null> {
      try {
        // Credentials sign-in
        if (account?.provider === 'credentials' && user) {
          const u = user as unknown as UserWithTokens;
          if (!u.tokens?.access_token || !u.tokens?.refresh_token) {
            console.error('Invalid token data from credentials provider');
            return null;
          }
          assertValidTokenExpiry(u.tokens.expiry);
          token.user = u;
          return token;
        }

        // Google OAuth sign-in
        if (account?.provider === 'google' && user?.email && account.access_token) {
          try {
            const cookieStore = await cookies();
            const orgIdCookie = cookieStore.get('oauth_org_id');
            const orgId = orgIdCookie?.value ? Number.parseInt(orgIdCookie.value, 10) : undefined;
            if (orgIdCookie) cookieStore.delete('oauth_org_id');

            const res = await getResponseMetadata(
              await loginWithOAuthToken(user.email.toLowerCase().trim(), 'google', account.access_token, orgId),
            );

            if (!res.success || !res.data) {
              console.error('OAuth authentication failed:', res);
              return null;
            }

            const userData = res.data as UserWithTokens;
            if (!userData.tokens?.access_token || !userData.tokens?.refresh_token) {
              console.error('Invalid token data from OAuth provider');
              return null;
            }
            assertValidTokenExpiry(userData.tokens.expiry);

            token.user = userData;
            return token;
          } catch (error) {
            console.error('OAuth authentication error:', error);
            return null;
          }
        }

        // Subsequent requests - refresh if needed
        const userWithTokens = token.user;
        if (!userWithTokens?.tokens) {
          console.warn('No user tokens found in JWT callback');
          return token;
        }

        const { tokens } = userWithTokens;
        const tokenExpiry = assertValidTokenExpiry(tokens.expiry);

        if (!isTokenExpiringSoon(tokenExpiry)) return token;

        console.log('Token expiring soon, attempting refresh...');

        if (!tokens.refresh_token) {
          console.error('No refresh token available');
          return null;
        }

        try {
          const refreshed = await getNewAccessTokenUsingRefreshTokenServer(tokens.refresh_token);

          if (!refreshed?.access_token || !refreshed?.refresh_token) {
            console.error('Token refresh failed: missing rotated token pair in response');
            return null;
          }

          const refreshedExpiry = assertValidTokenExpiry(refreshed.expiry);

          token.user = {
            ...userWithTokens,
            tokens: {
              ...tokens,
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token,
              expiry: refreshedExpiry,
            },
          } as UserWithTokens;

          console.log('Token refreshed successfully');
          return token;
        } catch (error) {
          console.error('Token refresh error:', error);
          const cacheKey = createCacheKey(tokens.access_token);
          if (cacheKey) {
            getSessionCache().delete(cacheKey);
          }
          return null;
        }
      } catch (error) {
        console.error('JWT callback error:', error);
        return null;
      }
    },

    // ── session ────────────────────────────────────────────────────────────
    async session({ session, token }): Promise<Session> {
      const userWithTokens = token.user;

      if (!userWithTokens?.tokens?.access_token) {
        console.warn('No valid token data for session callback');
        return session;
      }

      const { tokens } = userWithTokens;
      const cache = getSessionCache();
      const cacheKey = createCacheKey(tokens.access_token);
      const cached = cacheKey ? cache.get(cacheKey) : null;

      if (cached) {
        return {
          ...session,
          user: cached.user,
          roles: cached.roles,
          tokens: cached.tokens,
          permissions: cached.permissions,
          permissions_org_id: cached.permissions_org_id,
        };
      }

      try {
        const cookieStore = await cookies();
        const orgIdCookie = cookieStore.get('current_org_id');
        const currentOrgId = orgIdCookie?.value ? Number.parseInt(orgIdCookie.value, 10) : undefined;

        const apiSession = await getUserSession(tokens.access_token, currentOrgId);

        if (!apiSession?.user) {
          console.error('Invalid session data from getUserSession');
          return session;
        }

        const sessionData: SessionData = {
          user: apiSession.user,
          roles: apiSession.roles ?? [],
          tokens,
          permissions: apiSession.permissions ?? [],
          permissions_org_id: currentOrgId ?? null,
        };

        if (cacheKey) {
          cache.set(cacheKey, sessionData);
        }

        return { ...session, ...sessionData };
      } catch (error) {
        console.error('Failed to fetch user session:', error);
        if (cacheKey) {
          cache.delete(cacheKey);
        }

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
          tokens,
          permissions: [],
        };
      }
    },

    // ── authorized ─────────────────────────────────────────────────────────
    async authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const isAuthPage = nextUrl.pathname.startsWith('/auth');

      if (isAuthPage) {
        return isLoggedIn ? Response.redirect(new URL('/redirect_from_auth', nextUrl)) : true;
      }

      return isLoggedIn;
    },
  },

  events: {
    async signOut(message) {
      const token = (message as any)?.token;
      const userWithTokens = token?.user as UserWithTokens | undefined;
      if (userWithTokens?.tokens?.access_token) {
        const cacheKey = createCacheKey(userWithTokens.tokens.access_token);
        if (cacheKey) {
          getSessionCache().delete(cacheKey);
        }
      }
    },
    async signIn({ user, account }) {
      const u = user as unknown as UserWithTokens;
      console.log(`User signed in: ${u.email} via ${account?.provider}`);
    },
  },
};
const { handlers, signIn, signOut, auth }: NextAuthResult = NextAuth(authConfig);

export { handlers, signIn, signOut, auth };
