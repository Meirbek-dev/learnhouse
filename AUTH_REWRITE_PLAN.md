# Auth System Rewrite Plan

**Date:** 2026-04-06
**Branch:** csmooc

---

## Part 1 — Critical Analysis of Current System

### What's Good

- HTTP-only cookies (no localStorage token storage)
- Argon2 password hashing
- Token family rotation with theft detection (`token_family_id`)
- Session revocation chain (`replaced_by_session_id`)
- RBAC with 3-part permissions (`resource:action:scope`) and scope resolution
- Structured session context (IP, user-agent)
- JWT state parameter for OAuth CSRF protection
- Dedicated `services/auth/auth.ts` client with input validation and custom `AuthError`

### Critical Vulnerabilities & Design Flaws

#### 1. HS256 Symmetric Signing — Single Point of Failure

```python
# security.py
ALGORITHM = "HS256"
secret_key = config.security.auth_jwt_secret_key
```

HS256 requires every service that verifies tokens to hold the signing secret. One compromised microservice or log leak = all tokens can be forged indefinitely. Asymmetric signing (**ES256** or **EdDSA/Ed25519**) means any service can verify using only the public key while the private key never leaves the auth service.

#### 2. No Access Token Revocation

JWTs are validated purely by signature + expiry. There is no JTI (JWT ID) claim and no blocklist. When a user logs out, `revoke_session()` marks the DB row — but the access token cookie is still cryptographically valid until expiry (up to 8 hours). An attacker who captures an access token has 8 hours of unrestricted API access with no way to stop them.

#### 3. Auth Middleware Fires on Every Request — Silent and Expensive

```python
# app.py
async def auth_cookie_refresh_middleware(request: Request, call_next):
    if no Authorization header AND refresh cookie present:
        validate access token...
        if invalid: rotate_session()  # DB write on every request
```

This middleware runs DB session lookups and writes on **every unauthenticated request that has a refresh cookie**. The frontend has no awareness that refresh is happening — it can receive silently rotated cookies it never explicitly requested. The frontend's own `getNewAccessTokenUsingRefreshTokenServer()` in `auth.ts` duplicates this logic, creating two independent refresh paths that can conflict.

#### 4. Two Parallel Token Refresh Paths That Can Conflict

Frontend has:
- **Path A:** `auth_cookie_refresh_middleware` (backend, implicit, fires on any request)
- **Path B:** `getNewAccessTokenUsingRefreshToken()` and `getNewAccessTokenUsingRefreshTokenServer()` in `services/auth/auth.ts` (frontend, explicit)

If both fire simultaneously (race condition during a burst of parallel requests when the access token just expired), the second refresh will attempt to use an already-rotated refresh token — triggering **token theft detection** and revoking the entire token family. The user gets logged out unexpectedly.

#### 5. Sentinel Pattern Pollutes Every Service File

```typescript
// lib/auth/server-access-token.ts
CLIENT_SESSION_ACCESS_TOKEN_SENTINEL = '__cookie_session__'

// Every single service file must call this:
const token = await resolveServerAccessToken(access_token)
```

`resolveServerAccessToken()` is called in `users.ts`, `profile.ts`, `password.ts`, `platform.ts`, `payments.ts`, `products.ts` — every file that touches the API. This creates an invisible contract: any new service file that forgets to call `resolveServerAccessToken()` will send `Authorization: Bearer __cookie_session__` to the API as a literal string, causing silent 401s with no obvious error. There is no type-level enforcement of this pattern.

#### 6. `auth.ts` (root) Makes a Network Call on Every Session Read

```typescript
// auth.ts
export async function auth(): Promise<AppSession | null> {
    const response = await fetch(`${apiUrl}/users/session`, ...)
    // Parses response, extracts Set-Cookie header, returns session
}
```

Every server component, middleware check, and `requireAuth()` call hits `/users/session` over the network. This is called from Next.js middleware (runs on every request), layout components, and individual page components — potentially multiple times per render tree. The access token is already in the cookie; it should be verified locally without a network round-trip.

#### 7. Google OAuth Lacks PKCE

```python
# google_oauth.py — state is JWT-signed but there is no code_verifier/code_challenge
```

