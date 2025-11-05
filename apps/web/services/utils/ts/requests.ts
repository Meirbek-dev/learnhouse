import { getUriWithOrg } from '@services/config/config';

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
    token?: string;
    next?: any;
    isJson?: boolean;
    // When true, only adds a body for POST, PUT, or DELETE methods.
    limitBodyToMethods?: boolean;
  },
): RequestInit & { next?: any } => {
  const { data, token, next, isJson = true, limitBodyToMethods = false } = config;

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

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

  const shouldSetBody = data !== null && (!limitBodyToMethods || ['POST', 'PUT', 'DELETE'].includes(method));

  if (shouldSetBody) {
    options.body = isJson ? JSON.stringify(data) : data;
  }

  return options;
};

// --- EXPORTED FUNCTIONS (UNCHANGED SIGNATURES) ---

export const RequestBody = (method: string, data: any, next: any) => {
  return createRequestInit(method, { data, next });
};

export const RequestBodyWithAuthHeader = (method: string, data: any, next: any, token?: string) => {
  return createRequestInit(method, {
    data,
    next,
    token,
    limitBodyToMethods: true,
  });
};

/**
 * Note: This function stringifies the body but does not set the
 * 'Content-Type': 'application/json' header. This behavior is preserved
 * for backwards compatibility but may be unintended.
 */
export const RequestBodyForm = (method: string, data: any, next: any) => {
  const options: RequestInit & { next?: any } = {
    method,
    headers: {},
    redirect: 'follow',
    credentials: 'include',
  };

  const { next: sanitizedNext, cache } = sanitizeFetchConfig(next);
  if (cache) {
    options.cache = cache;
  }
  if (sanitizedNext) {
    options.next = sanitizedNext;
  }

  if (method === 'POST' || method === 'PUT') {
    options.body = JSON.stringify(data);
  }
  return options;
};

export const RequestBodyFormWithAuthHeader = (method: string, data: any, next: any, access_token: string) => {
  // Handles FormData, so isJson is false.
  return createRequestInit(method, {
    data,
    next,
    token: access_token,
    isJson: false,
  });
};

export const swrFetcher = async (url: string, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const options: RequestInit = {
    method: 'GET',
    headers,
    redirect: 'follow',
    credentials: 'include',
  };
  // The fetch call will throw on network error, and errorHandling throws on non-ok status.
  // The redundant try/catch block has been removed.
  const response = await fetch(url, options);
  return errorHandling(response);
};

export const errorHandling = (res: Response) => {
  if (!res.ok) {
    const error: any = new Error(res.statusText || 'Request failed');
    error.status = res.status;
    throw error;
  }
  return res.json();
};

interface CustomResponseTyping {
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
  } catch {
    // Ignore parsing error; data will remain null.
  }

  return {
    success: response.status === 200,
    data,
    status: response.status,
    HTTPmessage: response.statusText,
  };
};

export const revalidateTags = async (tags: string[], orgslug: string) => {
  // Use relative URL to avoid mixed content issues and ensure same protocol as current page
  // This works both server-side and client-side
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const promises = tags.map((tag) => fetch(`${baseUrl}/api/revalidate?tag=${tag}`));
  await Promise.all(promises);
};
