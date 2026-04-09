/**
 * Unified API fetch client.
 *
 * Server-side: forwards only auth cookies from the incoming request so the
 * backend receives auth cookies automatically.
 *
 * Client-side: uses credentials:"include" so cookies are sent automatically.
 * A 401 is treated as a hard logout condition and redirects the user to login.
 */

import { getAPIUrl, getServerAPIUrl } from '@services/config/config';
import { buildLoginRedirect } from '@/lib/auth/redirect';
import { isAuthRoute } from '@/lib/auth/routes';
import { AUTH_COOKIE_NAMES } from '@/lib/auth/constants';

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
  const url = resolveRequestUrl(path, base);

  const options: RequestInit = { ...fetchInit, credentials: 'include', cache: fetchInit.cache ?? 'no-store' };

  // Server: forward cookies from the incoming request.
  if (isServer) {
    const cookieHeader = await getServerCookieHeader();
    if (cookieHeader) {
      options.headers = { ...Object.fromEntries(new Headers(options.headers ?? {}).entries()), Cookie: cookieHeader };
    }
  }

  const response = await fetch(url, options);

  if (!isServer && response.status === 401) {
    const pathname = globalThis.location.pathname;
    if (!isAuthRoute(pathname)) {
      globalThis.location.assign(buildLoginRedirect());
    }
  }

  return response;
}