The Authorization Code flow without PKCE is vulnerable to authorization code interception. PKCE (RFC 7636) is now mandated by RFC 9700 for all OAuth clients regardless of confidentiality.

#### 8. Password Reset Codes Are Brute-Forceable

```python
def generate_secure_code() -> str:
    return "".join(random.choices(string.ascii_letters + string.digits, k=5))
```

5 characters × 62-character alphabet = ~916M combinations. The only protection is Redis TTL (1 hour). There is no per-code attempt counter, no rate limiting on the verification endpoint specifically, and no single-use enforcement after a successful use. A fast attacker (100k req/s) can exhaust this in under 10 seconds.

#### 9. Sessions Live in PostgreSQL Hot Path

Every authenticated request resolves the session via `validate_active_session()` which queries the `auth_sessions` PostgreSQL table. PostgreSQL is not optimized for high-frequency keyed lookups with frequent TTL-based expiry. Sessions belong in Redis.

#### 10. No Structured Audit Log

`revoke_token_family()` (the token theft response) fires silently. There are print/log statements but no structured, queryable audit trail. Security-critical events — login failures, password changes, token theft detection, family revocations — have no durable record.

#### 11. Legacy `lib/server-auth.ts` Duplicates Session Logic

`requireAuth()`, `sessionCan()`, `requirePermission()`, `requireAnyPermission()` live in `lib/server-auth.ts` while session types live in `lib/auth/session.ts` and the actual session fetch lives in `auth.ts` (root). Three files for one responsibility. Any change to session shape requires touching all three.

---

## Part 2 — Rewrite Architecture

### Design Principles

1. **Single responsibility per file** — one file owns token creation, one owns cookie management, one owns sessions. No split logic.
2. **One refresh path** — clients own explicit token refresh; no implicit backend middleware refresh.
3. **Defense in depth** — JTI blocklist covers logout even if token isn't expired.
4. **Asymmetric signing** — private key never leaves the auth service; all verifiers use public key only.
5. **Audit everything** — security events are structured data, not log strings.
6. **Standards compliance** — RFC 6749, RFC 7519, RFC 7636 (PKCE), RFC 9700.

---

## Part 3 — Technical Specification

### 3.1 Token Architecture

#### Access Token (JWT)

- **Algorithm:** EdDSA (Ed25519) — asymmetric, 64-byte signatures, fast verification
- **Lifetime:** 8 hours
- **Claims:**
  ```json
  {
    "sub": "<user_uuid>",
    "jti": "<uuid7>",
    "sid": "<session_id>",
    "iss": "ashyq-bilim-auth",
    "aud": ["ashyq-bilim-api"],
    "iat": 1712345678,
    "exp": 1712374478,
    "roles": ["student"],
    "perms": []
  }
  ```
- **Delivery:** HTTP-only cookie, `SameSite=Strict`, `Secure`, `Path=/api`, `max_age=28800`

> **JTI blocklist note:** Because tokens are 8 hours long-lived, the JTI blocklist Redis entries must also have TTL=28800. This means a logged-out token's JTI occupies a Redis key for up to 8 hours. This is the direct cost of choosing long-lived tokens — it is acceptable and a deliberate trade-off.

#### Refresh Token (Opaque)

- **Format:** `<session_id>.<256-bit-random-hex>` — not a JWT, no decodable claims
- **Lifetime:** 7 days sliding expiration (each use extends by 7 days, hard cap 30 days from creation)
- **Storage:** SHA-256 hash stored in Redis (hot path) + PostgreSQL (audit trail)
- **Delivery:** HTTP-only cookie, `SameSite=Strict`, `Secure`, `Path=/api/auth/refresh`, `max_age=604800`

#### JTI Blocklist

```
Redis key:   jti:<jti_value>
Value:       "1"
TTL:         time remaining until token natural expiry (≤ 28800s)
```

Checked after signature verification. A present key means the token was explicitly revoked (logout, password change, security event) regardless of expiry.

### 3.2 Session Storage

