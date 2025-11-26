/* Service Worker for LearnHouse
   - Caches `_next/static/chunks/*` (cache-first)
   - Handles `/api/*` requests with network-first and retry-on-429
   - Limits concurrent network fetches to reduce Nginx rate bursts
   - Retries 429 responses obeying `Retry-After` header or exponential backoff with jitter
*/

const CACHE_NAME = 'ashyq-bilim-sw-v1';
const MAX_CONCURRENT = 4;
let activeFetches = 0;
const queue = [];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function doFetchWithRetry(request, maxAttempts = 5) {
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch(request.clone(), { credentials: 'same-origin' });
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
  return fetch(request, { credentials: 'same-origin' });
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

  // Handle Next.js chunk assets cache-first to reduce repeated downloads
  if (url.pathname.startsWith('/_next/static/chunks/')) {
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

  // For API GET requests, do network-first with retry and fallback to cache
  if (url.pathname.startsWith('/api/') && event.request.method === 'GET') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await enqueueRequest(event.request);
        if (response && response.ok) {
          // Put in cache for offline fallback (beware of stale auth)
          cache.put(event.request, response.clone()).catch(() => {});
        }
        return response;
      } catch (err) {
        // If network fails, return cached response if any
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // Let other requests pass through uncontrolled
});
