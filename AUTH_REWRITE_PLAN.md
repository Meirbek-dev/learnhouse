# Auth Frontend Rewrite Plan

> **Scope:** Frontend only. The backend is solid — Ed25519 JWT, Redis sessions, token reuse detection, PKCE OAuth, sliding-window refresh, rate limiting, audit logging. Touch nothing there.
>
> **Stack context:** React 19, Next.js 16 App Router, Zustand 5, valibot 1.3, SWR 2.4.

---

## Critical Analysis

### What's genuinely good — leave it alone

| File | Why it's fine |
|------|--------------|
| `lib/auth/session.ts` | Correct App Router pattern: `cache()`, server-only, forwards only auth cookies, `requireSession()` redirect |
| `lib/auth/types.ts` | Clean type separation: `AppSession` (server) vs `ClientSession` (client-safe) |
| `lib/auth/permissions.ts` | Thin, correct |
| `client.ts` → `tryRefreshToken()` | Deduplication with `refreshInFlight` singleton promise is correct |
| Cookie strategy | httponly, samesite=strict, path-scoped refresh cookie — don't touch |
| `initialSession` SSR pass-through | Server layout → client provider is the right App Router pattern |

### What's wrong

#### Bug: `scheduleRefresh` is an unstable closure

```tsx
// SessionContext.tsx:77 — defined as a plain function, not useCallback
function scheduleRefresh(expiresAt: number) {
  clearRefreshTimer();                     // closes over clearRefreshTimer (stable ✓)
  const delay = ...;
  refreshTimerRef.current = setTimeout(() => void refreshSession(), delay); // closes over refreshSession!
}

// useEffect with scheduleRefresh in body but NOT in deps:
useEffect(() => {
  if (status === 'authenticated' && data?.expiresAt) {
    scheduleRefresh(data.expiresAt);  // stale closure: refreshSession captured at first render
  }
  return () => clearRefreshTimer();
}, [clearRefreshTimer, status, data?.expiresAt]); // scheduleRefresh missing — suppressed lint warning
```