**Redis — primary (hot path):**
```
Key:     session:<session_id>
Format:  MessagePack
Fields:
  user_id             string
  token_family_id     string
  refresh_token_hash  string  (SHA-256 of opaque refresh token)
  ip_address          string
  user_agent          string
  created_at          int     (unix timestamp)
  last_seen_at        int     (unix timestamp)
  rotated_count       int
  absolute_expires_at int     (unix timestamp, hard cap)
TTL: sliding 7 days, enforced as min(TTL, absolute_expires_at - now)
```

**PostgreSQL `auth_sessions` — audit only (never read during token validation):**
- Append-only inserts on: create, rotate, revoke
- Indexed for security investigation, not for request serving

### 3.3 Key Management

```
apps/api/src/security/keys.py       # Key loading + JWKS endpoint data
apps/api/private/ed25519.pem        # Private key — gitignored, loaded from env
apps/api/private/ed25519.pub.pem    # Public key — safe to distribute
```

Environment variables (replace `PLATFORM_AUTH_JWT_SECRET_KEY`):
```bash
PLATFORM_AUTH_ED25519_PRIVATE_KEY=<base64-encoded PEM>   # auth service only
PLATFORM_AUTH_ED25519_PUBLIC_KEY=<base64-encoded PEM>    # safe for all services
```

Key rotation: `kid` header in JWT (`v1`, `v2`). Accept both keys during overlap window.

Public key exposed at `GET /auth/.well-known/jwks.json` for external service verification.

### 3.4 Backend Endpoints

#### `POST /auth/login`
```
Input:       { email: str, password: str }  (JSON — drop OAuth2PasswordRequestForm)
Rate limit:  5/min per IP, 10/min per email
On success:
  - Argon2id verify password
  - Create session in Redis (+ audit write to PostgreSQL)
  - Embed roles in JWT claims (avoid per-request RBAC DB lookup)
  - Set access_token cookie  (8h,  Path=/api,              SameSite=Strict)
  - Set refresh_token cookie (7d,  Path=/api/auth/refresh, SameSite=Strict)
  - Return UserSession (user + roles + permissions)
On failure (wrong password):
  - Log audit event: login_failure
  - After 5 failures in 15 min for same email: lock account 15 min
```

#### `POST /auth/refresh`  *(was GET — side effects require POST)*
```
Input:       refresh_token cookie only (no body)
Rate limit:  30/min per session_id
On success:
  - Validate opaque token against Redis hash
  - Detect reuse: if session not found in Redis → check PostgreSQL audit
    - If was valid but now missing → token theft → revoke entire family + return 401
  - Rotate: delete old Redis key, insert new session
  - Add old access JTI to blocklist (TTL = remaining lifetime)
  - Set new access_token + refresh_token cookies
  - Return { expires_at: number }  (unix ms, same shape as current)
```

#### `POST /auth/logout`
```
Input:       access_token cookie (or Authorization header)
On success:
  - Decode JTI from token (no signature verify needed — we just need the JTI)
  - Add JTI to Redis blocklist (TTL = remaining token lifetime)
  - Delete session from Redis
  - Log audit event: logout
  - Clear both cookies (set Max-Age=0)
  - Return 204
```

#### `POST /auth/logout-all`  *(new)*
```
Input:       valid access_token
On success:
  - Find all session keys for user_id in Redis (maintain user→sessions index)
  - Delete all sessions
  - Add current JTI to blocklist
  - Log audit event: logout_all
  - Clear cookies
  - Return 204
```

#### `GET /auth/google/authorize`  *(add PKCE)*
```
Generate PKCE pair:
  code_verifier  = secrets.token_urlsafe(64)
  code_challenge = base64url(sha256(code_verifier.encode()))
Store:  pkce:<state_jti> → code_verifier  (Redis, TTL 10min)
Include code_challenge + method=S256 in authorization URL
```

#### `GET /auth/google/callback`  *(add PKCE)*
```
- Retrieve code_verifier from Redis using state JTI
- Include code_verifier in token exchange request to Google
- Delete pkce:<state_jti> from Redis after use (one-time)
```

#### `POST /auth/forgot-password`  *(replace 5-char code)*
```
- Always return 200 regardless (prevent email enumeration)
- If email found:
    token = signed JWT { sub: user_uuid, jti: uuid7, type: "reset", exp: now+15min }
    Store jti in Redis: reset_jti:<jti> → "pending"  (TTL 15min)
    Send email: /reset-password?token=<jwt>
Rate limit: 3/hour per IP, 1/5min per email
```

