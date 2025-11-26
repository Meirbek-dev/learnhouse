/* Service Worker for LearnHouse
   - Caches `_next/static/chunks/*` and `_next/static/css/*` (cache-first)
   - Does NOT intercept API calls (they should go through normally)
   - Limits concurrent network fetches for static assets only

   IMPORTANT: API calls are NOT intercepted to avoid duplicate requests.
   The browser already handles API calls properly with retry logic in fetchWithRetry.ts
*/

const CACHE_NAME = 'ashyq-bilim-sw-v2';
const MAX_CONCURRENT = 6;
let activeFetches = 0;
const queue = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function doFetchWithRetry(request, maxAttempts = 3) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(request.clone());
      if (response.status === 429) {
        const ra = response.headers.get('Retry-After');
        let wait = 1000 * Math.pow(2, attempt - 1); // exponential base
        if (ra) {
          const parsed = Number(ra);
          if (!Number.isNaN(parsed)) {
            wait = parsed * 1000;
          } else {
            // try HTTP-date
            const then = Date.parse(ra);
            if (!Number.isNaN(then)) {
              wait = Math.max(1000, then - Date.now());
            }
          }
        }
        // jitter
        wait = Math.floor(wait * (0.5 + Math.random() * 0.5));
        await sleep(wait);
        continue; // retry
      }

      // For other statuses, return as-is (including 200, 404, 500...)
      return response;
    } catch (err) {
      // Network error -> backoff
      const wait = Math.floor(500 * Math.pow(2, attempt - 1) * (0.5 + Math.random() * 0.5));
      await sleep(wait);
      continue;
    }
  }
  // Final attempt without retry
  return fetch(request);
}

function enqueueRequest(request) {
  return new Promise((resolve, reject) => {
    queue.push({ request, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (activeFetches >= MAX_CONCURRENT || queue.length === 0) return;
  const item = queue.shift();
  activeFetches++;
  (async () => {
    try {
      const response = await doFetchWithRetry(item.request);
      item.resolve(response);
    } catch (err) {
      item.reject(err);
    } finally {
      activeFetches--;
      // process next waiting request
      setTimeout(processQueue, 0);
    }
  })();
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Cleanup old caches that do not match CACHE_NAME
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => { if (k !== CACHE_NAME) return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return; // let the network handle cross-origin
  }

  // Skip navigation requests - let Next.js handle routing
  if (event.request.mode === 'navigate') {
    return;
  }

  // Skip API requests entirely - don't intercept them
  // This prevents duplicate requests (browser + SW both fetching)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Handle Next.js static assets cache-first to reduce repeated downloads
  // This includes JS chunks and CSS files
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) return cached;

      // Enqueue to limit concurrency and retry on 429
      try {
        const response = await enqueueRequest(event.request);
        if (response && response.ok) {
          // Clone and store non-error responses
          cache.put(event.request, response.clone()).catch(() => {});
        }
        return response;
      } catch (err) {
        // Final fallback: network (may fail)
        return fetch(event.request);
      }
    })());
    return;
  }

  // Let other requests pass through uncontrolled
});
