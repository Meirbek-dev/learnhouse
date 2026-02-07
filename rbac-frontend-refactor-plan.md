# Frontend RBAC Refactor Plan

## Table of Contents

1. [Critique: Why the Current System is Bad](#1-critique-why-the-current-system-is-bad)
2. [Architecture: Clean Target Design](#2-architecture-clean-target-design)
3. [File-by-File Changes](#3-file-by-file-changes)
4. [Implementation Plan](#4-implementation-plan)
5. [Testing Strategy](#5-testing-strategy)

---

## 1. Critique: Why the Current System is Bad

### 1.1 Critical Bug: Default Scope `ALL` Breaks Most Permission Checks

The `can()` function in `PermissionProvider.tsx` defaults scope to `Scopes.ALL`:

```tsx
const can = useCallback(
  (action: Action, resource: ResourceType, scope: Scope = Scopes.ALL): boolean => {
```

Scope broadening only goes **narrow → broad** (`own → assigned → org → all`). When callers omit scope (and most do), the system asks "does the user have the `all` scope?" — which is the **broadest** already. There's nothing broader to fall back to.

**Concrete example**: An org-admin has `organization:manage:own`. When `AdminGuard` calls `can(Actions.MANAGE, ResourceTypes.ORGANIZATION)` (no scope = deeTfaults to `ALL`):

1. Looks for `organization:manage:all` → not in set
2. Wildcards: `organization:*:all`, `*:manage:all` → not in set
3. Scope broadening for `all` → `SCOPE_BROADER['all']` is `undefined` → **no broadening happens**
4. Returns `false` — org-admin is locked out of their own dashboard

Every call site that omits scope is affected:

- `AdminGuard.tsx` — `can(Actions.MANAGE, ResourceTypes.ORGANIZATION)`
- `DashSidebar.tsx` — same
- `DashMobileMenu.tsx` — same
- Course subpage tabs — `can(tab.requiredAction, Resourcypes.COURSE)`

This is either **broken in production** or the backend papers over it by emitting redundant `all`-scoped permissions that mirror every `own`/`org` permission. Either way, the `can()` function has the wrong default and the wrong semantics.

### 1.2 Two Completely Different Permission Systems (Server vs Client)

The frontend runs **two parallel and incompatible** RBAC pipelines:

|                      | Server-side (layouts)                        | Client-side (PermissionProvider)                       |
| -------------------- | -------------------------------------------- | ------------------------------------------------------ |
| **Data source**      | `session.permissions` from NextAuth JWT      | SWR fetch from `/rbac/me/permissions`                  |
| **Data shape**       | `Record<string, boolean>` (object, key→true) | `string[]` → `Set<string>`                             |
| **Check method**     | `permissions[key] === true` (dict lookup)    | `can(action, resource, scope)` (wildcard + broadening) |
| **Wildcard support** | None — exact string match only               | Full wildcard + scope broadening                       |
| **When it runs**     | On server, during RSC rendering              | On client, after hydration                             |

This means the server and client can **disagree** on whether a user has access. A user could pass the server layout check (exact match in dict) but fail the client `AdminGuard` (different data, different logic), or vice versa. The user sees a flash of "Access Denied" after the server already rendered the page shell.

### 1.3 OrgLayout Uses Wrong Permission Names

`dash/org/layout.tsx` calls `fetchUserPermissions()` then checks:

```typescript
permissions?.permissions?.['organizations:read:org'] === true ||
permissions?.permissions?.['organizations:update:org'] === true;
```

The resource is `organization` (singular) in `permissions.yaml`. The generated constant is `ResourceTypes.ORGANIZATION = 'ORGANIZATION'`. But this layout hardcodes `'organizations'` (plural, lowercase). This will **never match** unless the backend happens to emit both forms.

It also treats the `fetchUserPermissions()` response as `Record<string, boolean>` (checking `=== true`), but that function returns `{ permissions: string[] }` — an array, not a dict. `string[]['organizations:read:org']` is `undefined`, not `true`. The check always fails.

### 1.4 `AuthGuard` is Logically Broken

```tsx
export function AuthGuard({ children, fallback }) {
  const { loading: isLoading } = usePermissions();
  const isAuthenticated = !isLoading;  // ← NOT correct
```

"Not loading" does not mean "authenticated." When loading finishes but the user is unauthenticated, `isLoading` is `false`, so `isAuthenticated` becomes `true`. The guard lets unauthenticated users through.

### 1.5 Two `usePermissions` Hooks With the Same Name

| File                      | Export name        | What it does                                                  |
| ------------------------- | ------------------ | ------------------------------------------------------------- |
| `PermissionProvider.tsx`  | `usePermissions()` | Base hook — `can`, `hasRole`, `isAdmin`, etc.                 |
| `hooks/usePermissions.ts` | `usePermissions()` | Extended hook — wraps base, adds `canUpdate`, `isOwner`, etc. |

The barrel `Security/index.ts` re-exports the **extended** hook. But consumers that import directly from `PermissionProvider` get the **base** hook. Same name, different return types, no compiler warning. Which one you get depends on your import path — a silent source of bugs.

### 1.6 `UserPermissionsResponse` Defined in Three Places With Different Types

| File                                            | `roles` type                 | `org_id` type                 |
| ----------------------------------------------- | ---------------------------- | ----------------------------- |
| `PermissionProvider.tsx` (line 35)              | `Role[]`                     | `number \| null`              |
| `types/permissions.ts` (line 71)                | `Role[]`                     | `number \| null \| undefined` |
| `services/permissions/permissions.ts` (line 28) | `Array<Record<string, any>>` | `number \| null`              |

The service types `roles` as `Record<string, any>` — completely untyped. The other two disagree on whether `org_id` can be `undefined`. Any file can import any of these three, and TypeScript won't flag the mismatch because they're structurally compatible enough to not error.

### 1.7 Duplicate Function Definitions

`isAdminRole()` and `isInstructorOrHigher()` are implemented identically in both:

- `types/generated_permissions.ts` (marked "DO NOT EDIT")
- `types/permissions.ts`

Two copies of the same logic. Which one gets called depends on import path. If either is updated without the other, behavior silently diverges.

### 1.8 Server Layouts: Massive Duplication With Inconsistent Role Sets

Four server layouts repeat the same 30-line pattern but check **different role sets**:

| Layout                | Allowed roles                                      | Permission fallback            |
| --------------------- | -------------------------------------------------- | ------------------------------ |
| `admin/layout.tsx`    | super-admin, org-admin, **maintainer**             | org manage/update, role update |
| `users/layout.tsx`    | super-admin, org-admin                             | 5 user permissions             |
| `payments/layout.tsx` | super-admin, org-admin                             | payment manage, org manage     |
| `courses/layout.tsx`  | super-admin, org-admin, **maintainer, instructor** | 3 course permissions           |

Each one:

1. Gets session with `await auth()`
2. Checks `!session?.user` → redirect
3. Extracts `session.roles`, casts to `any`
4. Iterates roles with `.some((userRole: any) => ...)`
5. Falls back to `session.permissions[buildPermissionName(...)] === true`
6. Redirects if both fail

No shared helper. Each layout independently decides which roles and permissions to check. Adding a new role means updating 4+ files by hand.

### 1.9 Double Authorization: Server Layout + Client AdminGuard

`dash/layout.tsx` wraps the entire dashboard in `<AdminGuard>` (client-side). Then sub-layouts like `courses/layout.tsx` do **additional** server-side checks with different logic. Result:

- Two round-trips of permission checking per page load
- Server and client can disagree (different data sources, different logic)
- Flash of "Access Denied" if server allows but client (with potentially stale SWR data) rejects

### 1.10 `isAdmin` Used for Fine-Grained Decisions Instead of `can()`

Multiple components use the boolean `isAdmin` flag where they should use permission checks:

| Component                | Uses `isAdmin` for         | Should be                                                     |
| ------------------------ | -------------------------- | ------------------------------------------------------------- |
| `discussion-reply.tsx`   | Delete button, edit button | `can(MODERATE, DISCUSSION)` or `can(DELETE, DISCUSSION, OWN)` |
| `CourseUpdates.tsx`      | Delete update button       | `can(UPDATE, COURSE)`                                         |
| `CourseAuthors.tsx`      | Author management          | `can(MANAGE, COURSE)`                                         |
| `Onboarding.tsx`         | Onboarding visibility      | `can(MANAGE, ORGANIZATION)`                                   |
| `ContentPlaceHolder.tsx` | Placeholder content        | `can(CREATE, ACTIVITY)`                                       |
| `HeaderProfileBox.tsx`   | Dashboard link             | `can(MANAGE, ORGANIZATION)`                                   |

Using `isAdmin` defeats the purpose of having permissions. A moderator who should be able to moderate discussions can't because they're not "admin". An instructor who should manage their own course can't because they're not "admin".

### 1.11 Over-Memoization in Extended `usePermissions` Hook

`hooks/usePermissions.ts` wraps 15+ individual boolean values in separate `useMemo` calls:

```tsx
const canModerate = useMemo(() => extracted?.can_moderate ?? false, [extracted]);
const canGrade = useMemo(() => extracted?.can_grade ?? false, [extracted]);
const canEnroll = useMemo(() => extracted?.can_enroll ?? false, [extracted]);
```

`extracted?.can_moderate ?? false` is a trivial property access — not a computation worth memoizing. All of these depend on the same `extracted` object, so they all recompute together anyway. This is 15 `useMemo` hooks adding overhead for zero benefit.

### 1.12 Dead Code: `PermissionMonitoring.tsx`

199 lines of monitoring infrastructure (`PermissionMonitor` class, `usePermissionMetrics` hook, `PermissionDevTools` component). **Nothing in the codebase calls `permissionMonitor.recordCheck()`**. The `can()` function isn't instrumented. The entire file is dead weight that was built for a system that doesn't use it.

### 1.13 `HeaderProfileBox` Maintains Its Own Inline Role Hierarchy

```tsx
const getRolePriority = (role: any) => {
  const slug = role.role?.slug || '';
  if (slug === RoleSlugs.SUPER_ADMIN || slug === RoleSlugs.ORG_ADMIN) return 4;
  if (slug === RoleSlugs.MAINTAINER) return 3;
  if (slug === RoleSlugs.INSTRUCTOR) return 2;
  return 1;
};
```

This duplicates the role hierarchy from `permissions.yaml` and from the `Role.priority` field that the API already returns. When roles change, this inline version won't be updated.

### 1.14 Hardcoded English in `PermissionDenied`

`PermissionDenied.tsx` maintains two full `Record<>` maps of action/resource labels in English:

```tsx
const actionLabels: Record<Action, string> = {
  [Actions.CREATE]: 'create',
  [Actions.READ]: 'view',
  // ...
};
```

The app uses `next-intl` for i18n everywhere else. This component breaks the pattern with hardcoded strings.

### 1.15 Type Safety Bypassed With `as any` Everywhere

- `AdminGuard.tsx`: `useOrg() as any`
- `HeaderProfileBox.tsx`: `usePlatformSession() as any`
- All 4 server layouts: `(userRole: any)` when iterating roles

These casts hide type errors and make the codebase fragile. The underlying types are known — there's no reason for `any`.

### 1.16 `CommonPermissions` Constants: Hard to Maintain, Easy to Misuse

`types/permissions.ts` defines 18 `CommonPermissions` constants:

```typescript
COURSE_CREATE: buildPermissionName(ResourceTypes.COURSE, Actions.CREATE, Scopes.ORG),
COURSE_READ: buildPermissionName(ResourceTypes.COURSE, Actions.READ, Scopes.ALL),
```

These are only used in server layouts for dict lookups against `session.permissions`. They add another abstraction layer without adding value — callers still need to know which constant maps to which resource/action/scope combo. And they're incomplete: only 18 of the hundreds of possible combinations are pre-built, so callers mix `CommonPermissions.X` with inline `buildPermissionName()` calls.

### 1.17 `RoleGuard` Component: Anti-Pattern

`PermissionGuard.tsx` exports a `RoleGuard` that checks role slugs directly:

```tsx
<RoleGuard role="org-admin">
  <AdminSettings />
</RoleGuard>
```

This bypasses the permission system entirely. The whole point of RBAC is to check **permissions**, not roles. If a custom role has the same permissions as org-admin, `RoleGuard` will deny it. `RoleGuard` should not exist.

### 1.18 `LHSessionContext` Is a Redundant Session Wrapper

`LHSessionContext.tsx` wraps `useSession()` in a custom context (`usePlatformSession()`). `PermissionProvider` also calls `useSession()`. Components like `HeaderProfileBox` use **both** simultaneously, reading roles from the session AND the permission hook. Two parallel pipelines for the same data.

### 1.19 `RoleHierarchyTree` Is Dead Code

Exported from `Security/index.ts` but never imported by any consumer in the codebase.

### 1.20 Services Layer: Needless Fragmentation

Permission-related API calls are split across three files:

- `services/permissions/permissions.ts` — fetch permissions, check permissions, list roles, assign/revoke roles
- `services/roles/roles.ts` — CRUD roles
- `services/auth/auth.ts` — `getUserSession()` which also returns permissions

Three files, overlapping concerns, no clear boundary. `permissions.ts` has `listRoles()` and `getRoleById()` while `roles.ts` has `getRole()` and `createRole()`. Role management is split between two service files.

---

## 2. Architecture: Clean Target Design

### 2.1 Core Principles

1. **Single permission pipeline**: One data source, one format, one check method — everywhere
2. **Server = source of truth**: Server layouts do the real auth check. Client just reflects it
3. **Permissions, not roles**: Never check role slugs in components. Always use `can()`
4. **No wildcard/broadening on frontend**: Backend resolves all permissions to flat explicit strings. Frontend does simple `Set.has()` lookups
5. **One hook, one name**: Single `usePermissions()` with one return type
6. **Zero dead code**: No monitoring, no role guards, no duplicate types, no unused exports

### 2.2 Data Flow

```
Backend API                          Frontend
─────────────────────────────────────────────────────────────
GET /rbac/me/permissions
  → { permissions: string[], roles: Role[] }
     │
     ├─── NextAuth session callback
     │    └─── session.permissions = Set<string>
     │    └─── session.roles = Role[]
     │         │
     │         ├─── Server layouts: session.permissions.has(key)
     │         │
     │         └─── JWT token → client
     │
     └─── PermissionProvider (client)
          └─── permissions = Set<string> (from session, no extra fetch)
          └─── can(action, resource, scope) → permissions.has(buildKey(...))
               │
               ├─── usePermissions() hook
               │    └─── can, isAdmin, loading
               │
               ├─── PermissionGuard component
               │
               └─── Consumer components
```

**Key change**: The `PermissionProvider` reads permissions from the **NextAuth session** instead of making a separate SWR fetch. One data source. One format. Server and client always agree.

### 2.3 Backend Contract

The backend is responsible for:

1. Resolving wildcards (`*:*:*`, `course:*:org`) into explicit permission strings
2. Resolving scope broadening (`course:update:own` → also grants `course:update:own` check)
3. Resolving role inheritance
4. Returning a **flat array of explicit permission strings** (e.g., `["course:create:org", "course:read:all", "course:update:own", ...]`)

The frontend does **zero** interpretation. It's a dumb lookup: `set.has("course:update:own")`.

### 2.4 Target File Structure

```
apps/web/
├── types/
│   └── permissions.ts            # Single type file (generated + interfaces)
├── components/
│   └── Security/
│       ├── PermissionProvider.tsx  # Context provider (reads from session)
│       ├── PermissionGuard.tsx     # Single guard component
│       └── index.ts               # Barrel export
├── hooks/
│   └── usePermissions.ts          # Single hook (no wrapper layers)
├── lib/
│   └── server-auth.ts             # Server-side permission helpers
└── services/
    └── rbac.ts                    # Single service file for all RBAC API calls
```

**8 files total** (down from 15+). No monitoring. No `RoleGuard`. No `AuthGuard`. No `AdminGuard`. No `PermissionDenied`. No `PermissionTooltip`. No `RoleHierarchyTree`. No `LHSessionContext` (for RBAC purposes). No `CommonPermissions`. No duplicate types.

---

## 3. File-by-File Changes

### 3.1 Files to DELETE (Dead Code / Redundant)

| File                                           | Reason                                                                                 |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `components/Security/PermissionMonitoring.tsx` | 199 lines, never called, dead code                                                     |
| `components/Security/RoleHierarchyTree.tsx`    | Exported but never imported anywhere                                                   |
| `components/Security/AdminGuard.tsx`           | Replace with `PermissionGuard` or server-side check                                    |
| `components/Security/PermissionDenied.tsx`     | Hardcoded English, over-engineered for what it does. Inline the denial UI where needed |
| `components/Utils/PermissionTooltip.tsx`       | Thin wrapper, inline the tooltip logic                                                 |
| `types/generated_permissions.ts`               | Merge into single `types/permissions.ts`                                               |
| `services/permissions/permissions.ts`          | Merge into `services/rbac.ts`                                                          |
| `services/roles/roles.ts`                      | Merge into `services/rbac.ts`                                                          |

### 3.2 Files to REWRITE

#### `types/permissions.ts` — Single Source of Truth for Types

Merge `generated_permissions.ts` into this file. Keep it as the single type file. Remove all duplicate function definitions.

```typescript
/**
 * Permission types — auto-generated from shared/permissions.yaml
 * DO NOT EDIT MANUALLY
 */

// === Constants (from YAML) ===

export const Actions = {
  CREATE: 'create',    // ← lowercase to match backend format directly
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage',
  MODERATE: 'moderate',
  EXPORT: 'export',
  INVITE: 'invite',
  GRADE: 'grade',
  SUBMIT: 'submit',
  ENROLL: 'enroll',
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];

export const Resources = {     // ← renamed from ResourceTypes for brevity
  ORGANIZATION: 'organization',   // ← lowercase to match backend
  COURSE: 'course',
  CHAPTER: 'chapter',
  ACTIVITY: 'activity',
  ASSIGNMENT: 'assignment',
  QUIZ: 'quiz',
  USER: 'user',
  USERGROUP: 'usergroup',
  COLLECTION: 'collection',
  ROLE: 'role',
  CERTIFICATE: 'certificate',
  DISCUSSION: 'discussion',
  FILE: 'file',
  ANALYTICS: 'analytics',
  TRAIL: 'trail',
  EXAM: 'exam',
  PAYMENT: 'payment',
  API_TOKEN: 'api_token',
} as const;

export type Resource = (typeof Resources)[keyof typeof Resources];

export const Scopes = {
  ALL: 'all',          // ← lowercase
  OWN: 'own',
  ASSIGNED: 'assigned',
  ORG: 'org',
} as const;

export type Scope = (typeof Scopes)[keyof typeof Scopes];

export const RoleSlugs = {
  SUPER_ADMIN: 'super-admin',
  ORG_ADMIN: 'org-admin',
  MAINTAINER: 'maintainer',
  INSTRUCTOR: 'instructor',
  MODERATOR: 'moderator',
  USER: 'user',
} as const;

export type RoleSlug = (typeof RoleSlugs)[keyof typeof RoleSlugs];

// === Types ===

/** Format: "resource:action:scope" */
export type PermissionString = `${Resource}:${Action}:${Scope}`;

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  org_id?: number | null;
  is_system: boolean;
  priority: number;
}

export interface UserRBACData {
  roles: Role[];
  permissions: string[];
  org_id: number | null;
}

// === Helpers ===

export function perm(resource: Resource, action: Action, scope: Scope): PermissionString {
  return `${resource}:${action}:${scope}`;
}

export function isAdminRole(slug: string): boolean {
  return slug === RoleSlugs.SUPER_ADMIN || slug === RoleSlugs.ORG_ADMIN;
}
```

**Key changes**:

- Constants are **lowercase** to match backend format directly — no `toLowerCase()` needed at check time
- Renamed `ResourceTypes` → `Resources` (shorter, cleaner)
- Renamed `buildPermissionName` → `perm` (used everywhere, should be short)
- Removed `parsePermissionName`, `isInstructorOrHigher`, `CommonPermissions` — unused or anti-pattern
- Single `UserRBACData` type (replaces 3 different `UserPermissionsResponse` definitions)
- Removed `Permission`, `RoleWithPermissions`, `UserRole` interfaces (only used in role admin pages — define them locally there)

#### `components/Security/PermissionProvider.tsx` — Simplified Provider

```tsx
'use client';

import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import type { Role, Action, Resource, Scope } from '@/types/permissions';
import { perm, isAdminRole, RoleSlugs } from '@/types/permissions';

interface PermissionContextValue {
  /** Check if user has a specific permission */
  can: (action: Action, resource: Resource, scope: Scope) => boolean;
  /** Check if user has any of the specified permissions */
  canAny: (checks: Array<{ action: Action; resource: Resource; scope: Scope }>) => boolean;
  /** User's roles */
  roles: Role[];
  /** Convenience: user has an admin role */
  isAdmin: boolean;
  /** Still loading session */
  loading: boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const permissions = useMemo(
    () => new Set<string>(session?.permissions ?? []),
    [session?.permissions]
  );

  const roles = useMemo<Role[]>(
    () => session?.roles ?? [],
    [session?.roles]
  );

  const can = useMemo(() => {
    return (action: Action, resource: Resource, scope: Scope): boolean => {
      if (status !== 'authenticated') return false;
      return permissions.has(perm(resource, action, scope));
    };
  }, [status, permissions]);

  const canAny = useMemo(() => {
    return (checks: Array<{ action: Action; resource: Resource; scope: Scope }>): boolean => {
      return checks.some(c => can(c.action, c.resource, c.scope));
    };
  }, [can]);

  const isAdmin = useMemo(
    () => roles.some(r => isAdminRole(r.slug)),
    [roles]
  );

  const value: PermissionContextValue = useMemo(() => ({
    can,
    canAny,
    roles,
    isAdmin,
    loading: status === 'loading',
  }), [can, canAny, roles, isAdmin, status]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextValue {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionProvider');
  return ctx;
}
```

**Key changes**:

- **No SWR fetch** — reads from NextAuth session directly (single data source)
- **No scope default** — callers MUST specify scope (eliminates the `ALL` default bug)
- **No wildcard/broadening logic** — backend resolves everything, frontend does `Set.has()`
- **No `canAll`, `hasRole`, `hasAnyRole`, `isSuperAdmin`, `isInstructor`** — removed unused/anti-pattern helpers
- **No `invalidate()`, `prefetch()`** — no SWR means no cache to manage
- **No `initialPermissions` prop** — no SSR hydration mismatch risk
- ~80 lines instead of ~295

#### `hooks/usePermissions.ts` — Thin Extension (or Removed)

Two options:

**Option A: Remove entirely.** Let consumers use `usePermissions()` from `PermissionProvider` directly. For resource metadata (`can_update`, `is_owner`), consumers read it directly from the resource object:

```tsx
// Before (over-engineered)
const { canUpdate, isOwner } = usePermissions({ resource: course });

// After (simple)
const { can } = usePermissions();
const canUpdate = course.can_update;
const isOwner = course.is_owner;
```

**Option B: Keep as minimal resource helper.** If the convenience of destructuring from one hook is worth it:

```typescript
'use client';

import { useMemo } from 'react';
import { usePermissions as useBasePermissions } from '@/components/Security/PermissionProvider';

export interface ResourcePermissions {
  can_update?: boolean;
  can_delete?: boolean;
  can_create?: boolean;
  is_owner?: boolean;
  available_actions?: string[];
}

export function useResourcePermissions(resource?: ResourcePermissions | null) {
  const base = useBasePermissions();

  const resourcePerms = useMemo(() => ({
    canUpdate: resource?.can_update ?? false,
    canDelete: resource?.can_delete ?? false,
    canCreate: resource?.can_create ?? false,
    isOwner: resource?.is_owner ?? false,
    availableActions: resource?.available_actions ?? [],
  }), [resource]);

  return { ...base, ...resourcePerms };
}
```

**Recommendation: Option A.** The extended hook adds 178 lines for what amounts to `course.can_update`. Kill it.

#### `components/Security/PermissionGuard.tsx` — Single Guard

```tsx
'use client';

import type { ReactNode } from 'react';
import type { Action, Resource, Scope } from '@/types/permissions';
import { usePermissions } from './PermissionProvider';

interface PermissionGuardProps {
  action: Action;
  resource: Resource;
  scope: Scope;          // ← required, no default
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGuard({
  action,
  resource,
  scope,
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { can, loading } = usePermissions();

  if (loading) return null;
  if (!can(action, resource, scope)) return <>{fallback}</>;
  return <>{children}</>;
}
```

**What's removed**:

- `MultiPermissionGuard` — use `canAny` inline instead of a component
- `RoleGuard` — anti-pattern, check permissions not roles
- `AuthGuard` — use NextAuth middleware or `useSession().status`
- `showLoading` / `loadingComponent` props — guards should be invisible, not show spinners

#### `components/Security/index.ts` — Clean Barrel

```typescript
export { PermissionProvider, usePermissions } from './PermissionProvider';
export { PermissionGuard } from './PermissionGuard';
export type { Action, Resource, Scope, Role, PermissionString } from '@/types/permissions';
export { Actions, Resources, Scopes, RoleSlugs, perm } from '@/types/permissions';
```

#### `lib/server-auth.ts` — Server-Side Permission Helpers (NEW)

Extract the duplicated server layout logic into a reusable module:

```typescript
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import type { Action, Resource, Scope } from '@/types/permissions';
import { perm } from '@/types/permissions';

/**
 * Get the current session or redirect to login.
 */
export async function requireAuth(orgslug: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/orgs/${orgslug}/auth`);
  }
  return session;
}

/**
 * Check if the session has a specific permission.
 */
export function sessionCan(
  session: { permissions?: string[] },
  action: Action,
  resource: Resource,
  scope: Scope,
): boolean {
  const perms = new Set(session.permissions ?? []);
  return perms.has(perm(resource, action, scope));
}

/**
 * Require a specific permission or redirect.
 */
export async function requirePermission(
  orgslug: string,
  action: Action,
  resource: Resource,
  scope: Scope,
  redirectTo?: string,
) {
  const session = await requireAuth(orgslug);
  if (!sessionCan(session, action, resource, scope)) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}

/**
 * Require any of the specified permissions or redirect.
 */
export async function requireAnyPermission(
  orgslug: string,
  checks: Array<{ action: Action; resource: Resource; scope: Scope }>,
  redirectTo?: string,
) {
  const session = await requireAuth(orgslug);
  const hasAny = checks.some(c => sessionCan(session, c.action, c.resource, c.scope));
  if (!hasAny) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}
```

**Key design**: Uses the same `perm()` helper and type system as the client. Same data format (`session.permissions` as `string[]`). Same `Set.has()` check. Server and client are guaranteed to agree.

#### `services/rbac.ts` — Single Service File (NEW)

Merge `services/permissions/permissions.ts` and `services/roles/roles.ts`:

```typescript
import type { Role, UserRBACData } from '@/types/permissions';
import { getAPIUrl } from '@/services/config/config';

const api = (path: string) => `${getAPIUrl()}${path}`;

async function request<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `RBAC API error: ${res.status}`);
  }
  return res.json();
}