#### `POST /auth/reset-password`  *(replace 5-char code)*
```
Input: { token: str, new_password: str }
- Verify JWT signature + expiry
- Check reset_jti:<jti> exists in Redis (single-use enforcement)
- Validate password strength (zxcvbn score ≥ 3, checked server-side)
- Hash with Argon2id (time=3, memory=65536, parallelism=4)
- Update password
- Delete reset_jti:<jti> from Redis
- Revoke all active sessions for user (force re-login everywhere)
- Log audit event: password_reset
```

#### `GET /auth/.well-known/jwks.json`  *(new)*
```
Returns Ed25519 public key in JWKS format.
Cached: 1 hour (public key rarely changes).
Allows frontend to verify tokens locally without a session endpoint call.
```

#### `GET /auth/sessions`  *(new — Phase 4)*
```
Returns list of active sessions for authenticated user:
  [{ session_id, ip_address, user_agent, created_at, last_seen_at }]
```

#### `DELETE /auth/sessions/:session_id`  *(new — Phase 4)*
```
Revokes a specific session (device logout).
Cannot revoke the current session (use /auth/logout instead).
```

#### Remove from router:
- `GET /auth/refresh` → replaced by `POST /auth/refresh`
- Auto-refresh middleware in `app.py` → deleted entirely

### 3.5 Cookie Settings

```python
ACCESS_COOKIE = {
    "key":      "access_token_cookie",
    "httponly": True,
    "secure":   True,
    "samesite": "strict",     # upgraded from lax
    "path":     "/api",       # scoped — not exposed to non-API paths
    "max_age":  28800,        # 8 hours
}

REFRESH_COOKIE = {
    "key":      "refresh_token_cookie",
    "httponly": True,
    "secure":   True,
    "samesite": "strict",
    "path":     "/api/auth/refresh",   # most restrictive path
    "max_age":  604800,       # 7 days
}
```

### 3.6 Audit Log

New PostgreSQL table — append-only, never updated:

```sql
CREATE TABLE auth_audit_log (
  id          BIGSERIAL       PRIMARY KEY,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  user_id     UUID            REFERENCES users(user_uuid) ON DELETE SET NULL,
  event_type  TEXT            NOT NULL,
  session_id  TEXT,
  ip_address  INET,
  user_agent  TEXT,
  metadata    JSONB,
  severity    TEXT            NOT NULL DEFAULT 'info'
);

CREATE INDEX ON auth_audit_log (user_id, created_at DESC);
CREATE INDEX ON auth_audit_log (event_type, severity, created_at DESC)
  WHERE severity IN ('warning', 'critical');
```

Events: `login_success`, `login_failure`, `account_locked`, `logout`, `logout_all`,
`token_refresh`, `token_theft_detected`, `family_revoked`, `password_changed`,
`password_reset_requested`, `password_reset_completed`, `email_verified`,
`oauth_linked`, `session_revoked`.

### 3.7 Rate Limiting

```python
# Replace ad-hoc slowapi with structured Redis sliding window
RATE_LIMITS = {
    "login":                  RateLimit(requests=5,  window=60,   key_by="ip+email"),
    "refresh":                RateLimit(requests=30, window=60,   key_by="session_id"),
    "forgot_password":        RateLimit(requests=3,  window=3600, key_by="ip"),
    "forgot_password_email":  RateLimit(requests=1,  window=300,  key_by="email"),
    "google_authorize":       RateLimit(requests=10, window=60,   key_by="ip"),
}
```

On limit hit: `429` with `Retry-After` header, log `rate_limited` audit event.
On 5 consecutive `login_failure` for same email within 15 min: set `account_locked:<email>` in Redis (TTL 900s), return `423 Locked`.

---

## Part 4 — Frontend Rewrite

### Current Problems (precise)

