/**
 * Unified API fetch client.
 *
 * Server-side: forwards only auth cookies from the incoming request so the
 * backend receives the access token cookie automatically. Server requests do
 * not attempt hidden refreshes.
 *
 * Client-side: uses credentials:"include" so cookies are sent automatically.
 * On 401, posts to /auth/refresh and retries once. On second 401 emits a
 * centralized auth invalidation event so auth listeners can clear state
 * and redirect consistently.
 */

import { getAPIUrl, getServerAPIUrl } from '@services/config/config';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import { emitAuthInvalidation, tryRefreshToken } from '@/lib/auth/client';

/** Only these cookies are forwarded to the backend on server-side requests. */
const AUTH_COOKIE_NAMES = ['access_token_cookie', 'refresh_token_cookie'] as const;

type ApiFetchInit = Omit<RequestInit, 'credentials'> & {
  /** Override which base URL to use (defaults to environment-aware selection). */
  baseUrl?: string;
};

function apiBase(isServer: boolean, baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  return isServer ? getServerAPIUrl() : getAPIUrl();
}

function resolveRequestUrl(pathOrUrl: string, base: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${base.replace(/\/+$/, '')}/${pathOrUrl.replace(/^\/+/, '')}`;
}

function isSessionRequest(url: string): boolean {
  try {
    return new URL(url).pathname.endsWith('/users/session');
  } catch {
    return url.endsWith('/users/session');
  }
}

function isRequestCookieUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('during prerendering') ||
    message.includes('prerender is complete') ||
    message.includes('outside a request scope') ||
    message.includes('requestasyncstorage')
  );
}

async function getServerCookieHeader(): Promise<string> {
  try {
    const { cookies } = await import('next/headers');
    const cookieStore = await cookies();

    return cookieStore
      .getAll()
      .filter((c) => (AUTH_COOKIE_NAMES as readonly string[]).includes(c.name))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
  } catch (error) {
    if (isRequestCookieUnavailableError(error)) return '';
    throw error;
  }
}

async function revalidateAuthSession(): Promise<void> {
  const { mutate } = await import('swr');
  await mutate(AUTH_SESSION_SWR_KEY);
}

export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const isServer = typeof globalThis.window === 'undefined';
  const { baseUrl, ...fetchInit } = init;
  const base = apiBase(isServer, baseUrl);
  const url = resolveRequestUrl(path, base);

  const options: RequestInit = { ...fetchInit, credentials: 'include', cache: fetchInit.cache ?? 'no-store' };

  // Server: forward cookies from the incoming request.
  if (isServer) {
    const cookieHeader = await getServerCookieHeader();
    if (cookieHeader) {
      options.headers = { ...Object.fromEntries(new Headers(options.headers ?? {}).entries()), Cookie: cookieHeader };
    }
  }

  let response = await fetch(url, options);

  if (!isServer && response.status === 401) {
    const sessionRequest = isSessionRequest(url);
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      response = await fetch(url, options);
      if (!isSessionRequest(url)) {
        void revalidateAuthSession();
      }
    }

    if (response.status === 401) {
      emitAuthInvalidation({ reason: sessionRequest ? 'unauthenticated' : 'expired' }, { local: true });
    }
  }

  return response;
}
