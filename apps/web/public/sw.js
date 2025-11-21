/// <reference lib="webworker" />
/* eslint-env serviceworker */

const sw = /** @type {ServiceWorkerGlobalScope & typeof globalThis} */ (/** @type {unknown} */ (self));
const CACHE_NAME = 'next-asset-cache-v1';
const MAX_PARALLEL_REQUESTS = 2;
const MAX_RETRIES = 5;
const ASSET_PATH_REGEX = /\/_next\/static\/.+\.(?:js|css)$/;

sw.addEventListener('install', (event) => {
  sw.skipWaiting();
  event.waitUntil(Promise.resolve());
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return undefined;
          }),
        ),
      )
      .then(() => sw.clients.claim()),
  );
});

sw.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    sw.skipWaiting();
  }
});

const queue = [];
let activeCount = 0;

function schedule(task) {
  return new Promise((resolve, reject) => {
    const run = async () => {
      activeCount += 1;
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      } finally {
        activeCount -= 1;
        const nextTask = queue.shift();
        if (nextTask) {
          nextTask();
        }
      }
    };

    if (activeCount < MAX_PARALLEL_REQUESTS) {
      run();
    } else {
      queue.push(run);
    }
  });
}

function parseRetryAfter(headerValue) {
  if (!headerValue) {
    return undefined;
  }

  const numericDelay = Number(headerValue);
  if (!Number.isNaN(numericDelay)) {
    return numericDelay * 1000;
  }

  const retryDate = new Date(headerValue);
  const delay = retryDate.getTime() - Date.now();
  return Number.isFinite(delay) && delay > 0 ? delay : undefined;
}

function createBackoff(attempt) {
  const base = 750;
  const max = 15_000;
  const delay = Math.min(base * 2 ** (attempt - 1), max);
  const jitter = Math.random() * 250;
  return delay + jitter;
}

async function fetchWithRetry(request, attempt = 1) {
  const response = await fetch(request.clone());

  if (response.status !== 429 || attempt >= MAX_RETRIES) {
    return response;
  }

  const retryHeader = response.headers.get('Retry-After');
  const retryDelay = parseRetryAfter(retryHeader) ?? createBackoff(attempt);

  await new Promise((resolve) => setTimeout(resolve, retryDelay));
  return fetchWithRetry(request, attempt + 1);
}

sw.addEventListener('fetch', (event) => {
  const { request } = /** @type {FetchEvent} */ (event);

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== sw.location.origin) {
    return;
  }

  if (!ASSET_PATH_REGEX.test(url.pathname)) {
    return;
  }

  event.respondWith(
    schedule(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreVary: true });

      if (cached) {
        return cached;
      }

      try {
        const networkResponse = await fetchWithRetry(request);
        if (networkResponse.ok) {
          cache.put(request, networkResponse.clone()).catch(() => {
            /* ignore put errors */
          });
        }
        return networkResponse;
      } catch (error) {
        if (cached) {
          return cached;
        }
        throw error;
      }
    }),
  );
});