| File | Problem |
|------|---------|
| `auth.ts` (root) | Network call to `/users/session` on every invocation; called from middleware + layouts = multiple round-trips per render |
| `lib/auth/server-access-token.ts` | Sentinel resolution must be manually called in every service file; no type enforcement |
| `lib/auth/session.ts` | `toClientSession()` creates sentinel that callers must remember to resolve |
| `lib/server-auth.ts` | Duplicates session access logic alongside `auth.ts` |
| `lib/get-optional-session.ts` | Third file that wraps `auth()` with try/catch — responsibilities scattered across 4 files |
| `services/auth/auth.ts` | Has two separate refresh functions (`getNewAccessTokenUsingRefreshToken` + `getNewAccessTokenUsingRefreshTokenServer`) that duplicate the backend middleware refresh, creating three independent refresh paths total |

### New File Structure

```
apps/web/
  lib/
    auth/
      session.ts         # getSession(), requireSession() — local JWT verify, no network
      permissions.ts     # sessionCan(), requirePermission(), requireAnyPermission()
      types.ts           # AppSession, ClientSession, UserSessionResponse — single source
    api-client.ts        # apiFetch() — one function for all API calls, handles refresh
  components/
    providers/
      SessionProvider.tsx  # Client: React context + proactive refresh timer
  services/
    auth/
      auth.ts            # Keep: loginAndGetToken(), logout(), getGoogleAuthorizeUrl(),
                         #       sendResetLink(), resetPassword()
                         # Remove: getNewAccessTokenUsingRefreshToken(),
                         #         getNewAccessTokenUsingRefreshTokenServer(),
                         #         getUserSession(), getUserInfo() (moved to users.ts)
    users/
      users.ts           # Use apiFetch() — drop resolveServerAccessToken() calls
    settings/
      password.ts        # Use apiFetch()
      profile.ts         # Use apiFetch()
    platform/
      platform.ts        # Use apiFetch()
    payments/
      payments.ts        # Use apiFetch()
      products.ts        # Use apiFetch()
```

### Files Deleted

| File | Replacement |
|------|------------|
| `auth.ts` (root) | `lib/auth/session.ts` — local verification |
| `lib/auth/server-access-token.ts` | Eliminated — `apiFetch()` handles internally |
| `lib/auth/session.ts` | Rewritten — no sentinel, no `toClientSession()` |
| `lib/server-auth.ts` | Merged into `lib/auth/permissions.ts` |
| `lib/get-optional-session.ts` | `getSession()` returns `null` natively |

### `lib/auth/session.ts` — Core Session Module

```typescript
import { jwtVerify, importSPKI } from 'jose'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { AppSession } from './types'

// Public key embedded at build time — no runtime network fetch
const PUBLIC_KEY_PEM = process.env.AUTH_ED25519_PUBLIC_KEY!
let _publicKey: CryptoKey | null = null

async function getPublicKey(): Promise<CryptoKey> {
  if (!_publicKey) {
    _publicKey = await importSPKI(PUBLIC_KEY_PEM, 'EdDSA')
  }
  return _publicKey
}

// cache() deduplicates within a single React render tree (RSC + layouts + pages)
export const getSession = cache(async (): Promise<AppSession | null> => {
  const cookieStore = await cookies()
  const token = cookieStore.get('access_token_cookie')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, await getPublicKey(), {
      issuer: 'ashyq-bilim-auth',
      audience: 'ashyq-bilim-api',
    })
    return {
      user: { id: payload.sub!, ...payload } as AppSession['user'],
      expiresAt: (payload.exp! * 1000),
      sessionId: payload.sid as string,
    }
  } catch {
    return null  // expired or invalid — let the refresh path handle it
  }
})

export async function requireSession(): Promise<AppSession> {
  const session = await getSession()
  if (!session) redirect('/login')
  return session
}
```

**Key property:** Zero network calls. The access token is verified locally using the Ed25519 public key (bundled via `AUTH_ED25519_PUBLIC_KEY` env var, exposed at `/auth/.well-known/jwks.json`). React's `cache()` ensures the cookie is read and token is verified at most once per render tree regardless of how many layouts and pages call `getSession()`.

### `lib/api-client.ts` — Unified API Client