// Permissions
export const fetchMyPermissions = (token: string, orgId?: number) =>
  request<UserRBACData>(
    api(`rbac/me/permissions${orgId ? `?org_id=${orgId}` : ''}`),
    token,
  );

// Roles
export const listRoles = (token: string, orgId?: number) =>
  request<Role[]>(api(`roles/${orgId ? `?org_id=${orgId}` : ''}`), token);

export const getRole = (token: string, roleId: number) =>
  request<Role>(api(`roles/${roleId}`), token);

export const createRole = (token: string, orgId: number, body: Record<string, unknown>) =>
  request<Role>(api(`roles/org/${orgId}`), token, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const updateRole = (token: string, roleId: number, body: Record<string, unknown>) =>
  request<Role>(api(`roles/${roleId}`), token, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteRole = (token: string, roleId: number, orgId: number) =>
  request<void>(api(`roles/${roleId}?org_id=${orgId}`), token, { method: 'DELETE' });

// Role assignment
export const assignRole = (token: string, userId: number, roleSlug: string, orgId: number) =>
  request<void>(api('rbac/roles/assign'), token, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_slug: roleSlug, org_id: orgId }),
  });

export const revokeRole = (token: string, userId: number, roleSlug: string, orgId: number) =>
  request<void>(api('rbac/roles/revoke'), token, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, role_slug: roleSlug, org_id: orgId }),
  });
