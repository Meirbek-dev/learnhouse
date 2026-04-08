# Session & User Handling Redesign v2

## Context

This plan supersedes `session-user-rewrite-plan-2026-04-08.md`. That plan outlined 6 phases; phases 0–3 were partially implemented. The codebase is now in a transitional state: the core auth primitives are solid, but the layer that consumes them is still inconsistent and under-optimized. This document provides a critical analysis of the **current** state and a concrete redesign plan that finishes the job.

---

## I. Critical Analysis of Current State

### What Works Well (Keep)

| Component | Why it's good |
|---|---|
| `lib/api-client.ts` — unified `apiFetch()` | Single auth-aware fetch path, 401→refresh→retry, server-side cookie forwarding. Clean. |
| `lib/auth/session.ts` — `getSession()` / `requireSession()` | `cache()`-wrapped, server-only, cookie-filtered. Correct and minimal. |
| `lib/auth/client.ts` — invalidation + cross-tab sync | BroadcastChannel API, deduped refresh, event-based. Production-quality. |
| `hooks/useSession.ts` — `useAuthSession()` | SWR-based, proactive refresh via `refreshInterval`, clean return shape. The right primitive. |
| `lib/auth/types.ts` — `normalizeSession()` | Transforms backend payload cleanly. Type-safe. |
| `lib/auth/permissions.ts` — server-side `sessionCan()` | Direct, no over-abstraction. |
| `services/auth/auth.ts` — auth mutations | Clean, stateless, emits invalidation events properly. |
| `lib/users/client.ts` — user data hooks | `useMe()`, `useUserById()`, `useUserByUsername()` with proper SWR keys and cache invalidation. |
| Proxy middleware (`proxy.ts`) | Clean route protection, cookie-based gating, proper redirect construction. |

These are a **strong foundation**. The redesign targets the layer above them.

---

### What's Wrong

#### 1. Double SWR Provider with Conflicting Fallbacks

**Files:** `app/root-providers.tsx`, `app/(platform)/platform-session-providers.tsx`