```typescript
import { cookies } from 'next/headers'

const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL!

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  _retried = false,
): Promise<Response> {
  const headers = new Headers(options.headers)

  if (typeof window === 'undefined') {
    // Server-side: extract access token from cookie store, set as Bearer
    const { cookies } = await import('next/headers')
    const cookieStore = await cookies()
    const token = cookieStore.get('access_token_cookie')?.value
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  // Client-side: browser forwards the HttpOnly cookie automatically (same-origin)

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401 && !_retried) {
    // Attempt one silent refresh, then retry the original request
    const refreshed = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (refreshed.ok) {
      return apiFetch(path, options, true)  // retry once
    }
    // Refresh failed: redirect to login (server) or emit event (client)
    if (typeof window === 'undefined') {
      const { redirect } = await import('next/navigation')
      redirect('/login')
    } else {
      window.dispatchEvent(new CustomEvent('auth:session-expired'))
    }
  }

  return res
}
```

**What this eliminates:**
- `resolveServerAccessToken()` calls in every service file (6 files)
- The sentinel `__cookie_session__` string
- `getNewAccessTokenUsingRefreshToken()` / `getNewAccessTokenUsingRefreshTokenServer()` in `services/auth/auth.ts`
- The implicit backend middleware refresh (`auth_cookie_refresh_middleware`)

### `lib/auth/permissions.ts` — Consolidated Permission Guards

Identical API to existing `lib/server-auth.ts`, just consolidated:

```typescript
export { sessionCan, requirePermission, requireAnyPermission }
// Import from: lib/auth/permissions  (not lib/server-auth)
```

Update all import sites. The function signatures do not change.

### `SessionProvider` — Proactive Client Refresh

```typescript
// components/providers/SessionProvider.tsx
'use client'
// Receives expiresAt from server-rendered layout
// Sets a timer to call POST /api/auth/refresh ~5 min before expiry
// On auth:session-expired event from apiFetch: redirects to /login
// Exposes useSession() hook returning ClientSession (no token)
```

This replaces the reactive-only approach in the current `services/auth/auth.ts`. The timer fires proactively so users never hit a 401 in the middle of an action.

### Service File Updates (mechanical)

Every service file changes from:
```typescript
// Before (pattern repeated in 6 files)
import { resolveServerAccessToken } from '@/lib/auth/server-access-token'

export async function someAction(data: X, access_token: string) {
  const token = await resolveServerAccessToken(access_token)
  return fetch(`${apiUrl}/endpoint`, {
    headers: { Authorization: `Bearer ${token}` },
    ...
  })
}
```

To:
```typescript
// After
import { apiFetch } from '@/lib/api-client'

export async function someAction(data: X) {  // no access_token parameter
  return apiFetch('/endpoint', { method: 'POST', body: JSON.stringify(data) })
}
```

Callers no longer pass `access_token` down through the call chain. `apiFetch` sources it internally from the cookie store. This removes the `access_token` parameter from **all** exported service functions.

### Frontend Environment Variables

Add to `.env` (server-only, not `NEXT_PUBLIC_`):
```bash
AUTH_ED25519_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n..."
# Fetched once from /auth/.well-known/jwks.json during deployment
# or bundled directly for zero-trust environments
```

---

## Part 5 — Migration Phases

### Phase 1 — Backend Hardening (no breaking changes to frontend)

1. Add `auth_audit_log` table migration
2. Generate Ed25519 key pair; add key loading in `security/keys.py`
3. Switch JWT signing to EdDSA; add `jti` claim (uuid7)
4. Expose `GET /auth/.well-known/jwks.json`
5. Add JTI blocklist check to token validation
6. Add JTI to blocklist on `DELETE /auth/logout`
7. Replace 5-char reset code with single-use JWT in `forgot-password` / `reset-password`
8. Add PKCE to Google OAuth
9. Add structured audit log writes to all auth events
10. Add per-endpoint rate limiting with Redis sliding window
11. Add account lockout on repeated login failures
12. Switch login endpoint to accept JSON body (keep form support temporarily for compatibility)

### Phase 2 — Session to Redis

1. Add Redis session storage layer (parallel writes to Redis + PostgreSQL)
2. Read from Redis first, fall back to PostgreSQL (zero-downtime transition)
3. Verify correctness; monitor Redis hit rate
4. Remove PostgreSQL from hot-path session reads
5. `auth_sessions` becomes audit-append-only

