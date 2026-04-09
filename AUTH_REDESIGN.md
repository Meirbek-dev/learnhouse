# Auth System Redesign Plan

## Critical Issues (Current State)

### 1. Every protected page makes a full HTTP round-trip to validate the session

`getSession()` in `session.ts` calls `POST /users/session` on every server render — even though the
access token is a self-contained signed JWT sitting right in the cookie. This is the single biggest
architectural flaw: every RSC render of a protected page = 1 synchronous network call to the backend,
adding latency proportional to internal service round-trip time, even under zero real auth work.

### 3. Refresh route violates HTTP semantics and adds unnecessary latency

`/app/api/auth/refresh/route.ts` exposes a `GET` handler that mutates state (rotates tokens, writes
to Redis, creates a new session). GET must be idempotent. Additionally, this adds a Next.js API
route as a proxy in front of the FastAPI refresh endpoint — two hops where one is sufficient.

### 4. Cookie bridge is bespoke and fragile

`cookie-bridge.ts` contains a hand-rolled `splitCombinedSetCookieHeader` parser to work around
environments where `headers.getSetCookie()` isn't available. In Next.js 15 the `getSetCookie()`
method is standard. The fallback parser has known edge cases with the `Expires` attribute (the code
uses a string scan, not a proper RFC 6265 parser) and will silently drop cookies on malformed input.

### 5. Redis user-session set accumulates stale entries

`user_sessions:{user_id}` is a plain Redis `SET` containing session IDs. Each individual session
expires (via its own TTL key), but the set itself has a 30-day TTL and is never pruned of expired
IDs. On `revoke_all_user_sessions`, the code iterates this set, gets each session key, and batch-
deletes them — but expired entries that have already vanished from Redis are silently iterated as
dead weight. Over time, active users accumulate thousands of stale session IDs in this set.

### 6. Audit writes are synchronous on the authentication hot path

PostgreSQL audit writes in `sessions.py` are described as "best-effort sync writes" and are called
directly inside `create_auth_session`, `rotate_session`, and `revoke_session`. A slow or locked
PostgreSQL write adds latency to login and token refresh. Failure to write the audit record is
silently swallowed (`except Exception: pass`), making audit completeness unverifiable.

### 7. Roles can be stale for up to 30 minutes

Roles are embedded in the JWT payload at issuance time. A role change takes effect only when the
current access token expires and is refreshed. There is no mechanism to force immediate re-evaluation
short of revoking the entire session. For an educational platform where instructors and students may
be promoted/demoted mid-session, this is a real operational gap.

### 8. `SameSite=strict` on the refresh cookie blocks legitimate cross-origin redirects

The OAuth callback is a cross-site redirect from Google back to the platform. With `SameSite=strict`,
any cookie read during the redirect would be dropped. While state is passed as a URL param (avoiding
that specific issue), the pattern is fragile. The `state` cookie (if ever added) would silently
fail, and some social login integrations would break without obvious errors.

### 9. The `SessionProvider` is static and carries no updatability

`SessionProvider` accepts `initialSession` and creates a frozen context object. There is no way for
client components to trigger a re-authentication check, force a refresh, or react to token expiry
without a full page reload. This makes optimistic auth updates (e.g., post-OAuth redirect, role
change) impossible without reloading.

### 10. Double-hop API architecture for every authenticated server action

Server Actions in `auth.ts` call `fetch(getServerAPIUrl() + 'auth/...')` — hitting FastAPI
directly. But regular page data-fetching goes through the same `getServerAPIUrl()` path. There is no
consistent API client contract; some code uses `api-client.ts`, some calls fetch directly with
manually assembled cookie headers. Inconsistency creates silent bugs when cookies aren't forwarded.

---

## Redesign: Goals

- **Eliminate the per-request round-trip**: verify the JWT locally using the Ed25519 public key
- **Move route protection to middleware**: intercept at the edge before React renders
- **Simplify cookie management**: leverage Next.js 15 cookie APIs, remove the custom parser
- **Fix Redis data model**: prevent set growth, enable efficient per-session expiry
- **Make audit truly async**: decouple audit from the response path entirely
- **Add roles invalidation**: short-circuit stale roles without full session revocation
- **Make session context reactive**: support refresh without page reload

---

## Redesign Plan

### Phase 1 — Backend hardening (no frontend impact)

#### 1.1 Replace Redis SET with Sorted Set for user sessions

**Current**: `user_sessions:{user_id}` → plain SET of session IDs, 30-day global TTL

**New**: `user_sessions:{user_id}` → Sorted Set where score = `absolute_expires_at` (unix seconds)

