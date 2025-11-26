export interface FetchRetryOptions {
  retries?: number;
  baseDelay?: number; // ms
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithRetry(input: RequestInfo, init?: RequestInit, opts?: FetchRetryOptions): Promise<Response> {
  const { retries = 5, baseDelay = 500 } = opts || {};

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);

      if (res.status === 429) {
        // Honor Retry-After header if present
        const ra = res.headers.get('Retry-After');
        let wait = baseDelay * Math.pow(2, attempt - 1);
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
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = Math.floor(baseDelay * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5));
      await sleep(wait);
      continue;
    }
  }

  // final try
  return fetch(input, init);
}