### Phase 3 — Remove Implicit Refresh Middleware

1. Add `POST /auth/refresh` endpoint (alongside existing `GET /auth/refresh`)
2. Verify frontend proactive refresh works correctly
3. Remove `auth_cookie_refresh_middleware` from `app.py`
4. Remove `GET /auth/refresh` (breaking change — coordinate with frontend deploy)
5. Update cookie settings: `SameSite=strict`, scoped paths

### Phase 4 — Frontend Rewrite

1. Add `AUTH_ED25519_PUBLIC_KEY` to Next.js env
2. Implement `lib/auth/session.ts` with local JWT verification
3. Implement `lib/api-client.ts` with reactive 401 refresh + retry
4. Implement `SessionProvider` with proactive refresh timer
5. Consolidate `lib/server-auth.ts` → `lib/auth/permissions.ts`
6. Update `services/auth/auth.ts`: remove duplicate refresh functions, remove `getUserSession()`/`getUserInfo()` (already in `users.ts`)
7. Update all service files to use `apiFetch()`, remove `access_token` parameters
8. Delete: `auth.ts` (root), `lib/auth/server-access-token.ts`, `lib/get-optional-session.ts`, `lib/server-auth.ts`
9. Update all import sites (`lib/server-auth` → `lib/auth/permissions`)
10. Test every authenticated flow end-to-end

### Phase 5 — Hardening (Post-Launch)

1. Device/session management UI (`GET /auth/sessions`, `DELETE /auth/sessions/:id`)
2. Security email notifications (new IP login, password change, token theft)
3. WebAuthn / Passkeys (`webauthn-lib` backend, `@simplewebauthn/browser` frontend)
4. TOTP MFA (`pyotp` backend, TOTP setup flow frontend)

---

## Part 6 — File Inventory

### Backend

| File | Action | Change |
|------|--------|--------|
| `security/auth.py` | Rewrite | EdDSA signing, add `jti` claim, add JTI blocklist check |
| `security/auth_cookies.py` | Rewrite | `SameSite=strict`, scoped paths, updated TTLs |
| `security/security.py` | Patch | Remove HS256 constant, add Ed25519 key loading helpers |
| `security/keys.py` | **New** | Key loading, JWKS response builder |
| `security/rbac.py` | Keep | No changes needed |
| `services/auth/sessions.py` | Rewrite | Redis-primary, PostgreSQL audit-only, user→sessions index |
| `services/auth/audit.py` | **New** | Structured audit log writer |
| `services/auth/rate_limiter.py` | **New** | Per-endpoint Redis sliding window |
| `services/auth/google_oauth.py` | Patch | Add PKCE (code_verifier/challenge, Redis storage) |
| `services/auth/utils.py` | Keep | No changes needed |
| `services/users/password_reset.py` | Rewrite | JWT token + single-use JTI, drop 5-char code |
| `routers/auth.py` | Patch | Add `POST /auth/refresh`, `POST /auth/logout-all`, JWKS endpoint; remove `GET /auth/refresh`; wire new services |
| `db/auth_sessions.py` | Keep | Model unchanged (now audit-only) |
| `db/migrations/add_audit_log.py` | **New** | `auth_audit_log` table |
| `app.py` | Patch | Remove `auth_cookie_refresh_middleware` |

### Frontend