```python
# On session create
await redis.zadd(f"user_sessions:{user_id}", {session_id: absolute_expires_at})

# On session revoke/rotate: remove the specific member
await redis.zrem(f"user_sessions:{user_id}", session_id)

# Periodic or on-read cleanup: remove expired members
await redis.zremrangebyscore(f"user_sessions:{user_id}", 0, int(time.time()))

# Get all active sessions (for logout-all)
active_sessions = await redis.zrangebyscore(
    f"user_sessions:{user_id}", int(time.time()), "+inf"
)
```

This makes `revoke_all_user_sessions` iterate only genuinely active sessions, and the set never
grows unboundedly. No scheduled cleanup job required — prune in-place on each write.

#### 1.2 Move audit writes to FastAPI BackgroundTasks

Every auth endpoint (`login`, `refresh`, `logout`) currently awaits a PostgreSQL audit write inline.
Move all audit writes to `BackgroundTasks` so the response is returned immediately.

```python
# Before (blocks response):
await log_auth_event(AuditEvent.login_success, user_id=user.id, ...)
return response

# After (fire-and-forget, doesn't block):
background_tasks.add_task(log_auth_event, AuditEvent.login_success, user_id=user.id, ...)
return response
```

Apply to: `login`, `refresh`, `logout`, `logout_all`, `google/callback`.

The audit table is append-only and best-effort by design — moving it to background is semantically
identical with a latency improvement on every auth operation.

#### 1.3 Add a `roles_version` claim and Redis invalidation key

To support immediate role invalidation without revoking sessions:

**JWT access token** gains a new claim: `"rvs": <unix_timestamp>` — the timestamp at which roles
were last embedded.

**Redis key**: `roles_updated:{user_id}` → unix timestamp of last role change. Set whenever a role
is assigned or removed. TTL = ACCESS_TOKEN_EXPIRE (30 min) — after the access token rotates, the
check is irrelevant.

**In `get_current_user()` dependency** (runs on every authenticated request):

```python
roles_updated_at = await redis.get(f"roles_updated:{payload.sub}")
if roles_updated_at and int(roles_updated_at) > payload.rvs:
    raise TokenRolesStaleError()  # → 401 with WWW-Authenticate: Bearer error="roles_stale"
```

**On frontend**: the 401 with `error="roles_stale"` header triggers a silent token refresh (not a
logout). After refresh, the new token embeds current roles. Users never see an interruption.

Set `roles_updated:{user_id}` whenever roles change in the users/roles management endpoints.

#### 1.4 Expose a JWKS endpoint

Add `GET /auth/.well-known/jwks.json` that returns the Ed25519 public key in JWK format:

```json
{
  "keys": [
    {
      "kty": "OKP",
      "crv": "Ed25519",
      "x": "<base64url-encoded public key>",
      "kid": "v1",
      "use": "sig",
      "alg": "EdDSA"
    }
  ]
}
```

This enables the Next.js server to fetch and cache the public key and verify JWTs locally. The
endpoint is public (no auth required) and can be served with a long `Cache-Control` max-age.

#### 1.5 Fix `SameSite` for OAuth cookies

Change `SameSite=strict` → `SameSite=lax` for the **access token cookie only**. The refresh cookie
retains `strict` (it's already path-restricted to `/api/auth/refresh` and never sent cross-site).

`Lax` still protects against CSRF for state-mutating requests (POST/PUT/DELETE) while allowing the
access token to be included in top-level cross-site navigations (e.g., OAuth callback redirects,
email magic links).

---

### Phase 2 — Frontend middleware & local JWT verification

#### 2.1 Add `middleware.ts` with edge JWT verification

Create `apps/web/middleware.ts`. This runs at the edge (Vercel Edge Runtime or Node.js middleware)
before React renders anything.

**Responsibilities**:

1. Attach `x-pathname` header to all requests (fixes the existing bug in `requireSession()`)
2. For protected routes: verify the access token locally
3. If token missing or expired: redirect to refresh bridge, then login
4. If token valid: forward with injected `x-user-id`, `x-session-id` headers for downstream use
5. For auth routes (login, signup): if token valid, redirect to dashboard

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { isProtectedRoute, isAuthRoute } from '@/lib/auth/routes';
import { ACCESS_TOKEN_COOKIE_NAME } from '@/lib/auth/constants';

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.INTERNAL_API_URL}/auth/.well-known/jwks.json`)
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // Always inject x-pathname so requireSession() can build returnTo correctly
  response.headers.set('x-pathname', pathname);

  const token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value;

  if (isProtectedRoute(pathname)) {
    if (!token) {
      return redirectToRefresh(request, pathname);
    }
    try {
      await jwtVerify(token, JWKS, {
        issuer: 'ashyq-bilim-auth',
        audience: 'ashyq-bilim-api',
        algorithms: ['EdDSA'],
      });
      return response;
    } catch {
      // Token invalid or expired → try refresh
      return redirectToRefresh(request, pathname);
    }
  }

  if (isAuthRoute(pathname) && token) {
    try {
      await jwtVerify(token, JWKS, { issuer: 'ashyq-bilim-auth', audience: 'ashyq-bilim-api', algorithms: ['EdDSA'] });
      return NextResponse.redirect(new URL('/dash', request.url));
    } catch {
      // Token expired/invalid — let through to login page
    }
  }

  return response;
}

function redirectToRefresh(request: NextRequest, returnTo: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = '/api/auth/refresh';
  url.searchParams.set('returnTo', returnTo);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
};
```

