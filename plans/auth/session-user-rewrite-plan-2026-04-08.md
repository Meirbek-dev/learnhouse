# Session And User Handling Rewrite Plan

## Goal

Rewrite the frontend session and current-user handling so it is:

- production-ready
- simpler to reason about
- compatible with modern Next.js App Router and React patterns
- fast on public pages
- strict about auth boundaries
- not overengineered

This plan assumes the backend auth foundation stays mostly intact. The current backend cookie, refresh, and session model is already good enough to build on.

## Executive Summary

The current auth core is no longer the main problem. The main problem is that frontend session and user handling still feels like a partial migration:

- session transport is centralized, but session consumption is not
- current-user data and auth session data are treated as the same thing
- server-only service modules are imported from client components
- public and authenticated UI both depend on a root-level session read
- several components still contain dead token-era residue

The rewrite should not replace everything. It should keep the existing cookie-based auth and the single auth-aware fetch path, then cleanly separate:

1. auth session state
2. current viewer state
3. arbitrary user profile reads
4. auth mutations and invalidation

## What Is Already Good

Keep these parts and build on them:

- `apps/web/lib/api-client.ts`: single auth-aware fetch path with 401 retry and centralized invalidation
- `apps/web/lib/auth/session.ts`: server-side `getSession()` and `requireSession()` are small and correct
- `apps/web/hooks/useSession.ts`: SWR-based session source is much better than the old store model
- `apps/web/lib/auth/client.ts`: centralized invalidation and refresh dedupe are the right direction
- backend `/auth/login`, `/auth/refresh`, and `/users/session` flow
- backend session metadata (`expires_at`, `session_version`)

These are a solid base. The rewrite should target the layer above them.

## Critical Findings

### 1. Root layout is doing too much auth work

Current file: `apps/web/app/layout.tsx`

Problems:

- the root layout calls `connection()`
- the root layout fetches session for the entire app
- the root layout hydrates auth-aware providers globally

This pushes session awareness too high in the tree and makes the whole app more dynamic than necessary. Public routes should not pay the same cost or coupling as authenticated routes.

Impact:

- worse caching and prerender behavior
- harder reasoning about which parts actually require auth
- more global rerender pressure when session changes

### 2. Session is overloaded with full user profile concerns

Current files:

- `apps/web/lib/auth/types.ts`
- `apps/api/src/db/users.py`

The frontend currently treats session as both:

- an auth envelope
- the current user record
- a permission container
- a source for mutable preferences like theme and locale

That makes the session payload change more often than necessary and encourages unrelated UI to depend on auth state for ordinary profile rendering.

Impact:

- too many components read session just to get a user field
- profile mutations and auth mutations get coupled
- invalidation becomes harder to reason about

### 3. Server and client data access boundaries are blurred

Current files:

- `apps/web/services/users/users.ts`
- `apps/web/components/Objects/UserAvatar.tsx`
- `apps/web/components/Objects/UserProfilePopup.tsx`
- multiple other client components importing `apps/web/services/**`

The repo uses `'use server'` service modules as a general data layer, but many client components import them directly. Even when this works, it creates a muddy boundary between:

- server-only logic
- browser-safe API calls
- cache ownership
- mutation ownership

Impact:

- hard to know what runs where
- harder bundle hygiene
- harder testing and migration
- confusing developer ergonomics

### 4. User fetching is inconsistent and duplicated

Current examples:

- `apps/web/components/Objects/UserAvatar.tsx`
- `apps/web/components/Objects/GamifiedUserAvatar.tsx`
- `apps/web/components/Objects/UserProfilePopup.tsx`
- `apps/web/components/Dashboard/Pages/UserAccount/UserEditGeneral/UserEditGeneral.tsx`

Patterns currently include:

- direct `useSWR()` with ad hoc keys
- local `useState` plus manual fetch-on-open
- current user read from session
- other user reads from `getUser` or `getUserByUsername`

There is no clean frontend contract for:

- `useViewer()`
- `useMe()`
- `useUserById()`
- `useUserByUsername()`

Impact:

- duplicated logic
- inconsistent cache invalidation
- different loading behavior for the same entity
- more bugs when auth behavior changes

### 5. Auth migration residue is still present in the UI

Current examples:

- `apps/web/components/Objects/UserProfilePopup.tsx` contains `const token = undefined`
- `apps/web/components/Utils/LocaleSwitcher.tsx` contains `if (session?.data?.user?.id && undefined)`
- `apps/web/app/payments/stripe/connect/oauth/page.tsx` contains `if (!(code && undefined))`
- comments still reference removed token-threading behavior

These are not architecture by themselves, but they show that the frontend auth model is not fully consolidated.

Impact:

