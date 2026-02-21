import {
  getNewAccessTokenUsingRefreshTokenServer,
  getUserSession,
  loginAndGetToken,
  loginWithOAuthToken,
} from '@/services/auth/auth';
import { getTopLevelCookieDomain, getUriWithOrg } from '@/services/config/config';
import type { NextAuthConfig, NextAuthResult, Session } from 'next-auth';
import { getResponseMetadata } from '@/services/utils/ts/requests';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import type { JWT } from 'next-auth/jwt';
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import NextAuth from 'next-auth';

// ─── Session Cache Types ──────────────────────────────────────────────────────

declare global {
  var sessionCache: Map<string, { data: SessionData; timestamp: number }> | undefined;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL = 1 * 60 * 1000; // 1 minute
const TOKEN_REFRESH_BUFFER = 2 * 60 * 1000; // 2 minutes before expiry
const MAX_CACHE_SIZE = 1000;
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const SESSION_UPDATE_AGE = 24 * 60 * 60; // 24 hours
const DEFAULT_TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours fallback

export const isDevEnv = process.env.NODE_ENV !== 'production';

// ─── Cache Helpers ────────────────────────────────────────────────────────────

const getSessionCache = (): Map<string, { data: SessionData; timestamp: number }> => {
  if (typeof globalThis === 'undefined') return new Map();

  if (!(globalThis.sessionCache instanceof Map)) {
    globalThis.sessionCache = new Map();
  }

  const cache = globalThis.sessionCache;

  if (cache.size > MAX_CACHE_SIZE) {
    const now = Date.now();
    const entries = [...cache.entries()];

    // Evict expired entries first
    for (const [key, value] of entries) {
      if (now - value.timestamp > CACHE_TTL) cache.delete(key);
    }

    // Evict oldest if still over limit
    if (cache.size > MAX_CACHE_SIZE) {
      [...cache.entries()]
        .toSorted((a, b) => a[1].timestamp - b[1].timestamp)
        .slice(0, cache.size - MAX_CACHE_SIZE)
        .forEach(([key]) => cache.delete(key));
    }
  }

  return cache;
};

const createCacheKey = (accessToken: string): string | null => {
  if (!accessToken) return null;
  return `user_session_${createHash('sha256').update(accessToken).digest('hex')}`;
};

// ─── Token Helpers ────────────────────────────────────────────────────────────

const isTokenExpiringSoon = (expiry: number, bufferMs = TOKEN_REFRESH_BUFFER): boolean => {
  if (!expiry || typeof expiry !== 'number' || expiry <= 0) {
    console.warn('Token missing expiry timestamp, assuming valid for this request');
    return false;
  }

  const expiring = Date.now() + bufferMs >= expiry;
  if (expiring) {
    console.log('Token expiring soon, will refresh', {
      expiresAt: new Date(expiry).toISOString(),
      bufferMs,
    });
  }
  return expiring;
};

const safeExpiry = (expiry: unknown, fallback = Date.now() + DEFAULT_TOKEN_TTL_MS): number =>
  typeof expiry === 'number' && expiry > 0 ? expiry : fallback;

// ─── Cookie / Secure Config ───────────────────────────────────────────────────

const normalizeBoolean = (value?: string | null): boolean | undefined => {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  return undefined;
};

const cookieDomain = !isDevEnv ? getTopLevelCookieDomain() : undefined;
const httpsFlag = normalizeBoolean(process.env.NEXT_PUBLIC_PLATFORM_HTTPS);
const sslFlag = normalizeBoolean(process.env.PLATFORM_SSL);
const nextAuthUrl = process.env.NEXTAUTH_URL;
const isHttpsUrl = typeof nextAuthUrl === 'string' && nextAuthUrl.startsWith('https://');
const cookieSecure = !isDevEnv && (isHttpsUrl || httpsFlag === true || sslFlag === true);
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
      clientId: process.env.PLATFORM_GOOGLE_CLIENT_ID,
      clientSecret: process.env.PLATFORM_GOOGLE_CLIENT_SECRET,
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
        // If expiry is missing/invalid force a refresh attempt
        const tokenExpiry = safeExpiry(tokens.expiry, Date.now() - 1);

        if (!isTokenExpiringSoon(tokenExpiry)) return token;

        console.log('Token expiring soon, attempting refresh...');

        if (!tokens.refresh_token) {
          console.error('No refresh token available');
          return null;
        }

        try {
          const refreshed = await getNewAccessTokenUsingRefreshTokenServer(tokens.refresh_token);

          if (!refreshed?.access_token) {
            console.error('Token refresh failed: no access token in response');
            return null;
          }

          token.user = {
            ...userWithTokens,
            tokens: {
              ...tokens,
              access_token: refreshed.access_token,
              refresh_token: refreshed.refresh_token ?? tokens.refresh_token,
              expiry: safeExpiry(refreshed.expiry),
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

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return {
          ...session,
          user: cached.data.user,
          roles: cached.data.roles,
          tokens: cached.data.tokens,
          permissions: cached.data.permissions,
          permissions_org_id: cached.data.permissions_org_id,
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
          cache.set(cacheKey, { data: sessionData, timestamp: Date.now() });
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