**JWKS caching**: `createRemoteJWKSet` from `jose` caches the key in memory and re-fetches only on
key rotation (when KID doesn't match). No manual caching needed. The key almost never changes.

#### 2.2 Rewrite `getSession()` — verify locally, skip the backend call

Once the Ed25519 public key is available via JWKS, `getSession()` can verify the JWT locally and
decode claims directly. The backend `/users/session` call is eliminated from the hot path.

```typescript
// lib/auth/session.ts
import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { ACCESS_TOKEN_COOKIE_NAME } from './constants';
import type { Session, AccessTokenPayload } from './types';

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.INTERNAL_API_URL}/auth/.well-known/jwks.json`)
);

export const getSession = cache(async (): Promise<Session | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_TOKEN_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify<AccessTokenPayload>(token, JWKS, {
      issuer: 'ashyq-bilim-auth',
      audience: 'ashyq-bilim-api',
      algorithms: ['EdDSA'],
    });
    return {
      user: { id: payload.sub, ...payload.user_claims },
      roles: payload.roles,
      permissions: expandPermissions(payload.roles),
      expiresAt: payload.exp! * 1000,
      sessionVersion: payload.iat ?? null,
    };
  } catch {
    return null;
  }
});
```

**Tradeoff acknowledged**: local verification cannot detect a JTI that was blocklisted between
issuance and this request (e.g., if logout happened on another device in the last 30 min). This is
acceptable because:

- Blocklisted JTIs expire from Redis automatically when the token would have expired anyway
- The window is ≤30 minutes (access token TTL)
- The refresh token is still validated server-side on every rotation
- Any truly security-critical operation (payment, role escalation) should call the backend directly

For the session endpoint to remain useful (e.g., admin panels that need live role data), keep
`GET /users/session` available but stop calling it on every page render.

#### 2.3 Embed user display claims in the access token

Currently the backend `/users/session` is needed because the JWT only contains `sub` (uuid), roles,
JTI, and SID — no display fields. Add a `user_claims` sub-object to the JWT payload:

```python
# In create_access_token():
payload = {
  "sub": str(user.uuid),
  "jti": str(uuid4()),
  "sid": session_id,
  "iss": "ashyq-bilim-auth",
  "aud": "ashyq-bilim-api",
  "iat": now,
  "exp": now + ACCESS_TOKEN_EXPIRE,
  "rvs": int(now),           # roles version timestamp
  "roles": [r.slug for r in roles],
  "type": "access",
  "u": {                     # user display claims (small, stable data only)
    "name": user.full_name,
    "email": user.email,
    "avatar": user.avatar_url,
    "username": user.username,
  }
}
```

Keep `u` minimal — no sensitive data, only what's needed to render the UI without a backend call.
These are display fields that rarely change; staleness for 30 min is acceptable.

#### 2.4 Fix the refresh route — POST only, no double-hop

Rename `/app/api/auth/refresh/route.ts` to export only `POST`. Remove the `GET` handler.

For the middleware redirect, update `redirectToRefresh` to use a redirect to the refresh route,
which internally POSTs to the FastAPI backend. Keep the current proxy pattern (it's necessary since
the browser can't directly POST to FastAPI during a navigation), but enforce correct semantics.

#### 2.5 Remove the custom Set-Cookie parser

`splitCombinedSetCookieHeader` in `cookie-bridge.ts` is dead weight in Next.js 15. The fallback
path in `getSetCookieHeaders()` is only needed for environments without `headers.getSetCookie()`.

Drop the fallback and rely on the standard API:

```typescript
export function getSetCookieHeaders(headers: Headers): string[] {
  return headers.getSetCookie(); // standard in Next.js 15 / Node 18+
}
```

If cross-environment compatibility is required, use the `set-cookie-parser` npm package (battle-
tested RFC 6265 compliant) instead of the hand-rolled parser.

#### 2.6 Make SessionProvider reactive

Add a `refresh()` method to the session context so client components can trigger a soft re-auth
check (e.g., after an OAuth popup, after a role change notification via WebSocket):

```typescript
interface SessionContextValue {
  isAuthenticated: boolean;
  session: Session | null;
  user: Session['user'] | null;
  refresh: () => Promise<void>;  // triggers router.refresh() → reloads RSCs
}