- low confidence in auth-related UI code
- misleading future maintenance
- hidden regressions after auth changes

### 6. Session ergonomics are still weak in client code

Current files:

- `apps/web/hooks/useSession.ts`
- `apps/web/components/Contexts/SessionProvider.tsx`
- many consumers using `session.data?.user`

The compatibility wrapper is convenient during migration, but it leaves the call sites awkward. Too much UI code still reads session like an HTTP response object instead of a domain object.

Impact:

- verbose call sites
- more nullable-path noise
- more repeated `status === 'authenticated'` checks
- weaker readability in UI code

## Rewrite Principles

1. Keep cookie auth and refresh rotation. Do not redesign backend auth.
2. Do not add another global state library for auth.
3. Keep SWR as the client cache for session and user data.
4. Separate auth session from profile data.
5. Make runtime boundaries explicit: server modules for server, client modules for browser.
6. Keep the public shell as static as possible.
7. Prefer a few well-named hooks over many generic abstractions.
8. Centralize invalidation and mutation side effects.

## Target Architecture

### A. One auth session source

Keep a single session cache key:

- `auth/session`

Expose it through a dedicated hook API:

- `useAuthSession()`
- `useAuthStatus()`
- `useIsAuthenticated()`

`useAuthSession()` should return a domain-shaped object, not a transport-shaped object. Preferred shape:

```ts
{
  session: Session | null;
  user: Viewer | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  isLoading: boolean;
  isAuthenticated: boolean;
  mutate: ...;
}
```

This removes most `session.data?.user` style code.

### B. Separate viewer profile from auth session

Introduce two distinct frontend concepts:

- `Session`: auth and authorization envelope
- `Viewer`: minimal currently authenticated user snapshot used by navigation and shell UI

Recommended rule:

- session should contain only fields needed for auth-aware rendering
- richer editable profile data should come from `useMe()` or user-specific endpoints

Preferred minimal viewer fields:

- `id`
- `user_uuid`
- `username`
- `first_name`
- `last_name`
- `avatar_image`
- `theme`
- `locale`

Fields like `bio`, `details`, and other profile-editor data should not be the default thing every auth consumer subscribes to.

### C. Explicit runtime split for data access

Create a small split like this:

- `apps/web/lib/auth/server.ts`
- `apps/web/lib/auth/client.ts`
- `apps/web/lib/users/server.ts`
- `apps/web/lib/users/client.ts`

Or equivalent names if the team prefers a different layout.

Rules:

- server components and route handlers use server modules only
- client components use client hooks or browser-safe fetch helpers only
- no client component imports from broad `'use server'` service modules

This is the single most important frontend quality fix after the root-layout issue.

### D. Standard hooks for user reads

Add a small, stable user hook layer:

- `useViewer()`
- `useMe(options?)`
- `useUserById(userId)`
- `useUserByUsername(username)`

All of them should:

- use standardized SWR keys
- share the same fetch utilities
- return the same loading and error shape
- own optimistic cache updates consistently

Suggested keys:

- `['auth', 'session']`
- `['viewer', 'me']`
- `['user', 'id', userId]`
- `['user', 'username', username]`

### E. Auth mutation controller

Create one small client auth module responsible for:

- login
- signup-then-login flow
- logout
- logout-all
- session invalidation
- post-login session revalidation

Rules:

- auth mutations must update session state in one place
- redirect behavior must be centralized
- `router.refresh()` should be used deliberately, not scattered

### F. Session-aware route segmentation

Move auth-dependent session hydration lower in the tree.

Target model:

- root layout stays as static and auth-agnostic as practical
- authenticated route groups use nested layouts with `requireSession()`
- public pages use lightweight client session reads only where necessary

This is the correct balance between SSR correctness and public-page performance.

## Proposed Implementation Phases

### Phase 0. Cleanup pass

Purpose: remove migration residue before deeper changes.

Tasks:

- remove dead auth placeholders and comments
- remove token-era leftovers from user and locale components
- audit all client imports from `'use server'` service modules
- document every current session and user entry point

Exit criteria:

- no `&& undefined`, `token = undefined`, or similar auth residue remains
- all auth-related comments match current behavior

### Phase 1. Introduce clean session hook ergonomics

Purpose: improve developer experience without changing core behavior.

Tasks:

- add `useAuthSession()` as the canonical hook
- keep `useSession()` temporarily as a compatibility wrapper
- expose `user`, `isAuthenticated`, and `isLoading` directly
- update the most common consumers first

Priority consumer targets:

- header
- sidebar
- permission provider
- theme sync
- locale switcher

Exit criteria:

- most new code no longer uses `session.data?.user`
- session consumers read like domain code, not transport code

### Phase 2. Split viewer and user-profile data

