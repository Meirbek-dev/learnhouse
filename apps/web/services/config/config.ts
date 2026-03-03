export const PLATFORM_HTTP_PROTOCOL =
  process.env.NEXT_PUBLIC_PLATFORM_HTTPS?.toLowerCase() === 'true' ? 'https://' : 'http://';
const PLATFORM_API_URL = `${process.env.NEXT_PUBLIC_PLATFORM_API_URL || ''}`;
export const PLATFORM_BACKEND_URL = `${process.env.NEXT_PUBLIC_PLATFORM_BACKEND_URL || ''}`;
export const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN;
export const PLATFORM_TOP_DOMAIN = process.env.NEXT_PUBLIC_PLATFORM_TOP_DOMAIN;

const isLikelyIPv4 = (host: string) => {
  if (!host) return false;
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((segment) => {
    if (!/^(\d{1,3})$/.test(segment)) return false;
    const value = Number(segment);
    return value >= 0 && value <= 255;
  });
};

const isLikelyIPv6 = (host: string) => host.includes(':');

const isUnsupportedCookieDomain = (host?: string | null) => {
  if (!host) return true;
  if (host === 'localhost') return true;
  if (isLikelyIPv4(host) || isLikelyIPv6(host)) return true;
  return false;
};

export const getTopLevelCookieDomain = () =>
  isUnsupportedCookieDomain(PLATFORM_TOP_DOMAIN) ? undefined : PLATFORM_TOP_DOMAIN;

/**
 * Returns the API base URL (always ending with a slash).
 * Falls back to current window origin + /api/v1/ in the browser when env is missing.
 *
 * For server-side requests in Docker, use internal container network.
 * For client-side requests, use the public-facing URL.
 */
export const getAPIUrl = () => {
  // Server-side: use internal Docker network URL when available
  if (typeof globalThis.window === 'undefined') {
    const internalUrl = process.env.PLATFORM_INTERNAL_API_URL;
    if (internalUrl) {
      return internalUrl.endsWith('/') ? internalUrl : `${internalUrl}/`;
    }

    // Fallback for Docker environment: use localhost:9000
    if (process.env.NODE_ENV === 'production' || process.env.PLATFORM_DEVELOPMENT_MODE === 'True') {
      console.log('[Config] Using fallback localhost:9000 for API');
      return 'http://localhost:9000/api/v1/';
    }
  }

  // Client-side: use public-facing URL
  let base = PLATFORM_API_URL;

  // Browser fallback if env not provided at build time
  if (!base && typeof globalThis.window !== 'undefined') {
    const { protocol, hostname, port } = globalThis.location;
    const portPart = port ? `:${port}` : '';
    base = `${protocol}//${hostname}${portPart}/api/v1/`;
  }

  if (!base) {
    // Last-resort sensible default for local dev
    base = 'http://localhost:1338/api/v1/';

    // Warn in server context when using fallback
    if (typeof globalThis.window === 'undefined') {
      console.warn(
        '[Config] Using fallback API URL in server context. ' +
        'Please set NEXT_PUBLIC_PLATFORM_API_URL or PLATFORM_INTERNAL_API_URL environment variable. ' +
        `Current fallback: ${base}`,
      );
    }
  }

  // Ensure trailing slash
  if (!base.endsWith('/')) base += '/';

  return base;
};

export const getBackendUrl = () => PLATFORM_BACKEND_URL;

export const getUriWithOrg = (orgslug: string, path: string) => {
  return `${PLATFORM_HTTP_PROTOCOL}${PLATFORM_DOMAIN}${path}`;
};

export const getUriWithoutOrg = (path: string) => `${PLATFORM_HTTP_PROTOCOL}${PLATFORM_DOMAIN}${path}`;

export const getOrgFromUri = (): string | undefined => {
  if (typeof globalThis.window !== 'undefined') {
    const { hostname } = globalThis.location;

    return hostname.replace(`.${PLATFORM_DOMAIN}`, '');
  }

  // Explicitly return undefined when running on the server or if window
  // isn't available.
  return undefined;
};

export const defaultOrg = 'openu';