The root layout wraps children in `<SWRConfig value={{ fallback }}>` but **never passes a session** (`initialSession` is always `undefined` since `app/layout.tsx` doesn't fetch session). Platform routes then wrap in a **second** `<SWRConfig>` with the _actual_ server-fetched session as fallback.

**Problems:**

- The root SWR fallback is always empty — it serves no purpose for session hydration
- Nested `<SWRConfig>` with overlapping keys creates confusing merge semantics
- Non-platform routes (home, auth, payments) get **no** server-side session hydration — every page load triggers a client-side waterfall
- The root `<SWRConfig>` configures global SWR defaults (`dedupingInterval`, `fetcher`, `onErrorRetry`) that are unrelated to session — these should not be mixed with session fallback

**Impact:** First-paint flicker on non-platform routes. Wasted server render budget. Confusing provider hierarchy.

#### 2. `PlatformSessionProviders` Is a Redundant Abstraction

**File:** `app/(platform)/platform-session-providers.tsx`

This 23-line file exists _solely_ to:

1. Create an SWR fallback object from `initialSession`
2. Wrap children in `<SWRConfig>` and `<PermissionProvider>`

This could be inlined into the platform layout or replaced with a `value` prop on the existing provider tree. Having a dedicated file for two lines of logic creates indirection without value.

#### 3. Two Aliases for the Same Data — `useViewer()` and `useCurrentUser()`

**Files:** `hooks/useViewer.ts`, `hooks/useCurrentUser.ts`

```
useCurrentUser()  →  calls useViewer()  →  calls useAuthSession().user
```

Three files, three imports, one line of actual logic. New engineers cannot know which to use. Both are used across the codebase (9 files for `useViewer`, 15 for `useCurrentUser`).

**What to do:** Pick one. Delete the other. `useCurrentUser()` has wider adoption and a more descriptive name.

#### 4. Auth Service Uses Raw `fetch()` Instead of `apiFetch()`

**File:** `services/auth/auth.ts`

Login, logout, signup, password reset — all use raw `fetch()` with manual `credentials: 'include'`. The `apiFetch()` client already handles credentials, cookie forwarding, and base URL resolution. Using raw fetch:

- Bypasses the centralized error handling pipeline
- Duplicates `credentials: 'include'` and `getAPIUrl()` calls
- Cannot benefit from future `apiFetch` improvements (logging, metrics, retry)

**Exception:** Login cannot use `apiFetch()` if the retry-on-401 behavior would interfere. But logout, signup, password reset, and OAuth URL construction _should_ go through `apiFetch()`.

#### 5. `PermissionProvider` Only Exists Inside Platform Routes

**File:** `components/Security/PermissionProvider.tsx`, wrapped in `platform-session-providers.tsx`

Any component outside `(platform)/` that calls `usePermissions()` will crash with `"usePermissions must be used within a PermissionProvider"`. This includes:

- Auth pages (wrapped in a separate layout)
- Payment callback pages
- Home page
- Any future standalone pages

The permission system should be either globally available or gracefully degradable.

#### 6. Session Hydration Gap on Non-Platform Routes

**Current tree:**

```
RootLayout
  └─ RootProviders (SWRConfig with empty fallback)
       └─ ThemeProvider
            └─ Page (must fetch session client-side, shows loading state)

(platform)/Layout
  └─ PlatformContextProvider
       └─ PlatformSessionProviders (SWRConfig with hydrated session)
            └─ PermissionProvider
                 └─ Page (instant session, no flicker)
```

Pages under `(platform)/` get instant session from server hydration. All other pages (home, auth, payments, standalone) must wait for a client-side fetch. This causes:

- Auth status flicker on the home page (nav shows "login" briefly, then switches to user avatar)
- Theme flash (user theme only applies after session resolves)
- Unnecessary loading states for simple auth-gated UI

#### 7. `useMe()` Fallback Behavior Is Confusing

**File:** `lib/users/client.ts`

```ts
export function useMe(options?) {
  const { isAuthenticated, user } = useAuthSession();
  return useSWR(enabled ? userKeys.me : null, getCurrentUserProfile, {
    fallbackData: options?.fallbackData ?? user ?? undefined,
  });
}
```

`useMe()` fetches `/users/profile` but falls back to `useAuthSession().user`. The session payload includes the **full** `UserRead` object (from the backend `UserSession.user`), so `useMe()` essentially fetches the same data the session already contains. It's unclear when a component should use `useAuthSession().user` vs `useMe()`.

**Root cause:** The backend `/users/session` endpoint returns the entire `UserRead` object inside the session. This makes the "slim session + rich profile" separation impossible at the current API level.

#### 8. Missing Optimistic UI for Auth State Transitions

Login and logout use hard navigation (`location.href = ...`) instead of optimistic SWR mutations + `router.push()`. This causes full-page reloads on every login/logout, losing client-side state and causing a visible page flash.

Modern pattern: mutate session to `null` on logout (immediate UI response), _then_ redirect via Next.js router. For login: set session optimistically, then revalidate.

#### 9. `proxy.ts` Route Protection Is Cookie-Presence Only

**File:** `proxy.ts`

The middleware checks `req.cookies.has('access_token_cookie')` — it never validates the token. An expired or tampered cookie passes the middleware check. Protection depends entirely on the backend 401 → client-side redirect chain.

This is **acceptable** for a cookie-auth system (the middleware is a UX optimization, not a security boundary), but it means there's a visible flicker window: middleware lets the user through → page renders → client discovers 401 → redirect to login.

#### 10. No Error Recovery UI for Session Failures

When `fetchSession()` fails (network error, backend down), the `useAuthSession()` hook returns `{ error, status: 'unauthenticated' }`. There's no distinction between "not logged in" and "session fetch failed". The user sees the logged-out UI with no way to know their session might still be valid.

---

## II. Redesign Plan

### Design Principles

1. **One source of truth per concern.** Session auth = `useAuthSession()`. Current user profile = session payload (until backend slims session). Permissions = derived from session.
2. **No unnecessary abstraction layers.** If a wrapper adds no logic, inline it.
3. **Server hydration everywhere or nowhere.** If platform routes get hydrated sessions, so should the rest.
4. **Fail visibly, not silently.** Session fetch failures should be distinguishable from "unauthenticated."
5. **Use `apiFetch()` for everything.** No raw `fetch()` to the API except for very specific cases (login pre-auth).

---

### Phase 1: Consolidate Hooks and Remove Dead Indirection

**Goal:** One obvious hook per concern. No aliases.

**Changes:**

| Action | Detail |
|---|---|
| Delete `hooks/useViewer.ts` | Replace all 9 imports with `useCurrentUser()` or direct `useAuthSession().user` |
| Simplify `hooks/useCurrentUser.ts` | Inline to `useAuthSession().user` — no wrapper hop |
| Delete `useMe()` from `lib/users/client.ts` | Until backend slims session, `useMe()` is redundant with session data. Components that need profile data should use `useAuthSession().user` |
| Keep `useUserById()` / `useUserByUsername()` | These serve a real purpose (viewing other users) |

**Resulting hook surface:**

```
useAuthSession()    → { session, user, status, isAuthenticated, isLoading, error, mutate }
useAuthStatus()     → 'loading' | 'authenticated' | 'unauthenticated'
useIsAuthenticated() → boolean
useCurrentUser()    → Session['user'] | null  (thin alias, acceptable because widely used)
usePermissions()    → { can, loading }
useUserById(id)     → SWR result for arbitrary user
useUserByUsername(u) → SWR result for arbitrary user
```

**Files to modify:**

- `hooks/useViewer.ts` → delete
- `hooks/useCurrentUser.ts` → rewrite (1 line, import directly from useSession)
- `lib/users/client.ts` → remove `useMe()`, keep data functions
- All files importing `useViewer` → bulk-replace import

---

### Phase 2: Unify Provider Tree — Move Session Hydration to Root

**Goal:** Every route gets server-hydrated session. No double SWR provider.

**Design:**

The root layout should fetch session and pass it down. This is a single `cache()`-wrapped call that's already deduped by React. The cost is minimal and eliminates the flicker gap on non-platform routes.

```
RootLayout (server)
  ├── getSession() → initialSession
  └── RootProviders (client)
       ├── SWRConfig (one, with session fallback + global defaults)
       ├── AuthBroadcastListener
       ├── PermissionProvider
       └── ThemeProvider
            └── children
```

**Changes:**

| Action | Detail |
|---|---|
| `app/layout.tsx` | Add `getSession()` call, pass `initialSession` to `RootProviders` |
| `app/root-providers.tsx` | Accept `initialSession`, set it as SWR fallback. Move `PermissionProvider` here. |
| Delete `app/(platform)/platform-session-providers.tsx` | Redundant — root now handles hydration |
| `app/(platform)/layout.tsx` | Remove session fetch and `PlatformSessionProviders` wrapper. Keep `PlatformContextProvider` only. |

**Result:**

- One SWR provider with correct fallback everywhere
- `PermissionProvider` available globally (gracefully returns `false` when unauthenticated)
- No session flicker on any route
- Platform layout only handles platform-specific context

---

### Phase 3: Migrate Auth Service to `apiFetch()`

**Goal:** All API calls go through the unified client.

**Changes to `services/auth/auth.ts`:**

| Function | Change |
|---|---|
| `loginAndGetToken()` | Keep raw `fetch()` — this is a pre-auth call where 401 retry would be wrong |
| `logout()` / `logoutAll()` | Switch to `apiFetch()` |
| `sendResetLink()` | Switch to `apiFetch()` |
| `resetPassword()` | Switch to `apiFetch()` |
| `signup()` | Switch to `apiFetch()` |
| `getGoogleAuthorizeUrl()` | This just constructs a URL, not a fetch. Keep as-is. |

**Also:** Remove the `AUTH_ENDPOINTS` export — callers don't need endpoint paths, they use the functions.

---

### Phase 4: Add Optimistic Auth Transitions

**Goal:** Login/logout feel instant. No full-page reload.

**Login flow (revised):**

```ts
const response = await loginAndGetToken(email, password);
if (response.ok) {
  // Optimistically revalidate session (new cookies are set by backend response)
  await mutate(AUTH_SESSION_SWR_KEY);
  router.push(safeReturnTo);  // Client-side navigation, no page reload
}
```

**Logout flow (revised):**

```ts
await mutate(AUTH_SESSION_SWR_KEY, null, { revalidate: false });  // Instant UI update
await logout();
router.push('/');  // Client-side navigation
```

**Changes:**

- `app/auth/login/login.tsx` — replace `location.href` with `router.push` + SWR mutate
- `components/Security/HeaderProfileBox.tsx` — replace logout `location.href` with optimistic mutate
- `app/home/home.tsx` — same for logout button

**Trade-off:** Hard navigation guarantees a clean slate (clears all client state). Soft navigation is faster but retains component state. For this app, soft navigation is safe because the `AuthBroadcastListener` already clears SWR session on invalidation, and the permission system reads from SWR reactively.

---

### Phase 5: Distinguish Session Error from Unauthenticated

**Goal:** Components can tell "no session" apart from "session fetch failed."

**Change `hooks/useSession.ts`:**

```ts
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';
```

Add `error` status when `error` is truthy and `data` is undefined (never loaded). The `useAuthSession()` return already includes `error` — the status derivation just needs updating:

```ts
const status: SessionStatus = isLoading
  ? 'loading'
  : error && data === undefined
    ? 'error'
    : data?.user
      ? 'authenticated'
      : 'unauthenticated';
```

**Consumers that care** (like the nav bar) can show a retry button or a "connection issue" indicator instead of the login button.

**Consumers that don't care** continue checking `isAuthenticated` — unaffected.

---

### Phase 6: Clean Up Misc Issues

**6a. Remove stale comment in `lib/auth/client.ts`**

Line 64 references "SessionProvider" which no longer exists. Update to reference `AuthBroadcastListener`.

**6b. Inline `PlatformSessionProviders` consumers**

After Phase 2, any remaining imports of `PlatformSessionProviders` should be replaced.

**6c. Consolidate `PermissionProvider` `can()` overload**

The current `can()` accepts `(resource, action, scope)` _or_ `(action, resource, scope)`. This is confusing and adds runtime branching. Pick one order, enforce it. Recommendation: `can(action, resource, scope)` — reads as English: "can CREATE COURSE at PLATFORM scope."

**6d. Type the `UserRead` inside `Session`**

`lib/auth/types.ts` extends `UserSessionResponse` which includes `user: UserRead`. This type is auto-generated and includes **every** user field. Create a `SessionUser` type that picks only the fields the session actually uses (id, uuid, username, first_name, last_name, email, avatar_image, theme, locale). This doesn't require backend changes — just frontend type narrowing for better autocomplete and intent documentation.

---

## III. Target File Structure (After Redesign)

```
lib/auth/
  types.ts          — Session, SessionUser, normalizeSession()
  session.ts        — Server-only getSession(), requireSession()
  client.ts         — Client-only: invalidation, refresh, BroadcastChannel, redirect utils
  constants.ts      — AUTH_SESSION_SWR_KEY
  permissions.ts    — Server-only: sessionCan(), requirePermission()

hooks/
  useSession.ts     — useAuthSession(), useAuthStatus(), useIsAuthenticated()
  useCurrentUser.ts — useCurrentUser() (thin alias for useAuthSession().user)

components/Security/
  PermissionProvider.tsx  — Reads from useAuthSession(), provides can()
  PermissionGuard.tsx     — Declarative guard component

services/auth/
  auth.ts           — loginAndGetToken(), logout(), signup(), etc.

lib/users/
  client.ts         — useUserById(), useUserByUsername(), mutation helpers
  server.ts         — Server-only re-exports

app/
  layout.tsx        — Fetches getSession(), passes to RootProviders
  root-providers.tsx — SWRConfig(fallback: session) + PermissionProvider + Theme
  (platform)/
    layout.tsx      — PlatformContextProvider only (no session handling)
```

---

## IV. Deleted/Removed Files

| File | Reason |
|---|---|
| `hooks/useViewer.ts` | Alias of alias. Replaced by `useCurrentUser`. |
| `app/(platform)/platform-session-providers.tsx` | Redundant after root-level hydration. |
| `useMe()` in `lib/users/client.ts` | Duplicate of session user data at current API level. |

---

## V. Migration Order & Dependencies

```
Phase 1 (hooks) ─── no dependencies, can start immediately
     │
Phase 2 (providers) ─── depends on Phase 1 (useViewer removal)
     │
Phase 3 (apiFetch) ─── independent, can parallel with Phase 2
     │
Phase 4 (optimistic) ─── depends on Phase 2 (unified provider tree)
     │
Phase 5 (error status) ─── depends on Phase 1 (hook cleanup)
     │
Phase 6 (cleanup) ─── depends on all above
```

---

## VI. Validation Checklist

After each phase:

- [ ] `bun check-types` passes in `apps/web`
- [ ] Login → redirect to returnTo → session hydrated instantly
- [ ] Logout → immediate UI update → redirect to home
- [ ] Open two tabs → logout in one → other tab updates within seconds
- [ ] Session expiry → toast + redirect to login with returnTo
- [ ] Public page (home) → no auth flicker, no loading state for nav
- [ ] Dashboard route without cookie → redirect to login (middleware)
- [ ] `usePermissions()` works on all routes (returns `false` when unauthenticated)
- [ ] Theme syncs correctly after login
- [ ] Profile changes reflect in nav without page reload

---

## VII. What This Plan Does NOT Cover

- **Backend session endpoint changes.** The backend returns full `UserRead` inside session. Ideally this would be slimmed to a `SessionUser` subset, but that's a backend change with migration risk. The frontend should be ready for it (Phase 6d types the subset), but doesn't depend on it.
- **Token refresh rotation internals.** Already correct. Not touched.
- **OAuth flow redesign.** Google OAuth works. Not touched.
- **RBAC admin UI.** The role/permission management pages work. Not in scope.
- **Server Components auth patterns.** `getSession()` and `requireSession()` are already correct for Server Components. Not changed.

---

## VIII. Summary

The current system has a solid core (`apiFetch`, SWR session, cookie auth, cross-tab sync) wrapped in a messy consumption layer (double providers, alias chains, inconsistent hydration, raw fetch in auth service, no error distinction). The redesign:

1. **Removes 3 files** and one redundant hook
2. **Moves session hydration to root** — eliminates flicker everywhere
3. **Normalizes the provider tree** — one SWRConfig, one PermissionProvider, globally available
4. **Routes auth service through `apiFetch()`** — consistent error pipeline
5. **Adds optimistic transitions** — login/logout feel instant
6. **Adds error status** — "offline" ≠ "not logged in"
7. **Enforces a single `can()` signature** — no more argument-order guessing

Net result: fewer files, fewer abstractions, faster page loads, better DX, and a system simple enough to explain in 5 minutes.
