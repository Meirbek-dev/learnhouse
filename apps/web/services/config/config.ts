export const OPENU_HTTP_PROTOCOL = process.env.NEXT_PUBLIC_OPENU_HTTPS === 'true' ? 'https://' : 'http://';
const OPENU_API_URL = `${process.env.NEXT_PUBLIC_OPENU_API_URL || ''}`;
export const OPENU_BACKEND_URL = `${process.env.NEXT_PUBLIC_OPENU_BACKEND_URL || ''}`;
export const OPENU_DOMAIN = process.env.NEXT_PUBLIC_OPENU_DOMAIN;
export const OPENU_TOP_DOMAIN = process.env.NEXT_PUBLIC_OPENU_TOP_DOMAIN;

/**
 * Returns the API base URL (always ending with a slash).
 * Falls back to current window origin + /api/v1/ in the browser when env is missing.
 */
export const getAPIUrl = () => {
  let base = OPENU_API_URL;

  // Browser fallback if env not provided at build time
  if (!base && typeof window !== 'undefined') {
    const { protocol, hostname, port } = window.location;
    const portPart = port ? `:${port}` : '';
    base = `${protocol}//${hostname}${portPart}/api/v1/`;
    // eslint-disable-next-line no-console
    console.warn('[config] NEXT_PUBLIC_OPENU_API_URL not set. Falling back to', base);
  }

  if (!base) {
    // Last-resort sensible default for local dev
    base = 'http://localhost:1338/api/v1/';
  }

  // Ensure trailing slash
  if (!base.endsWith('/')) base += '/';

  return base;
};

export const getBackendUrl = () => OPENU_BACKEND_URL;

// Multi Organization Mode
export const isMultiOrgModeEnabled = () => process.env.NEXT_PUBLIC_OPENU_MULTI_ORG === 'true';

export const getUriWithOrg = (orgslug: string, path: string) => {
  const multi_org = isMultiOrgModeEnabled();
  if (multi_org) {
    return `${OPENU_HTTP_PROTOCOL}${orgslug}.${OPENU_DOMAIN}${path}`;
  }
  return `${OPENU_HTTP_PROTOCOL}${OPENU_DOMAIN}${path}`;
};

export const getUriWithoutOrg = (path: string) => `${OPENU_HTTP_PROTOCOL}${OPENU_DOMAIN}${path}`;

export const getOrgFromUri = () => {
  const multi_org = isMultiOrgModeEnabled();
  if (multi_org) {
    getDefaultOrg();
  } else if (typeof window !== 'undefined') {
    const { hostname } = window.location;

    return hostname.replace(`.${OPENU_DOMAIN}`, '');
  }
};

export const getDefaultOrg = () => process.env.NEXT_PUBLIC_OPENU_DEFAULT_ORG;
