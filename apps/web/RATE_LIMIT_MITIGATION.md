# Rate-Limit (429) Mitigation Strategy

The upstream Nginx proxy at `cs-mooc.tou.edu.kz` applies request rate limits that can trigger HTTP
429 errors during initial page loads when many JS chunks are fetched in parallel.

This document summarises the applied changes and recommends further hardening.

---

## Applied Changes

### 1. Service Worker (`public/sw.js`)

| Feature                    | Description                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Cache-first for chunks** | `/_next/static/chunks/*` are served from Cache Storage after first fetch, eliminating repeat downloads. |
| **Concurrency limiter**    | Only 4 network requests are issued at a time; additional requests queue until a slot is free.           |
| **Retry on 429**           | Exponential backoff with jitter; honours `Retry-After` header when present.                             |
| **API caching**            | GET `/api/*` requests are network-first but cached for offline fallback.                                |

### 2. `fetchWithRetry` helper (`lib/fetchWithRetry.ts`)

A thin fetch wrapper with:

- Up to 5 retries with exponential back-off (base 500 ms).
- `Retry-After` header parsing (seconds or HTTP-date).
- Random jitter to spread out retry storms.

Imported by `services/auth/auth.ts` for login, session, profile, refresh, logout, signup calls.

### 3. SWR & SessionProvider tuning (`app/client-layout.tsx`)

| Setting                           | Value | Reason                                            |
| --------------------------------- | ----- | ------------------------------------------------- |
| `dedupingInterval`                | 60 s  | Avoids duplicate in-flight requests for same key. |
| `focusThrottleInterval`           | 60 s  | Prevents refetch flood when tabbing back.         |
| `revalidateOnFocus`               | false | Disables automatic refetch on window focus.       |
| `SessionProvider.refetchInterval` | 5 min | Reduces `/api/auth/session` polling.              |
| `refetchOnWindowFocus`            | false | Same as above.                                    |

---

## Testing Locally

```bash
# Build production bundle
pnpm build

# Start production server (uses SW in prod mode)
pnpm start
```

1. Open DevTools → Application → Service Workers. Confirm `sw.js` is active.
2. Throttle network to "Slow 3G" and reload. Watch Network tab – chunks should come from
   ServiceWorker after first load.
3. Open Console; you should see `ServiceWorker registered: /`.

---

## Further Hardening Recommendations

1. **Reduce chunk count** – Enable `experimental.optimizePackageImports` in `next.config.ts` and
   audit barrel exports.
2. **External CDN** – Serve `/_next/static/*` from Cloudflare/Vercel Edge to bypass Nginx limits
   entirely.
3. **Brotli pre-compression** – Smaller payloads = fewer bytes per request window.
4. **HTTP/2 or HTTP/3** – Multiplexing reduces connection overhead; talk to university IT.
5. **Rate-limit awareness in API calls** – Add retry logic to remaining services (courses, blocks,
   etc.) using `fetchWithRetry`.

---

## Files Changed

| File                    | Change                             |
| ----------------------- | ---------------------------------- |
| `public/sw.js`          | New – service worker               |
| `lib/fetchWithRetry.ts` | New – retry wrapper                |
| `app/client-layout.tsx` | Added SW registration + SWR tuning |
| `services/auth/auth.ts` | Switched to `fetchWithRetry`       |