Purpose: stop using session as the universal user model.

Tasks:

- define a `Viewer` type on the frontend
- add `useViewer()` and `useMe()` hooks
- move profile-edit pages to `useMe()`
- keep permission and shell UI on `useViewer()` or `useAuthSession()`

Optional backend improvement:

- slim `/users/session` so it returns only auth-relevant user fields

Exit criteria:

- profile editing no longer depends on the session object as its main record
- mutable profile state and auth state are distinct in code

### Phase 3. Replace ad hoc user fetching with standardized hooks

Purpose: fix duplication and inconsistent cache ownership.

Tasks:

- add `useUserById()` and `useUserByUsername()`
- migrate avatar, popup, and profile-display components
- consolidate user SWR keys
- remove bespoke fetch-on-open state machines where SWR handles the job better

Migration targets:

- `apps/web/components/Objects/UserAvatar.tsx`
- `apps/web/components/Objects/GamifiedUserAvatar.tsx`
- `apps/web/components/Objects/UserProfilePopup.tsx`
- profile-related dashboard screens

Exit criteria:

- the same user entity uses the same cache key everywhere
- user display components do not each invent their own fetch lifecycle

### Phase 4. Enforce server/client data boundaries

Purpose: make runtime ownership explicit.

Tasks:

- split browser-safe user functions from server-only service modules
- stop importing general `'use server'` modules in client components
- add lint or code-review rule for runtime boundary violations

Exit criteria:

- client components import only client-safe hooks or helpers
- server utilities are not acting as the default browser data layer

### Phase 5. Move session hydration lower in the tree

Purpose: improve caching and reduce global auth coupling.

Tasks:

- remove root-level session fetch unless strictly required
- create nested auth-aware layouts for authenticated route groups
- keep root providers mostly auth-agnostic
- hydrate session only where SSR auth is actually needed

Likely route groups:

- dashboard
- editor
- account settings
- other authenticated platform surfaces

Exit criteria:

- public pages do not depend on root-level `getSession()`
- authenticated areas still receive correct server-side gating

### Phase 6. Centralize auth mutation side effects

Purpose: make login, logout, refresh, and permission-changing events deterministic.

Tasks:

- create one mutation layer for auth side effects
- standardize when to `mutate('auth/session')`
- standardize when to `router.refresh()`
- standardize post-logout redirect behavior
- standardize session invalidation after password and role changes

Exit criteria:

- auth mutations do not each manage session state differently
- session refresh and redirect behavior is predictable across the app

## File-Level Rewrite Targets

### High priority

- `apps/web/app/layout.tsx`
- `apps/web/app/root-providers.tsx`
- `apps/web/hooks/useSession.ts`
- `apps/web/components/Contexts/SessionProvider.tsx`
- `apps/web/components/Security/PermissionProvider.tsx`
- `apps/web/components/Objects/UserAvatar.tsx`
- `apps/web/components/Objects/UserProfilePopup.tsx`
- `apps/web/components/Utils/LocaleSwitcher.tsx`
- `apps/web/components/Security/HeaderProfileBox.tsx`
- `apps/web/components/Dashboard/Menus/DashSidebar.tsx`

### Medium priority

- profile-edit screens
- gamification components reading current user from session
- user display components inside editor and social surfaces
- payment and OAuth callback screens with auth-state checks

## Recommended End State

By the end of the rewrite, the frontend should have this mental model:

- server auth gate: `requireSession()` and `requirePermission()`
- client auth state: `useAuthSession()`
- current viewer shell data: `useViewer()`
- editable current-user profile: `useMe()`
- arbitrary user lookup: `useUserById()` and `useUserByUsername()`
- auth-aware HTTP: `apiFetch()`
- auth invalidation: one centralized client module

That is enough. No Zustand auth store. No event-heavy auth state machine. No duplicate transport abstractions.

## Testing And Validation

### Automated

- typecheck the web app after each phase
- add targeted tests for session hook behavior
- add tests for logout and invalidation flows
- add tests for `useViewer()` and `useMe()` cache interaction
- verify permission reads after role mutation

### Manual

- login and logout from multiple tabs
- session expiry while browsing
- refresh rotation after 401 recovery
- theme and locale updates
- password change followed by forced invalidation
- public landing pages and course pages without auth flicker
- dashboard and editor route protection

## Acceptance Criteria

- public routes are no longer globally coupled to root-level session fetching
- client components do not import broad server-only service modules for user reads
- there is one obvious hook for auth session and one obvious hook for current viewer data
- user entity reads use consistent SWR keys and fetchers
- session-related UI no longer contains token-era dead code
- auth mutations have centralized cache and redirect behavior
- the system remains simple enough that a new engineer can trace login, logout, and current-user rendering in minutes
