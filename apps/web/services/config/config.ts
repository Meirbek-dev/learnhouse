// Runtime configuration cache
let runtimeConfig: Record<string, string> | null = null;
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

// Lazy load runtime configuration
function loadRuntimeConfig(): Record<string, string> {
  if (runtimeConfig !== null) {
    return runtimeConfig;
  }

  runtimeConfig = {};

  if (typeof window !== 'undefined') {
    // Client-side: read from window.__RUNTIME_CONFIG__ if available
    if ((window as any).__RUNTIME_CONFIG__) {
      runtimeConfig = (window as any).__RUNTIME_CONFIG__;
    }
  } else {
    // Server-side: try to read from runtime-config.json
    // Try multiple possible paths for standalone mode
    try {
      const fs = require('node:fs');
      const path = require('node:path');

      // In standalone mode, runtime-config.json is in the same directory as server.js
      // Try common possible locations relative to the current working directory and module
      const possiblePaths = [
        path.join(process.cwd(), 'runtime-config.json'),
        path.join(__dirname || process.cwd(), 'runtime-config.json'),
        path.join(__dirname || process.cwd(), '..', 'runtime-config.json'),
      ];

      for (const configPath of possiblePaths) {
        try {
          if (fs.existsSync(configPath)) {
            runtimeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            break;
          }
        } catch {
          // Continue to next path
        }
      }
    } catch {
      // fs/path not available (client-side bundle), skip
    }
  }

  return runtimeConfig || {};
}

// Helper function to get config value with fallback
export const getConfig = (key: string, defaultValue: string = ''): string => {
  const config = loadRuntimeConfig();
  return (config && config[key]) || process.env[key] || defaultValue;
};

// Dynamic config getters - these are functions to ensure runtime values are used
const getPLATFORM_HTTP_PROTOCOL = () =>
  getConfig('NEXT_PUBLIC_PLATFORM_HTTPS') === 'true' ? 'https://' : 'http://';
const getPLATFORM_API_URL = () => getConfig('NEXT_PUBLIC_PLATFORM_API_URL', 'http://localhost/api/v1/');
const getPLATFORM_BACKEND_URL = () => getConfig('NEXT_PUBLIC_PLATFORM_BACKEND_URL', 'http://localhost/');
const getPLATFORM_DOMAIN = () => getConfig('NEXT_PUBLIC_PLATFORM_DOMAIN', 'localhost');
const getPLATFORM_TOP_DOMAIN = () => getConfig('NEXT_PUBLIC_PLATFORM_TOP_DOMAIN', 'localhost');

// Export getter functions for dynamic runtime configuration
export const getPLATFORM_HTTP_PROTOCOL_VAL = getPLATFORM_HTTP_PROTOCOL;
export const getPLATFORM_BACKEND_URL_VAL = getPLATFORM_BACKEND_URL;
export const getPLATFORM_DOMAIN_VAL = getPLATFORM_DOMAIN;
export const getPLATFORM_TOP_DOMAIN_VAL = getPLATFORM_TOP_DOMAIN;

// Export constants for backward compatibility
// These are computed once at module load, but getConfig uses runtime values
// For middleware/proxy (where runtime is critical), use the getter functions instead
export const PLATFORM_HTTP_PROTOCOL = getPLATFORM_HTTP_PROTOCOL();
export const PLATFORM_BACKEND_URL = getPLATFORM_BACKEND_URL();
export const PLATFORM_DOMAIN = getPLATFORM_DOMAIN();
export const PLATFORM_TOP_DOMAIN = getPLATFORM_TOP_DOMAIN();

// For direct usage, these call the getters
export const getAPIUrl = () => getPLATFORM_API_URL();
export const getBackendUrl = () => getPLATFORM_BACKEND_URL();

export const getUriWithOrg = (orgslug: string, path: string) => {
  const protocol = getPLATFORM_HTTP_PROTOCOL();
  const domain = getPLATFORM_DOMAIN();
  return `${protocol}${domain}${path}`;
};

export const getUriWithoutOrg = (path: string) => {
  const protocol = getPLATFORM_HTTP_PROTOCOL();
  const domain = getPLATFORM_DOMAIN();
  return `${protocol}${domain}${path}`;
};

export const getOrgFromUri = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const domain = getPLATFORM_DOMAIN();

    return hostname.replace(`.${domain}`, '');
  }
};

export const getDefaultOrg = () => {
  return getConfig('NEXT_PUBLIC_PLATFORM_DEFAULT_ORG', 'default');
};
