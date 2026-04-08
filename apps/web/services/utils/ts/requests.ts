type FetchCacheConfig =
  | {
      revalidate?: number | null | undefined;
      tags?: string[];
      cache?: RequestCache | null | undefined;
      [key: string]: any;
    }
  | undefined;

const sanitizeFetchConfig = (config: FetchCacheConfig): { next?: Record<string, any>; cache?: RequestCache } => {
  if (!config) return {};

  const sanitized: Record<string, any> = { ...config };
  let cache: RequestCache | undefined;

  if ('cache' in sanitized) {
    const cacheValue = sanitized.cache;
    if (cacheValue === 'no-store' || cacheValue === 'force-cache' || cacheValue === 'only-if-cached') {
      cache = cacheValue;
    }
    delete sanitized.cache;
  }

  if (sanitized.revalidate !== undefined && sanitized.revalidate !== null) {
    const parsed = Number(sanitized.revalidate);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      cache = 'no-store';
      delete sanitized.revalidate;
    } else {
      sanitized.revalidate = parsed;
    }
  }

  if (Object.keys(sanitized).length === 0) {
    return cache ? { cache } : {};
  }

  return cache ? { next: sanitized, cache } : { next: sanitized };
};

// Internal helper to create request options, reducing code duplication.
const createRequestInit = (
  method: string,
  config: {
    data?: any;
    next?: any;
    isJson?: boolean;
    // When true, only adds a body for POST, PUT, PATCH, or DELETE methods.
    limitBodyToMethods?: boolean;
  },
): RequestInit & { next?: any } => {
  const { data, next, isJson = true, limitBodyToMethods = false } = config;

  const headers: Record<string, string> = {};

  const options: RequestInit & { next?: any } = {
    method,
    redirect: 'follow',
    credentials: 'include',
    headers,
  };

  const { next: sanitizedNext, cache } = sanitizeFetchConfig(next);
  if (cache) {
    options.cache = cache;
  }
  if (sanitizedNext) {
    options.next = sanitizedNext;
  }

  // Only set JSON content-type when sending a body (avoid preflight on simple GET/HEAD)
  if (isJson && data !== null) {
    headers['Content-Type'] = 'application/json';
  }

  const shouldSetBody = data !== null && (!limitBodyToMethods || ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method));

  if (shouldSetBody) {
    options.body = isJson ? JSON.stringify(data) : data;
  }

  return options;
};

// ── Token refresh helpers ─────────────────────────────────────────────────────

/**
 * Whether a token refresh is currently in-flight.
 * Prevents multiple concurrent refresh attempts from the same browser tab.
 */
let _refreshInFlight: Promise<boolean> | null = null;

/**
 * Attempt a single token refresh, deduplicating ALL concurrent callers.
 *
 * Every fetch path that handles 401s (api-client, swrFetcher, SessionContext)
 * must go through this function. Running two concurrent refreshes against the
 * backend's token-family tracking triggers session revocation.
 *
 * Returns true if the refresh succeeded and the caller should retry its request.
 */
export async function tryRefreshToken(): Promise<boolean> {
  if (_refreshInFlight) return _refreshInFlight;

  _refreshInFlight = (async () => {
    try {
      const { refreshToken } = await import('@services/auth/auth');
      const ok = await refreshToken();
      if (!ok && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('auth:session-expired'));
      }
      return ok;
    } finally {
      _refreshInFlight = null;
    }
  })();

  return _refreshInFlight;
}

/**
 * Thin fetch wrapper that automatically refreshes the access token on 401
 * and retries the original request once.  All existing helper functions
 * (swrFetcher, RequestBody, etc.) are built on this.
 *
 * Only runs on the client side — on the server (SSR) we never have a refresh
 * token cookie available, so we skip the retry logic there.
 */
async function fetchWithRefresh(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, init);

  if (res.status === 401 && typeof window !== 'undefined') {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      // Retry the original request with fresh cookies
      return fetch(url, init);
    }
  }

  return res;
}

// --- EXPORTED FUNCTIONS (UNCHANGED SIGNATURES) ---

export const RequestBody = (method: string, data: any, next: any) => {
  return createRequestInit(method, { data, next });
};

export const swrFetcher = async (url: string) => {
  const options: RequestInit = {
    method: 'GET',
    redirect: 'follow',
    credentials: 'include',
  };
  const response = await fetchWithRefresh(url, options);
  return errorHandling(response);
};

export const fetchResponseMetadata = async (url: string): Promise<CustomResponseTyping> => {
  const response = await fetchWithRefresh(url, {
    method: 'GET',
    redirect: 'follow',
    credentials: 'include',
  });

  return getResponseMetadata(response);
};

/**
 * SWR fetcher that returns both data and response headers.
 * Useful for paginated endpoints that return total count in headers.
 */
export const swrFetcherWithHeaders = async (url: string): Promise<{ data: any; headers: Record<string, string> }> => {
  const options: RequestInit = {
    method: 'GET',
    redirect: 'follow',
    credentials: 'include',
  };
  const response = await fetchWithRefresh(url, options);
  if (!response.ok) {
    const error: any = new Error(response.statusText || 'Request failed');
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const resHeaders: Record<string, string> = {};
  for (const [key, value] of response.headers.entries()) {
    resHeaders[key.toLowerCase()] = value;
  }
  return { data, headers: resHeaders };
};

export const errorHandling = async (res: Response) => {
  if (!res.ok) {
    let data: any;

    try {
      data = await res.json();
    } catch {
      data = null;
    }

    const detail =
      typeof data?.detail === 'string'
        ? data.detail
        : Array.isArray(data?.detail)
          ? data.detail
              .map((item: { msg?: string }) => item?.msg)
              .filter(Boolean)
              .join(', ')
          : res.statusText || 'Request failed';

    const error: any = new Error(detail || 'Request failed');
    error.status = res.status;
    error.data = data;
    error.detail = data?.detail;
    throw error;
  }
  return res.json();
};

export interface CustomResponseTyping {
  success: boolean;
  data: any;
  status: number;
  HTTPmessage: string;
}

export const getResponseMetadata = async (response: Response): Promise<CustomResponseTyping> => {
  let data: any = null;

  // Safely attempt to parse the response body as JSON.
  // This prevents errors if the response is empty (e.g., 204 No Content) or not valid JSON.
  try {
    data = await response.json();
  } catch (error) {
    console.warn('Failed to parse response JSON in getResponseMetadata', {
      status: response.status,
      statusText: response.statusText,
      error,
    });
  }

  return {
    success: response.status === 200,
    data,
    status: response.status,
    HTTPmessage: response.statusText,
  };
};

export const revalidateTags = async (tags: string[]) => {
  const uniqueTags = [...new Set(tags)]
    .filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
    .map((tag) => tag.trim());

  if (uniqueTags.length === 0) {
    return;
  }

  const baseUrl = typeof globalThis.window !== 'undefined' ? globalThis.location.origin : '';
  const endpoint = `${baseUrl}/api/revalidate`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ tags: uniqueTags }),
    });

    if (!response.ok) {
      throw new Error(`Failed to revalidate tags (${response.status})`);
    }
  } catch (error) {
    console.warn('Failed to revalidate tags via POST, falling back to per-tag requests', {
      tags: uniqueTags,
      error,
    });
    await Promise.all(
      uniqueTags.map((tag) => {
        const url = `${endpoint}?tag=${encodeURIComponent(tag)}`;
        return fetch(url, { credentials: 'include' });
      }),
    );
  }
};
