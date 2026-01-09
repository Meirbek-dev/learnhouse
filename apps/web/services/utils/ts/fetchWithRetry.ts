export type FetchWithRetryOptions = {
  retries?: number;
  backoffBaseMs?: number;
  maxBackoffMs?: number;
  retryOn?: number[]; // HTTP statuses to retry
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchWithRetry(input: RequestInfo, init?: RequestInit, opts?: FetchWithRetryOptions) {
  const { retries = 3, backoffBaseMs = 300, maxBackoffMs = 10_000, retryOn = [429, 502, 503, 504] } = opts || {};

  let attempt = 0;
  while (true) {
    attempt += 1;
    const res = await fetch(input, init);

    // If successful or not in retry list, return (caller will handle non-ok via existing helpers)
    if (res.ok || !retryOn.includes(res.status) || attempt > retries) {
      return res;
    }

    // If 429 and there's a Retry-After header, respect it (seconds or HTTP-date)
    const retryAfter = res.headers.get('Retry-After');
    if (res.status === 429 && retryAfter) {
      const parsed = Number(retryAfter);
      if (Number.isFinite(parsed) && parsed >= 0) {
        const waitMs = Math.min(parsed * 1000, maxBackoffMs);
        await sleep(waitMs + jitter(waitMs));
        continue;
      }
      // Try to parse HTTP-date
      const date = Date.parse(retryAfter);
      if (!isNaN(date)) {
        const waitMs = Math.max(date - Date.now(), 0);
        await sleep(Math.min(waitMs, maxBackoffMs) + jitter(waitMs));
        continue;
      }
    }

    // Exponential backoff with full jitter
    const backoff = Math.min(backoffBaseMs * 2 ** (attempt - 1), maxBackoffMs);
    await sleep(backoff + jitter(backoff));
  }
}

function jitter(ms: number) {
  // up to 30% jitter
  return Math.floor(Math.random() * Math.max(1, Math.floor(ms * 0.3)));
}