If `refreshSession` identity ever changes (it does — it's `useCallback` with deps), the timer fires the stale version. The code works today because `refreshSession`'s deps (`invalidateSession`, `syncSession`) are themselves stable, but it's a trap.

#### Dead complexity: triple cross-tab sync

`client.ts` uses three mechanisms:

1. `BroadcastChannel` — works in all modern browsers (Chrome 54+, Firefox 38+, Safari 15.4+, 97%+ global)
2. `localStorage` write+immediate-remove — triggers `storage` event on other tabs. **This is a 2016 hack** for pre-BroadcastChannel browsers. With the current browser baseline it's dead code.
3. Custom `window` `CustomEvent` — needed for same-tab dispatch (BroadcastChannel doesn't fire on sender). This one is correct and necessary.

The result: three listeners per tab, two event paths to trace for bugs, a try/catch block that silently swallows errors.

#### New `BroadcastChannel` instance on every call

```ts
// client.ts:46
function getBroadcastChannel(): BroadcastChannel | null {
  return new BroadcastChannel(AUTH_BROADCAST_CHANNEL); // new instance every time
}

// Called in broadcastAuthInvalidation (creates + closes)
// Called in subscribeToAuthInvalidation (creates, closes on cleanup)
```

Creating and immediately closing a channel is legal but wasteful. The real issue: `subscribeToAuthInvalidation` holds a channel open for the component's lifetime, while `broadcastAuthInvalidation` creates a throwaway channel. If the subscription channel receives a message from the throwaway channel on the same page, both fire — but the nonce dedup in `SessionContext` prevents double-handling. Still unnecessarily complex.

#### Confusing dual broadcast API

```ts
broadcastAuthInvalidation()  // sends to channel + localStorage only
notifyAuthInvalidation()     // sends to channel + localStorage + local window event
```

`SessionContext.invalidateSession()` calls `broadcastAuthInvalidation` (cross-tab only) and relies on the fact that it already applied state locally before broadcasting. `notifyAuthInvalidation` is called from... nowhere in the context. This split is hard to reason about.

#### `react-hook-form` for two trivial auth forms

Login and signup are 2-field forms. `react-hook-form` + `@hookform/resolvers` adds ~25KB gzipped for controlled field registration, dirty tracking, touched state, and array field management — none of which these forms use. React 19's `useActionState` is the native solution with zero extra deps.

#### `useAuthAction` custom hook reimplements `useTransition`

```ts
// AuthForm.tsx:80 — wraps an async fn with useTransition + useState for error
export function useAuthAction<T>(fn: (data: T) => Promise<void>) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const execute = useCallback((data: T) => {
    startTransition(async () => { ... });
  }, [fn]);
  return { execute, error, isPending };
}
```

`useActionState` (React 19) is exactly this, with better ergonomics, progressive enhancement, and first-class form integration.

#### `SessionContext` does too many things

One component manages: initial fetch, proactive refresh scheduling, cross-tab sync subscription, toast notifications, navigation-on-invalidation, and state. This makes testing and refactoring hard. With Zustand already in the project, session state belongs in a store.

---

## Rewrite Plan

### Phase 1 — Fix the actual bug (immediate, low risk)

**File: `SessionContext.tsx`**

Wrap `scheduleRefresh` in `useCallback` so it's a stable reference with correct deps:

```tsx
const scheduleRefresh = useCallback((expiresAt: number) => {
  clearRefreshTimer();
  const delay = expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
  if (delay <= 0) {
    void refreshSession();
    return;
  }
  refreshTimerRef.current = setTimeout(() => void refreshSession(), delay);
}, [clearRefreshTimer, refreshSession]); // explicit deps
```

Add it to the scheduling `useEffect` deps:

```tsx
useEffect(() => {
  if (status === 'authenticated' && data?.expiresAt) {
    scheduleRefresh(data.expiresAt);
  }
  return clearRefreshTimer;
}, [status, data?.expiresAt, scheduleRefresh, clearRefreshTimer]);
```

Note: `refreshSession` → `invalidateSession` → `syncSession` → `scheduleRefresh` creates a circular `useCallback` dep chain. Break it with a `refreshSessionRef` pattern:

```tsx
const refreshSessionRef = useRef(refreshSession);
useEffect(() => { refreshSessionRef.current = refreshSession; }, [refreshSession]);

const scheduleRefresh = useCallback((expiresAt: number) => {
  clearRefreshTimer();
  const delay = expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS;
  refreshTimerRef.current = setTimeout(
    () => void refreshSessionRef.current(),
    Math.max(0, delay)
  );
}, [clearRefreshTimer]); // no refreshSession dep — accessed via ref
```

---

### Phase 2 — Simplify cross-tab sync

**File: `lib/auth/client.ts`**

Replace the three-mechanism system with a module-level singleton channel + same-tab custom event:

```ts
// Singleton — one channel for the entire module lifetime
let _channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
  if (!_channel || _channel.name !== AUTH_BROADCAST_CHANNEL) {
    _channel = new BroadcastChannel(AUTH_BROADCAST_CHANNEL);
  }
  return _channel;
}
```

Consolidate the two broadcast functions into one with a `local` option:

```ts
export function emitAuthInvalidation(
  detail: AuthInvalidationDetail,
  options: { local?: boolean } = {}
): AuthInvalidationMessage {
  const message = createMessage(detail);

  // Cross-tab
  getChannel()?.postMessage(message);

  // Same-tab (only when explicitly requested — callers that already handle
  // local state themselves pass local: false)
  if (options.local) {
    window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT, { detail: message }));
  }

  return message;
}
```

Update `subscribeToAuthInvalidation` to use the singleton:

```ts
export function subscribeToAuthInvalidation(listener: (msg: AuthInvalidationMessage) => void) {
  if (typeof window === 'undefined') return () => {};

  const handleLocal = (e: Event) => {
    const msg = (e as CustomEvent<AuthInvalidationMessage>).detail;
    if (msg) listener(msg);
  };
  window.addEventListener(AUTH_INVALIDATED_EVENT, handleLocal);

  const channel = getChannel();
  const handleChannel = (e: MessageEvent<AuthInvalidationMessage>) => {
    if (e.data) listener(e.data);
  };
  channel?.addEventListener('message', handleChannel);

  return () => {
    window.removeEventListener(AUTH_INVALIDATED_EVENT, handleLocal);
    channel?.removeEventListener('message', handleChannel);
    // Don't close the singleton channel — other subscribers still need it
  };
}
```

Delete:

- `broadcastAuthInvalidation` export
- `notifyAuthInvalidation` export
- `AUTH_STORAGE_KEY` constant
- The entire localStorage block
- The `storage` event listener in `subscribeToAuthInvalidation`

Update `SessionContext.invalidateSession` to call `emitAuthInvalidation` with `local: false` (state is already applied directly). Cross-tab tabs receive via `subscribeToAuthInvalidation`.

---

### Phase 3 — Migrate auth forms to React 19

**Affected files:** `login.tsx`, `signup.tsx`, `AuthForm.tsx`

Delete `useAuthAction`. Replace with `useActionState` from React.

**Pattern:**

```tsx
// Pure valibot action — no react-hook-form
const loginSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8)),
});

type LoginState = { error: string | null };

async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const result = v.safeParse(loginSchema, {
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!result.success) {
    return { error: v.flatten(result.issues).root?.[0] ?? 'Invalid input' };
  }
  const response = await loginAndGetToken(result.output.email, result.output.password);
  if (!response.ok) return { error: 'Wrong email or password' };
  // Hard navigate to clear React state (intentional — same behavior as now)
  window.location.href = getSafeReturnTo(new URLSearchParams(window.location.search).get('returnTo'));
  return { error: null };
}

// In component:
const [state, dispatch, isPending] = useActionState(loginAction, { error: null });

return (
  <form action={dispatch}>
    <input name="email" type="email" required />
    <input name="password" type="password" required />
    {state.error && <AuthErrorBanner message={state.error} />}
    <AuthSubmitButton isPending={isPending} label="Sign in" pendingLabel="Signing in…" />
  </form>
);
```

Benefits:

- Remove `react-hook-form` + `@hookform/resolvers` (−~25KB gzipped) if not used elsewhere
- Form state is serializable — React can handle concurrent renders correctly
- Progressive enhancement: form submits even without JS (falls back to Server Action)
- Per-field errors: `v.flatten(result.issues).nested` maps directly to field names

Check if `react-hook-form` is used outside auth before removing the package.

---

### Phase 4 — Move session state to Zustand

Zustand is already in the project (`^5.0.12`). A global session store removes React Context overhead and makes session state accessible outside React components (e.g., fetch interceptors, service modules).

**New file: `lib/auth/session-store.ts`**

```ts
import { create } from 'zustand';
import type { ClientSession } from './types';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionStore {
  data: ClientSession | null;
  status: SessionStatus;
  setSession: (session: ClientSession | null) => void;
  setLoading: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  data: null,
  status: 'loading',
  setSession: (session) =>
    set({ data: session, status: session?.user ? 'authenticated' : 'unauthenticated' }),
  setLoading: () => set({ status: 'loading' }),
}));
```

**Updated `SessionContext.tsx` → `SessionProvider.tsx`**

The provider becomes a thin orchestrator: initializes the store from SSR data, runs effects (refresh scheduling, cross-tab sync), exposes actions. State is read from the Zustand store, not from `useState`.

```tsx
'use client';
// Replaces PlatformSessionProvider
export function SessionProvider({ children, initialSession }: Props) {
  const { setSession, setLoading } = useSessionStore();

  // Initialize from SSR data — runs once, no re-render storm
  useEffect(() => {
    setSession(initialSession ?? null);
  }, []); // intentionally empty — SSR data is stable

  // ... refresh scheduling, invalidation subscription (same logic, cleaned up)

  return children;
}
```

**Updated `useCurrentUser.ts`**

```ts
// Before: reads from SessionContext
// After: reads from Zustand store directly — no context needed
export function useCurrentUser() {
  return useSessionStore((s) => s.data?.user ?? null);
}
```

**Updated `useSession.ts` (new hook)**

```ts
export function useSession() {
  return useSessionStore((s) => ({ data: s.data, status: s.status }));
}
```

The `SessionContext` React context can be kept for backwards compat on `refreshSession` / `syncSession` / `invalidateSession` actions (these don't need Zustand — they're imperative), or exposed as a separate `AuthActionsContext`.

---

### Phase 5 — Cleanup

| Item | Action |
|------|--------|
| `PlatformSessionProvider` | Rename to `SessionProvider` |
| `usePlatformSession()` | Deprecate; replace call sites with `useSession()` (Zustand) or `useCurrentUser()` |
| `fetchSession()` inside `SessionContext` | Move to `lib/auth/client.ts` alongside `tryRefreshToken` |
| Toast calls in `invalidateSession` | Extract to `handleInvalidationSideEffects(reason)` — pure function, testable |
| `globalThis.location.href` vs `router` | Document the intentional hard-navigate-on-logout as a comment; it's correct |
| `/api/auth/session` route | Keep — necessary bridge (server API URL is not accessible from client) |
| `[...nextauth]` route | Confirm it's dead; delete if unused |

---

## File Change Summary

```
Modified:
  lib/auth/client.ts           — remove localStorage hack, singleton channel, consolidated API
  components/auth/SessionProvider.tsx  — (renamed from SessionContext.tsx) Zustand init + effects only
  components/auth/AuthForm.tsx  — delete useAuthAction
  app/auth/login/login.tsx     — useActionState, drop react-hook-form
  app/auth/signup/signup.tsx   — useActionState, drop react-hook-form
  hooks/useCurrentUser.ts      — read from Zustand store

New:
  lib/auth/session-store.ts    — Zustand store (40 lines)
  hooks/useSession.ts          — thin hook over store

Deleted:
  (if react-hook-form unused elsewhere): remove from package.json
```

---

## What NOT to change

- **Backend** — everything is production-grade
- **`lib/auth/session.ts`** — server-side session fetching is correct
- **`/api/auth/session` route** — necessary client bridge
- **`tryRefreshToken()`** — deduplication is correct
- **Cookie strategy** — httponly, path-scoped refresh cookie is correct
- **`requireSession()`** — idiomatic server guard
- **`lib/auth/permissions.ts`** — fine as-is
- **`lib/auth/types.ts`** — fine as-is
- **`lib/auth/services/auth.ts`** — HTTP client layer is correct; cookie auth flows through `credentials: include` which is the right pattern (Server Actions can't proxy httponly cookies for refresh)

---

## Risk Assessment

| Phase | Risk | Mitigation |
|-------|------|-----------|
| 1 — Fix scheduleRefresh | Low — bug fix, behavior unchanged | Manual test: verify refresh fires at t-5min |
| 2 — Simplify cross-tab sync | Low — BroadcastChannel is 97%+ | Test multi-tab logout manually |
| 3 — Form migration | Medium — form behavior change | Test error paths, Google OAuth flow, returnTo redirect |
| 4 — Zustand session store | Medium — touches many consumers | Grep all `usePlatformSession` call sites before starting |
| 5 — Cleanup | Low | |

Do phases in order. Each is independently shippable.
