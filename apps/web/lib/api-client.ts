/**
 * Unified API fetch client.
 *
 * Server-side: forwards only auth cookies from the incoming request so the
 * backend receives the access token cookie automatically. Server requests do
 * not attempt hidden refreshes.
 *
 * Client-side: uses credentials:"include" so cookies are sent automatically.
 * On 401, posts to /auth/refresh and retries once. On second 401 emits a
 * custom `auth:session-expired` event so the SessionProvider redirects to login.
 */

import { getAPIUrl, getServerAPIUrl } from '@services/config/config';
import { refreshToken } from '@services/auth/auth';

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

export async function apiFetch(path: string, init: ApiFetchInit = {}): Promise<Response> {
  const isServer = typeof globalThis.window === 'undefined';
  const { baseUrl, ...fetchInit } = init;
  const base = apiBase(isServer, baseUrl);
  const url = `${base}${path}`;

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
    const refreshed = await refreshToken();
    if (refreshed) {
      response = await fetch(url, options);
    }

    if (response.status === 401) {
      globalThis.window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
  }

  return response;
}