| File | Action | Change |
|------|--------|--------|
| `lib/auth/session.ts` | Rewrite | Local Ed25519 JWT verify; `getSession()`, `requireSession()`; no sentinel; no network |
| `lib/auth/types.ts` | **New** | `AppSession`, `ClientSession`, `UserSessionResponse` — single source of truth |
| `lib/auth/permissions.ts` | **New** (from `lib/server-auth.ts`) | `sessionCan()`, `requirePermission()`, `requireAnyPermission()` |
| `lib/api-client.ts` | **New** | `apiFetch()` with cookie forwarding, 401→refresh→retry, `auth:session-expired` event |
| `components/providers/SessionProvider.tsx` | **New** | Proactive refresh timer, `useSession()` hook, `auth:session-expired` handler |
| `services/auth/auth.ts` | Patch | Remove `getNewAccessTokenUsingRefreshToken`, `getNewAccessTokenUsingRefreshTokenServer`, `getUserSession`, `getUserInfo`; keep login/logout/oauth/reset |
| `services/users/users.ts` | Patch | Replace `fetch`+`resolveServerAccessToken` with `apiFetch`; drop `access_token` params |
| `services/settings/password.ts` | Patch | Same as above |
| `services/settings/profile.ts` | Patch | Same as above |
| `services/platform/platform.ts` | Patch | Same as above |
| `services/payments/payments.ts` | Patch | Same as above |
| `services/payments/products.ts` | Patch | Same as above |
| `auth.ts` (root) | **Delete** | Replaced by `lib/auth/session.ts` |
| `lib/auth/server-access-token.ts` | **Delete** | Replaced by `apiFetch()` internal logic |
| `lib/server-auth.ts` | **Delete** | Merged into `lib/auth/permissions.ts` |
| `lib/get-optional-session.ts` | **Delete** | `getSession()` returns `null` natively |

---

## Part 7 — Security Properties After Rewrite

| Property | Before | After |
|----------|--------|-------|
| Access token lifetime | 8 hours | 8 hours (unchanged) |
| Access token algorithm | HS256 (symmetric) | EdDSA/Ed25519 (asymmetric) |
| Access token revocation | None | JTI blocklist (Redis, TTL=8h) |
| Refresh token format | JWT (decodable) | Opaque (`session_id.random`) |
| Refresh token storage | SHA-256 hash in PostgreSQL | SHA-256 hash in Redis (audit in PostgreSQL) |
| Session hot path | PostgreSQL query per request | Redis key lookup |
| Implicit refresh | Backend middleware (hidden, racy) | Eliminated |
| Client refresh | Two separate functions in auth.ts | One path: `apiFetch()` 401 retry + `SessionProvider` timer |
| Token refresh method | GET with side effects | POST (correct HTTP semantics) |
| Session verification network call | Every render (fetch to /users/session) | Zero (local Ed25519 verify) |
| Sentinel pattern | Yes (`__cookie_session__`) | Eliminated |
| `access_token` prop-drilling | Yes (all service functions) | Eliminated |
| OAuth PKCE | No | Yes (RFC 7636) |
| Password reset | 5-char code, brute-forceable | Signed single-use JWT, 15 min TTL |
| Rate limiting | Slowapi basic | Per-endpoint Redis sliding window |
| Account lockout | No | Yes (5 failures → 15 min) |
| Audit log | None | Structured PostgreSQL append-only |
| Cookie SameSite | Lax | Strict |
| Cookie path scoping | `/` (all paths) | Scoped per cookie type |
| JWKS endpoint | No | Yes (`/auth/.well-known/jwks.json`) |

---

## Part 8 — Dependencies

### Backend

```toml
# Already present:
# argon2-cffi, python-jose or PyJWT, authlib, redis

# Add / upgrade:
PyJWT = ">=2.9"           # if switching from python-jose (cleaner EdDSA support)
zxcvbn = ">=4.4"          # server-side password strength check
```

### Frontend

```jsonc
// Add:
"jose": "^5.9"            // Ed25519 JWT verification in Node.js + Edge runtime
// zxcvbn optional for client-side password strength UI
```

---

## Open Questions

1. **`access_token` parameter removal** — Service functions (`getUser(user_id, access_token)`) are likely called from server components that pass session tokens directly. Removing the parameter changes the public API of every service. Confirm: is any service called from a context that does NOT have cookie access (e.g., background jobs, webhooks)? If yes, `apiFetch` needs an optional explicit-token override.
2. **Middleware.ts** — Does `apps/web/middleware.ts` call `auth()` (root)? If so it must be updated to call `getSession()` instead. Middleware runs on every request and is the highest-cost place to have a network call.
3. **Session count limit** — Should active sessions per user be capped (e.g., 20 devices)?
4. **Absolute refresh token hard cap** — Currently 30 days from creation. Keep?
5. **Step-up auth scope** — Which operations require re-authentication (password, payment config mutations, user deletion)? Define before Phase 5.
