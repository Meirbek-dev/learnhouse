import { getServerEnv, publicEnv } from './env';

export const PLATFORM_HTTP_PROTOCOL = publicEnv.NEXT_PUBLIC_PLATFORM_HTTPS === 'true' ? 'https://' : 'http://';
const PLATFORM_API_URL = publicEnv.NEXT_PUBLIC_PLATFORM_API_URL;
export const PLATFORM_BACKEND_URL = publicEnv.NEXT_PUBLIC_PLATFORM_BACKEND_URL;
export const PLATFORM_DOMAIN = publicEnv.NEXT_PUBLIC_PLATFORM_DOMAIN;
export const PLATFORM_TOP_DOMAIN = publicEnv.NEXT_PUBLIC_PLATFORM_TOP_DOMAIN;

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
 * Resolves the API base URL (always ending with a slash).
 * This should run once at module init.
 *
 * For server-side requests in Docker, use internal container network.
 * For client-side requests, use the public-facing URL.
 */
const resolveAPIUrl = () => {
  if (typeof globalThis.window === 'undefined') {
    const { PLATFORM_INTERNAL_API_URL: internalUrl } = getServerEnv();
    if (internalUrl) {
      return internalUrl;
    }
  }

  return PLATFORM_API_URL;
};

const API_URL = resolveAPIUrl();

export const getAPIUrl = () => API_URL;

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
