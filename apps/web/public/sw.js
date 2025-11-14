/* Service Worker to limit concurrent requests for static chunks, retry on 429, and cache successful responses.
   Goals:
   - Reduce parallel requests to the origin to avoid triggering 429 from constrained upstream nginx.
   - Retry requests that return 429 with exponential backoff.
   - Cache successful responses so subsequent loads don't hit network.
*/

const CACHE_NAME = 'lh-static-assets-v1';
const MAX_CONCURRENCY = 6; // limit parallel network fetches
const MAX_RETRIES = 5;
const INITIAL_BACKOFF = 300; // ms

let inFlight = 0;
const queue = [];

function shouldHandleRequest(req) {
  try {
    const url = new URL(req.url);
    // Handle same-origin JS chunks and next.js static assets
    if (url.origin !== self.location.origin) return false;
    if (req.destination === 'script') return true;
    if (url.pathname.startsWith('/_next/') || url.pathname.endsWith('.js')) return true;
    return false;
  } catch (e) {
    return false;
  }
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(request) {
  let attempt = 0;
  let backoff = INITIAL_BACKOFF;

  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      const response = await fetch(request.clone());
      if (response.status === 429) {
        // rate limited — retry with backoff
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 5000);
        continue;
      }

      // On success (200–399) cache and return
      if (response.ok) {
        try {
          const cache = await caches.open(CACHE_NAME);
          // clone before caching
          cache.put(request, response.clone()).catch(() => {});
        } catch (e) {
          // ignore cache errors
        }
        return response;
      }

      // For other statuses (502/503/etc), throw to let outer logic decide
      return response;
    } catch (err) {
      // network error, retry with backoff
      if (attempt >= MAX_RETRIES) throw err;
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 5000);
    }
  }

  // If all attempts fail, throw to allow fallback upstream
  throw new Error('fetchWithRetry: max retries exceeded');
}

function processQueue() {
  if (queue.length === 0) return;
  if (inFlight >= MAX_CONCURRENCY) return;

  const item = queue.shift();
  if (!item) return;

  inFlight++;
  (async () => {
    try {
      // First check cache — respond from cache if available
      const cached = await caches.match(item.request);
      if (cached) {
        item.resolve(cached);
        return;
      }

      // Not cached — fetch with retry and cache
      const response = await fetchWithRetry(item.request);
      item.resolve(response);
    } catch (err) {
      // Last resort: attempt a plain fetch (may still fail)
      try {
        const fallback = await fetch(item.request);
        item.resolve(fallback);
      } catch (e) {
        item.reject(e);
      }
    } finally {
      inFlight--;
      // schedule next
      setTimeout(processQueue, 0);
    }
  })();
}

self.addEventListener('install', (event) => {
  // Activate immediately so SW can start handling requests
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Claim clients so the SW can start intercepting without reload
      await self.clients.claim();
      // optional: cleanup old caches here if you bump CACHE_NAME
      const keys = await caches.keys();
      for (const key of keys) {
        if (key !== CACHE_NAME) await caches.delete(key);
      }
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!shouldHandleRequest(req)) return; // not our concern

  event.respondWith(
    new Promise((resolve, reject) => {
      queue.push({ request: req, resolve, reject });
      // kick off the queue processor
      processQueue();
    }),
  );
});

// Provide a message-based cache purge or diagnostics if needed in future
self.addEventListener('message', (ev) => {
  const data = ev.data || {};
  if (data && data.type === 'PURGE_CACHE') {
    caches.delete(CACHE_NAME);
  }
});
