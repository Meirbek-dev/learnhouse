export interface FetchRetryOptions {
  retries?: number;
  baseDelay?: number; // ms
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  opts?: FetchRetryOptions,
): Promise<Response> {
  const { retries = 5, baseDelay = 500 } = opts || {};

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(input, init);

      if (res.status === 429) {
        // Honor Retry-After header if present
        const ra = res.headers.get('Retry-After');
        let wait = baseDelay * 2 ** (attempt - 1);
        if (ra) {
          const parsed = Number(ra);
          if (!Number.isNaN(parsed)) {
            wait = parsed * 1000;
          } else {
            const date = Date.parse(ra);
            if (!Number.isNaN(date)) {
              wait = Math.max(1000, date - Date.now());
            }
          }
        }
        // jitter
        wait = Math.floor(wait * (0.5 + Math.random() * 0.5));
        await sleep(wait);
        continue;
      }

      return res;
    } catch (error) {
      const isAbortError = error instanceof Error && error.name === 'AbortError';
      if (isAbortError) {
        console.warn('[fetchWithRetry] Request aborted; skipping retries', { input });
        throw error;
      }

      console.warn('[fetchWithRetry] Request failed, retrying', {
        attempt,
        retries,
        input,
        error,
      });

      if (attempt === retries) throw error;
      const wait = Math.floor(baseDelay * 2 ** (attempt - 1) * (0.5 + Math.random() * 0.5));
      await sleep(wait);
      continue;
    }
  }

  // final try
  return fetch(input, init);
}
