/**
 * Unified API fetch client.
 *
 * Server-side: forwards request cookies so the backend receives the access
 * token cookie automatically. Handles 401 → POST /auth/refresh → retry once.
 *
 * Client-side: uses credentials:"include" so cookies are sent automatically.
 * On 401, posts to /auth/refresh and retries. On second 401 emits a custom
 * `auth:session-expired` event so the SessionProvider can redirect to login.
 */

import { getAPIUrl, getServerAPIUrl } from '@services/config/config';
import { cookies } from 'next/headers';

type ApiFetchInit = Omit<RequestInit, 'credentials'> & {
  /** Override which base URL to use (defaults to environment-aware selection). */
  baseUrl?: string;
};

function apiBase(isServer: boolean, baseUrl?: string): string {
  if (baseUrl) return baseUrl;
  return isServer ? getServerAPIUrl() : getAPIUrl();
}

async function refreshTokens(isServer: boolean): Promise<boolean> {
  try {
    const base = apiBase(isServer, undefined);
    const init: RequestInit = { method: 'POST', credentials: 'include', cache: 'no-store' };

    if (isServer) {
      const cookieStore = await cookies();
      const cookieHeader = cookieStore
        .getAll()
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');
      (init as RequestInit & { headers: Record<string, string> }).headers = { Cookie: cookieHeader };
    }

    const res = await fetch(`${base}auth/refresh`, init);
    return res.ok;
  } catch {
    return false;
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
    const cookieStore = await cookies();
    const cookieHeader = cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    options.headers = { ...Object.fromEntries(new Headers(options.headers ?? {}).entries()), Cookie: cookieHeader };
  }

  let response = await fetch(url, options);

  if (response.status === 401) {
    const refreshed = await refreshTokens(isServer);
    if (refreshed) {
      // After refresh cookies are set; re-issue the original request.
      if (isServer) {
        // Re-read cookies after refresh (they were set server-side by the backend).
        const cookieStore = await cookies();
        const cookieHeader = cookieStore
          .getAll()
          .map((c) => `${c.name}=${c.value}`)
          .join('; ');
        options.headers = { ...Object.fromEntries(new Headers(options.headers ?? {}).entries()), Cookie: cookieHeader };
      }
      response = await fetch(url, options);
    }

    if (response.status === 401 && !isServer) {
      globalThis.window.dispatchEvent(new CustomEvent('auth:session-expired'));
    }
  }

  return response;
}