```

**What's removed**:

- `batchCheckPermissions()` — server resolves everything upfront, no need for batch checks
- `checkPermission()` — same reason
- Duplicate `UserPermissionsResponse` interface — uses canonical `UserRBACData`
- Two service files → one

### 3.3 Files to MODIFY (Consumers)

#### NextAuth Config (`auth.ts`)

Change the session callback to store permissions as `string[]` (not `Record<string, boolean>`):

```typescript
// In session callback:
session.permissions = apiSession.permissions; // string[] from API
session.roles = apiSession.roles;            // Role[] from API
```

Update `next-auth.d.ts`:

```typescript
declare module 'next-auth' {
  interface Session {
    permissions: string[];  // ← was Record<string, boolean>
    roles: Role[];
    // ...
  }
}
```

#### Server Layouts — Replace With `requirePermission`/`requireAnyPermission`

**Before** (`dash/courses/layout.tsx` — 55 lines):

```tsx
async function CoursesLayout({ children, params }) {
  const { orgslug } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/orgs/${orgslug}/auth`);
  const userRoles = session.roles || [];
  const hasInstructorRole = userRoles.some((userRole: any) => {
    const roleSlug = userRole.role?.slug || '';
    return [RoleSlugs.SUPER_ADMIN, RoleSlugs.ORG_ADMIN, RoleSlugs.MAINTAINER, RoleSlugs.INSTRUCTOR].includes(roleSlug);
  });
  const permissions = session.permissions || {};
  const canManageCourses =
    permissions[buildPermissionName(ResourceTypes.COURSE, Actions.CREATE, Scopes.ORG)] === true || ...;
  if (!hasInstructorRole && !canManageCourses) redirect(`/orgs/${orgslug}/unauthorized`);
  return <>{children}</>;
}
```

**After** (5 lines):

```tsx
import { requireAnyPermission } from '@/lib/server-auth';
import { Actions, Resources, Scopes } from '@/types/permissions';

async function CoursesLayout({ children, params }) {
  const { orgslug } = await params;
  await requireAnyPermission(orgslug, [
    { action: Actions.CREATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.COURSE, scope: Scopes.ORG },
  ]);
  return <>{children}</>;
}
```

No role checks. No `any` casts. No inline permission dict lookups. Same pattern for all layouts.

#### `dash/layout.tsx` — Remove `AdminGuard`, Use Server Check Only

**Before**:

```tsx
<AdminGuard>
  <ClientAdminLayout>{children}</ClientAdminLayout>
</AdminGuard>
```

**After**:

```tsx
import { requirePermission } from '@/lib/server-auth';
import { Actions, Resources, Scopes } from '@/types/permissions';

async function DashLayout({ children, params }) {
  const { orgslug } = await params;
  await requirePermission(orgslug, Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN);
  return <ClientAdminLayout>{children}</ClientAdminLayout>;
}
```

Server-only check. No client `AdminGuard`. No double authorization. No flash of "Access Denied".

#### `dash/org/layout.tsx` — Fix the Broken Permission Names

**Before** (broken):

```tsx
const canManageOrganization =
  permissions?.permissions?.['organizations:read:org'] === true ||  // ← plural, wrong
  permissions?.permissions?.['organizations:update:org'] === true;
```

**After**:

```tsx
import { requireAnyPermission } from '@/lib/server-auth';
import { Actions, Resources, Scopes } from '@/types/permissions';

async function OrgLayout({ children, params }) {
  const { orgslug } = await params;
  await requireAnyPermission(orgslug, [
    { action: Actions.READ, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
  ]);
  return <>{children}</>;
}
```

#### Client Components Using `isAdmin` — Replace With `can()`

**Before** (`discussion-reply.tsx`):

```tsx
const { isAdmin } = usePermissions();
// ...
{isAdmin && <DeleteButton />}
```

**After**:

```tsx
const { can } = usePermissions();
// ...
{can(Actions.MODERATE, Resources.DISCUSSION, Scopes.ORG) && <DeleteButton />}
```

Same pattern for:

- `CourseUpdates.tsx`: `can(Actions.UPDATE, Resources.COURSE, Scopes.OWN)`
- `CourseAuthors.tsx`: `can(Actions.MANAGE, Resources.COURSE, Scopes.OWN)`
- `HeaderProfileBox.tsx`: `can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN)`
- `Onboarding.tsx`: `can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN)`
- `ContentPlaceHolder.tsx`: `can(Actions.CREATE, Resources.ACTIVITY, Scopes.OWN)`

#### `HeaderProfileBox.tsx` — Remove Inline Role Hierarchy

**Before**:

```tsx
const getRolePriority = (role: any) => {
  const slug = role.role?.slug || '';
  if (slug === RoleSlugs.SUPER_ADMIN || slug === RoleSlugs.ORG_ADMIN) return 4;
  ...
};
const sortedRoles = [...roles].sort((a, b) => getRolePriority(b) - getRolePriority(a));
```

**After**:

```tsx
// Role.priority is returned by the API
const sortedRoles = [...roles].sort((a, b) => b.priority - a.priority);
```

#### `PermissionGuard` Consumer Sites — Add Explicit Scope

Every `<PermissionGuard>` call must now specify scope (no more implicit `ALL` default):

```tsx
// Before
<PermissionGuard action={Actions.CREATE} resource={ResourceTypes.COURSE}>

// After
<PermissionGuard action={Actions.CREATE} resource={Resources.COURSE} scope={Scopes.ORG}>
```

Apply to all consumer files:

- `dash/courses/client.tsx`
- `(withmenu)/courses/courses.tsx`
- `(withmenu)/collections/page.tsx`
- `dash/admin/users/client.tsx`
- `dash/admin/roles/client.tsx`
- `Landings/LandingClassic.tsx`
- `Landings/CreateCourseTrigger.tsx`

#### `PermissionDenied` Usages — Replace With i18n or Inline

Where `PermissionDenied` is used, replace with a simple translated message:

```tsx
const t = useTranslations('common');
// ...
<p>{t('accessDenied')}</p>
```

#### `client-layout.tsx` — Simplified Provider Tree

**Before**:

```tsx
<SessionProvider>
  <PlatformSessionProvider>
    <PermissionProvider>
      ...
```

**After**:

```tsx
<SessionProvider>
  <PermissionProvider>
    ...
```

Remove `PlatformSessionProvider` if it's only used for session data that `useSession()` already provides.

---

## 4. Implementation Plan

### Phase 1: Foundation (Backend + Types)

**Goal**: Ensure the backend returns fully-resolved permissions and the frontend types match.

| Step | Task                                                                                                                            | Files                  |
| ---- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| 1.1  | Backend: Ensure `/rbac/me/permissions` returns flat, resolved permission strings (no wildcards, no broadening needed by client) | Backend                |
| 1.2  | Backend: Ensure `GET /auth/me` (session endpoint) returns the same format                                                       | Backend                |
| 1.3  | Rewrite `types/permissions.ts` — lowercase constants, single file, `perm()` helper                                              | `types/permissions.ts` |
| 1.4  | Delete `types/generated_permissions.ts`                                                                                         | —                      |
| 1.5  | Update codegen script (if exists) to generate the new format                                                                    | `scripts/`             |
| 1.6  | Update `next-auth.d.ts` — `permissions: string[]`                                                                               | `types/next-auth.d.ts` |
| 1.7  | Update `auth.ts` session callback — store permissions as `string[]`                                                             | `auth.ts`              |

### Phase 2: Core RBAC Infrastructure

**Goal**: New provider, hook, guard, server helpers.

| Step | Task                                                                                                   | Files                                        |
| ---- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| 2.1  | Rewrite `PermissionProvider.tsx` — read from session, simple `Set.has()`                               | `components/Security/PermissionProvider.tsx` |
| 2.2  | Create `lib/server-auth.ts` — `requireAuth`, `sessionCan`, `requirePermission`, `requireAnyPermission` | `lib/server-auth.ts`                         |
| 2.3  | Rewrite `PermissionGuard.tsx` — single component, required scope                                       | `components/Security/PermissionGuard.tsx`    |
| 2.4  | Rewrite `Security/index.ts` barrel                                                                     | `components/Security/index.ts`               |
| 2.5  | Create `services/rbac.ts` — merged service                                                             | `services/rbac.ts`                           |

### Phase 3: Migrate Server Layouts

**Goal**: All server layouts use `requirePermission`/`requireAnyPermission`.

| Step | Task                                                                     | Files                                         |
| ---- | ------------------------------------------------------------------------ | --------------------------------------------- |
| 3.1  | Rewrite `dash/layout.tsx` — remove `AdminGuard`, use `requirePermission` | `app/orgs/[orgslug]/dash/layout.tsx`          |
| 3.2  | Rewrite `dash/courses/layout.tsx`                                        | `app/orgs/[orgslug]/dash/courses/layout.tsx`  |
| 3.3  | Rewrite `dash/users/layout.tsx`                                          | `app/orgs/[orgslug]/dash/users/layout.tsx`    |
| 3.4  | Rewrite `dash/payments/layout.tsx`                                       | `app/orgs/[orgslug]/dash/payments/layout.tsx` |
| 3.5  | Rewrite `dash/org/layout.tsx` — fix broken permission names              | `app/orgs/[orgslug]/dash/org/layout.tsx`      |
| 3.6  | Rewrite `dash/admin/layout.tsx`                                          | `app/orgs/[orgslug]/dash/admin/layout.tsx`    |

### Phase 4: Migrate Client Consumers

**Goal**: All components use `can()` with explicit scope. No `isAdmin` for authorization.

| Step | Task                                                                                                                                                                          | Files     |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 4.1  | Update all `PermissionGuard` usages — add explicit `scope` prop, update `resource` to new `Resources.*` names                                                                 | ~10 files |
| 4.2  | Replace `isAdmin` checks with `can()` in `discussion-reply.tsx`, `CourseUpdates.tsx`, `CourseAuthors.tsx`, `HeaderProfileBox.tsx`, `Onboarding.tsx`, `ContentPlaceHolder.tsx` | ~6 files  |
| 4.3  | Update `DashSidebar.tsx`, `DashMobileMenu.tsx` — explicit scope                                                                                                               | 2 files   |
| 4.4  | Update `CourseThumbnail.tsx` — read resource metadata directly, not through hook wrapper                                                                                      | 1 file    |
| 4.5  | Update `dash/courses/client.tsx`, role admin pages                                                                                                                            | 3 files   |
| 4.6  | Update `dash/courses/course/[courseuuid]/[subpage]/page.tsx` — explicit scope on tab checks                                                                                   | 1 file    |

### Phase 5: Delete Dead Code

**Goal**: Remove everything replaced.

| Step | Task                                                                 |
| ---- | -------------------------------------------------------------------- |
| 5.1  | Delete `PermissionMonitoring.tsx`                                    |
| 5.2  | Delete `RoleHierarchyTree.tsx`                                       |
| 5.3  | Delete `AdminGuard.tsx`                                              |
| 5.4  | Delete `PermissionDenied.tsx`                                        |
| 5.5  | Delete `PermissionTooltip.tsx`                                       |
| 5.6  | Delete `hooks/usePermissions.ts` (the extended hook)                 |
| 5.7  | Delete `services/permissions/permissions.ts`                         |
| 5.8  | Delete `services/roles/roles.ts`                                     |
| 5.9  | Delete `types/generated_permissions.ts`                              |
| 5.10 | Remove `CommonPermissions` from `types/permissions.ts`               |
| 5.11 | Remove `isInstructorOrHigher` from `types/permissions.ts`            |
| 5.12 | Clean up `LHSessionContext.tsx` — remove RBAC-related exports if any |

### Phase 6: i18n & Polish

| Step | Task                                                                               |
| ---- | ---------------------------------------------------------------------------------- |
| 6.1  | Add permission-denied messages to `en-US.json`, `kk-KZ.json`, `ru-RU.json`         |
| 6.2  | Replace any remaining hardcoded English permission labels with `useTranslations()` |
| 6.3  | Remove all `as any` casts in RBAC-related code                                     |

---

## 5. Testing Strategy

### 5.3 Checklist Before Merge

- [ ] No imports from deleted files (`PermissionMonitoring`, `AdminGuard`, `PermissionDenied`, etc.)
- [ ] No `isAdmin` used for authorization decisions (search codebase)
- [ ] No `as any` casts in RBAC code
- [ ] No `scope` parameter left as optional/defaulted in `can()` or `PermissionGuard`
- [ ] `session.permissions` is `string[]` everywhere (not `Record<string, boolean>`)
- [ ] Every `PermissionGuard` has explicit `scope` prop
- [ ] No direct role slug checks in components (no `hasRole`, no `RoleGuard`, no `role.slug === 'org-admin'`)
- [ ] Server layouts use `requirePermission`/`requireAnyPermission` exclusively
- [ ] No duplicate type definitions across files
- [ ] `PermissionMonitoring.tsx`, `RoleHierarchyTree.tsx`, `AdminGuard.tsx`, `PermissionDenied.tsx` are deleted
- [ ] All permission strings are lowercase (matching backend format)
- [ ] Zero calls to `buildPermissionName` (replaced by `perm()`)

---

## Summary: Before vs After

| Metric                                | Current                                      | Target                 |
| ------------------------------------- | -------------------------------------------- | ---------------------- |
| RBAC files                            | 15+                                          | 8                      |
| Lines of RBAC code (frontend)         | ~1,800                                       | ~400                   |
| Permission data sources               | 2 (session dict + SWR fetch)                 | 1 (session array)      |
| Permission formats                    | 2 (Record<string,bool> + string[])           | 1 (string[])           |
| `usePermissions` hooks                | 2 (same name, different returns)             | 1                      |
| `UserPermissionsResponse` definitions | 3 (different types)                          | 1 (`UserRBACData`)     |
| `isAdminRole` definitions             | 2 (duplicate)                                | 1                      |
| Dead code files                       | 3 (Monitoring, RoleHierarchyTree, AuthGuard) | 0                      |
| `as any` casts in RBAC code           | 6+                                           | 0                      |
| Hardcoded English strings             | 2 maps (29 entries)                          | 0                      |
| Wildcard/broadening logic on frontend | ~30 lines                                    | 0 (backend resolves)   |
| Default scope bugs                    | 1 critical                                   | 0 (scope is required)  |
| Server layout boilerplate             | 4 × 30 lines = 120 lines                     | 4 × 5 lines = 20 lines |