export function SessionProvider({ children, initialSession = null }) {
  const router = useRouter();
  const [session, setSession] = useState(initialSession);

  const refresh = useCallback(async () => {
    router.refresh(); // Next.js reloads all RSC data without a full page reload
  }, [router]);

  const value = useMemo(() => ({
    isAuthenticated: session?.user !== undefined,
    session,
    user: session?.user ?? null,
    refresh,
  }), [session, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
```

`router.refresh()` in Next.js 15 re-fetches all RSC components and re-runs `getSession()` server-
side. The client receives a fresh render without a navigation.

---

### Phase 3 — Consistency and cleanup

#### 3.1 Standardize the API client

Audit all `fetch()` calls in `apps/web`. Every server-side call that needs auth must go through
`api-client.ts` — no raw `fetch` with manual cookie assembly. Create a typed wrapper:

```typescript
// lib/api-client.ts: add a server-side helper
export async function serverFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const cookieHeader = buildAuthCookieHeader(cookieStore);
  const res = await fetch(`${getServerAPIUrl()}${path}`, {
    ...init,
    headers: { ...init?.headers, Cookie: cookieHeader },
    cache: 'no-store',
  });
  if (!res.ok) throw new APIError(res.status, await res.text());
  return res.json();
}
```

All server actions (`loginAction`, `signupAction`, `logoutAction`) use `serverFetch`. The manual
`Cookie` header construction is centralized in one place.

#### 3.2 Fix `requireSession()` — use middleware-injected header

The `x-pathname` header will now always be set by middleware (Phase 2.1). Remove the try/catch
fallback in `requireSession()`:

```typescript
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const headersList = await headers();
    const returnTo = headersList.get('x-pathname') ?? '/';
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return session;
}
```

#### 3.3 Unify `SessionProvider` and `PermissionProvider`

`PermissionProvider` derives `can()` from the session's permissions array. This is purely derived
data — it doesn't need its own provider. Merge into `SessionProvider`:

```typescript
interface SessionContextValue {
  isAuthenticated: boolean;
  session: Session | null;
  user: Session['user'] | null;
  can: (resource: string, action: string, scope?: string) => boolean;
  refresh: () => Promise<void>;
}
```

The `can()` function is a closure over `session.permissions` — no extra state, no extra provider,
no extra context lookup.

---

## Summary: What Changes and Why

| Issue | Fix | Impact |
|---|---|---|
| Per-request HTTP round-trip to `/users/session` | Local JWT verification via JWKS | Eliminates 1 network call per protected page render |
| No middleware — guards run inside React | `middleware.ts` with edge JWT check | Unauthenticated requests rejected before rendering |
| GET handler mutates session state | Remove GET, POST only for refresh | Correct HTTP semantics, safe for CDN caching |
| Hand-rolled Set-Cookie parser | Use `headers.getSetCookie()` | Remove ~60 lines of fragile custom code |
| Redis SET accumulates stale session IDs | Sorted Set with score = expiry | Accurate membership, no unbounded growth |
| Audit writes block auth responses | `BackgroundTasks` for all audit writes | Removes DB latency from login/refresh/logout |
| Roles stale for up to 30 min | `rvs` claim + Redis invalidation key | Role changes take effect on next request |
| `x-pathname` header never set | Add `middleware.ts` (fixes existing bug) | `returnTo` redirect works correctly after login |
| SessionProvider is static | Add `refresh()` method | Client can re-auth without page reload |
| Two providers for session + permissions | Merge into one | Less indirection, single `can()` call site |

## What Does NOT Change

- EdDSA (Ed25519) signing — already best-in-class
- HttpOnly + Strict cookies — keep as-is (change access token to Lax per §1.5)
- Token family / refresh token rotation — correct design, keep
- JTI blocklist pattern — keep (blocklist on logout, expire naturally)
- Sliding window + hard cap session lifetimes — keep
- Redis sliding-window rate limiting — keep
- Argon2 password hashing — keep
- RBAC structure (`resource:action:scope`) — keep
- Google OAuth flow structure — keep (fix SameSite per §1.5)
- Audit table schema — keep (just move writes to background)
