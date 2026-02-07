# Frontend RBAC Refactor Plan

> **Status:** Draft
> **Date:** 2026-02-07
> **Scope:** `apps/web` — all client-side and server-side permission code
> **Goal:** Clean, production-ready RBAC with zero legacy, zero fallback, zero dead code

---

## 1. Current State Assessment

### What exists today

| Layer                | File(s)                                      | Purpose                                                                                                       |
| -------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Types**            | `types/permissions.ts`                       | `Actions`, `Resources`, `Scopes`, `RoleSlugs` constants; `perm()` helper; deprecated `buildPermissionName()`  |
| **Auth types**       | `types/next-auth.d.ts`                       | Session augmentation with `permissions: string[]`, `roles: UserRoleWithOrg[]`, unused `permissions_timestamp` |
| **Provider**         | `components/Security/PermissionProvider.tsx` | `usePermissions()` hook, `can()` / `canAny()` / `isAdmin` / `roles` / `loading`                               |
| **Guard**            | `components/Security/PermissionGuard.tsx`    | Declarative `<PermissionGuard action resource scope>` wrapper                                                 |
| **Barrel**           | `components/Security/index.ts`               | Re-exports everything                                                                                         |
| **Server guards**    | `lib/server-auth.ts`                         | `requireAuth()`, `sessionCan()`, `requirePermission()`, `requireAnyPermission()`                              |
| **Auth flow**        | `auth.ts`                                    | NextAuth config: JWT & session callbacks, 1-min server cache, session → permissions piping                    |
| **Service (dead)**   | `services/rbac.ts`                           | `fetchMyPermissions`, role CRUD, assign/revoke — **zero imports anywhere**                                    |
| **Service (old)**    | `services/roles/roles.ts`                    | Server Action role CRUD — used only by old modal components (`AddRole`, `EditRole`, `OrgRoles`)               |
| **Service (legacy)** | `services/organizations/orgs.ts`             | `updateUserRole()` — used only by `RolesUpdate.tsx` modal                                                     |
| **Empty dir**        | `services/permissions/`                      | Empty directory, no files                                                                                     |
| **Header**           | `components/Security/HeaderProfileBox.tsx`   | Role badge display, accesses `session.roles` directly with `as any`                                           |
| **Session context**  | `components/Contexts/LHSessionContext.tsx`   | Types `roles` as `string[]` — doesn't match actual `UserRoleWithOrg[]` shape                                  |

### Architecture (as-is)

```
Backend /users/session → { user, roles: UserRoleWithOrg[], permissions: string[] }
                              ↓
                    auth.ts session callback (1-min cache)
                              ↓
                    NextAuth Session { permissions, roles }
                              ↓
          ┌─────────────────────────────────────────┐
          │                                         │
  Server Components                        Client Components
  lib/server-auth.ts                       PermissionProvider
  requirePermission()                      usePermissions() → can()
  requireAnyPermission()                   <PermissionGuard>
  sessionCan()
```

---

## 2. Problems Identified

### P1 — Dead code: `services/rbac.ts` (entire file)

`fetchMyPermissions`, `listRoles`, `getRole`, `createRole`, `updateRole`, `deleteRole`, `assignRole`, `revokeRole` — **all exported, none imported**. This was written as a planned replacement but never wired in. Both admin pages (`roles/client.tsx`, `users/client.tsx`) use raw inline `fetch()` calls instead.

### P2 — Three separate role CRUD implementations

| Implementation     | Location                                              | Used by                                                   |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------- |
| **Inline fetch**   | `dash/admin/roles/client.tsx` (9 fetch calls)         | Roles admin page                                          |
| **Inline fetch**   | `dash/admin/users/client.tsx` (6 fetch calls)         | Users admin page                                          |
| **Server Actions** | `services/roles/roles.ts`                             | Old modals: `AddRole.tsx`, `EditRole.tsx`, `OrgRoles.tsx` |
| **Dead code**      | `services/rbac.ts`                                    | Nothing                                                   |
| **Legacy**         | `services/organizations/orgs.ts` → `updateUserRole()` | `RolesUpdate.tsx` modal                                   |

Five different ways to talk to role/user endpoints. None consolidated.

### P3 — Inconsistent API endpoint patterns

The inline fetch calls use conflicting URL patterns:

| File                             | Pattern                                                           |
| -------------------------------- | ----------------------------------------------------------------- |
| `roles/client.tsx`               | `${getAPIUrl()}roles?org_id=X`                                    |
| `users/client.tsx`               | `${getAPIUrl()}/api/v1/orgs/${id}/users/roles`                    |
| `users/client.tsx`               | `${getAPIUrl()}/api/v1/users/${id}/roles`                         |
| `services/rbac.ts`               | `${getAPIUrl()}rbac/roles/assign`                                 |
| `services/organizations/orgs.ts` | `${getAPIUrl()}orgs/${org_id}/users/${user_id}/role/${role_uuid}` |

Some include `/api/v1/` prefix, some don't. Some use query params for org_id, others use path segments. This needs to be one set of endpoints through one service.

### P4 — Overly restrictive parent layout kills granular checks

`app/orgs/[orgslug]/dash/layout.tsx` requires:

```ts
requirePermission(orgslug, Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN)
```

This means **only org admins** can reach _any_ dashboard page. The granular child layout checks in `courses/layout.tsx`, `admin/layout.tsx`, `users/layout.tsx`, `payments/layout.tsx` are unreachable for non-admin roles — they become dead code because the parent already gated on the highest privilege.

An **instructor** with `course:create:org` permission will get a 302 redirect at the dashboard gate before ever reaching the courses section. This defeats the entire purpose of granular RBAC.

### P5 — Dual "admin" detection mechanisms

| Where                    | How it detects "admin"                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| `PermissionProvider.tsx` | `roles.some(r => isAdminRole(r.slug))` — **slug-based** check against `super-admin` / `org-admin` |
| All other components     | `can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN)` — **permission-based**                  |

Two different definitions of "admin" that may not agree. `isAdmin` on the context is unused by current consumers but is part of the public API and invites future misuse.

### P6 — 30+ `as any` casts on session/org contexts

`usePlatformSession() as any` and `useOrg() as any` appear in 30+ components. This hides:

- The `roles` type mismatch (`string[]` in `LHSessionContext` vs `UserRoleWithOrg[]` in actual session)
- Potential null/undefined access bugs
- Makes TypeScript completely blind to RBAC data shapes

### P7 — Misleading variable names

| Component                | Variable      | Actual check                     |
| ------------------------ | ------------- | -------------------------------- |
| `CourseUpdates.tsx`      | `isAdmin`     | `can(UPDATE, COURSE, OWN)`       |
| `CourseAuthors.tsx`      | `isAdmin`     | `can(MANAGE, COURSE, OWN)`       |
| `discussion-reply.tsx`   | `isAdmin`     | `can(MODERATE, DISCUSSION, ORG)` |
| `ContentPlaceHolder.tsx` | `isUserAdmin` | `can(MANAGE, ORGANIZATION, OWN)` |

None of these check for "admin" — they check specific resource permissions. The naming obscures intent and makes code review unreliable.

### P8 — `LHSessionContext` types `roles` incorrectly

`ExtendedSessionData.roles` is typed as `string[] | undefined`. The actual runtime value from `auth.ts` session callback is `UserRoleWithOrg[]` (objects with `role` and `org` sub-objects). This forces `as any` everywhere.

### P9 — No cache invalidation for permission changes

When an admin changes another user's role:

1. Server session cache: 1-minute TTL — stale for up to 60 seconds
2. Client `SessionProvider`: `refetchInterval` of 5 minutes — stale for up to 5 minutes
3. No mechanism to push-invalidate a specific user's cached session
4. `permissions_timestamp` is defined in types but **never set or read** anywhere

### P10 — `ContentPlaceHolderIfUserIsNotAdmin`

Self-described as _"Terrible name and terrible implementation, need to be refactored asap"_. Uses `MANAGE ORGANIZATION` to decide whether to show placeholder text — semantically a content-visibility concern abusing an org-management permission.

### P11 — Empty `services/permissions/` directory

Directory exists with no files. Confusing artifact.

### P12 — Deprecated `buildPermissionName()` still exported

Marked `@deprecated`, zero consumers, but still exported from `types/permissions.ts`.

### P13 — `services/roles/roles.ts` duplicates patterns

Uses the old `RequestBodyWithAuthHeader` utility + `getResponseMetadata` wrapper pattern, while `services/rbac.ts` uses a clean `request<T>()` generic helper. The admin pages use neither — they do raw `fetch()`. Three different fetch/error-handling patterns.

### P14 — Role metadata not accessible through `usePermissions()`

`HeaderProfileBox.tsx` needs role name, slug, priority, and org association to render role badges. `usePermissions()` only exposes `roles: Role[]` with `{ id, name, slug, description, org_id, is_system, priority }`, but the actual session has `UserRoleWithOrg[]` with `{ role: Role, org: { id, slug, name } }`. The component bypasses the hook and reads `session.data.roles` directly because the hook loses the org context.

### P15 — No tests

`components/Security/__tests__/` directory exists but is empty.

---

## 3. Target Architecture

```
shared/permissions.yaml        (source of truth — actions, resources, scopes, roles)
        │
        ├──→ Backend (resolves wildcards → flat permission strings)
        │
        └──→ apps/web/types/permissions.ts (typed constants — auto-generated or manually synced)

auth.ts session callback
    └──→ session.permissions: string[]    (flat, pre-resolved by backend)
    └──→ session.roles: RoleAssignment[]  (role + org context)

Server (RSC / layouts / server actions):
    lib/server-auth.ts
        ├── requireAuth(orgslug)
        ├── requirePermission(orgslug, action, resource, scope)
        └── requireAnyPermission(orgslug, checks[])

Client (components / hooks):
    components/Security/PermissionProvider.tsx
        ├── can(action, resource, scope) → boolean
        ├── canAny(checks[]) → boolean
        ├── roles: RoleAssignment[]
        └── loading: boolean

    components/Security/PermissionGuard.tsx
        └── <PermissionGuard action resource scope>{children}</PermissionGuard>

API calls:
    services/rbac.ts   ← single service file for all role + permission API calls
```

### Design principles

1. **Permission-based only** — every UI gate uses `can(action, resource, scope)`. No slug checks, no `isAdmin` shortcut.
2. **Single service layer** — one file (`services/rbac.ts`) for all RBAC API calls. No inline fetch. No duplicate services.
3. **Type-safe throughout** — no `as any` on session/org. Fix `LHSessionContext` types to match actual data.
4. **Accurate layout gating** — parent `dash/layout.tsx` uses a broad OR check that lets multiple roles through. Child layouts add specificity.
5. **Clean variable naming** — `canUpdateCourse`, `canManageCourse`, `canModerateDiscussions`. Never `isAdmin`.
6. **Zero dead code** — no deprecated exports, no empty directories, no unused services.

---

## 4. Implementation Plan

### Phase 1 — Delete dead code and empty artifacts

**Files to delete:**

- [ ] `services/permissions/` — empty directory
- [ ] `services/organizations/orgs.ts` → remove `updateUserRole()` function (keep other exports if any; otherwise remove from this file)

**Code to remove:**

- [ ] `types/permissions.ts` → delete `buildPermissionName()` function and its `@deprecated` JSDoc
- [ ] `types/next-auth.d.ts` → remove `permissions_timestamp` from `Session`, `SessionData`, and `JWT` interfaces
- [ ] `PermissionProvider.tsx` → remove `isAdmin` from context value, `isAdminRole` import, and `isAdmin` memo
- [ ] `types/permissions.ts` → remove `isAdminRole()` function

**Estimated files touched:** 4
**Risk:** Low — removing unused exports/functions

---

### Phase 2 — Fix `LHSessionContext` type definitions

**Problem:** `ExtendedSessionData.roles` typed as `string[]` but actual data is `UserRoleWithOrg[]`.

**Changes:**

- [ ] `components/Contexts/LHSessionContext.tsx`:
  - Import `UserRoleWithOrg` from `types/next-auth` (or define it centrally)
  - Change `roles: string[] | undefined` → `roles: UserRoleWithOrg[] | undefined`
  - Remove `[key: string]: any` index signatures from `ExtendedSessionData` and nested `user`
  - Update `getRoles()` return type

**Result:** All `as any` casts on `usePlatformSession()` become type errors — which leads to Phase 3.

**Estimated files touched:** 1
**Risk:** Medium — will surface type errors in 30+ files that need fixing in Phase 3

---

### Phase 3 — Remove all `as any` casts on session/org

After Phase 2 makes types correct, systematically remove `as any` from every component:

**Files to fix (30+ occurrences):**

- [ ] `components/Security/HeaderProfileBox.tsx`
- [ ] `hooks/useContributorStatus.ts`
- [ ] `components/Utils/LocaleSwitcher.tsx`
- [ ] `components/Objects/UserAvatar.tsx`
- [ ] `components/Objects/UserProfilePopup.tsx`
- [ ] `components/Objects/Modals/Dash/OrgUsers/RolesUpdate.tsx`
- [ ] `components/Objects/Thumbnails/CourseThumbnail.tsx`
- [ ] `components/Objects/Thumbnails/CollectionThumbnail.tsx`
- [ ] `components/Pages/Trail/TrailCourseElement.tsx`
- [ ] `components/Pages/CourseEdit/Draggables/Chapter.tsx`
- [ ] `components/Pages/CourseEdit/Draggables/Activity.tsx`
- [ ] `components/Dashboard/Menus/DashSidebar.tsx`
- [ ] `components/Dashboard/Menus/DashMobileMenu.tsx`
- [ ] All `dash/` page components that cast `useOrg() as any`

**Pattern:** Replace `usePlatformSession() as any` → `usePlatformSession()` and fix any property access chains that TypeScript flags.

**Estimated files touched:** 30+
**Risk:** Medium — mechanical but many files

---

### Phase 4 — Consolidate role/permission API service

**Delete:**

- [ ] `services/roles/roles.ts` — entire file (old Server Action CRUD)
- [ ] Remove role CRUD from `services/organizations/orgs.ts` (`updateUserRole`)

**Rewrite `services/rbac.ts`** as the single RBAC service:

```ts
// services/rbac.ts
'use server';

// ── Role CRUD ──
export async function listRoles(orgId: number, token: string): Promise<Role[]>
export async function getRole(roleId: number, token: string): Promise<RoleWithPermissions>
export async function createRole(orgId: number, body: CreateRoleBody, token: string): Promise<Role>
export async function updateRole(roleId: number, body: UpdateRoleBody, token: string): Promise<Role>
export async function deleteRole(roleId: number, token: string): Promise<void>

// ── Role Assignment ──
export async function listUserRoles(orgId: number, token: string): Promise<UserRoleAssignment[]>
export async function assignRole(userId: number, roleId: number, orgId: number, token: string): Promise<void>
export async function revokeRole(userId: number, roleId: number, orgId: number, token: string): Promise<void>

// ── Permissions Catalog ──
export async function listAllPermissions(token: string): Promise<Permission[]>
export async function getRolePermissions(roleId: number, token: string): Promise<Permission[]>
export async function setRolePermission(roleId: number, permissionId: number, enabled: boolean, token: string): Promise<void>
```

**Confirm with backend team** which endpoints are canonical. Settle on one URL pattern before implementing.

**Estimated files touched:** 3 (delete 2, rewrite 1)
**Risk:** Medium — must coordinate with backend for correct endpoints

---

### Phase 5 — Rewrite admin pages to use service layer

**`app/orgs/[orgslug]/dash/admin/roles/client.tsx`:**

- [ ] Remove all 9 inline `fetch()` calls
- [ ] Remove local `Role`, `Permission`, `RoleWithPermissions` interfaces (use types from `types/permissions.ts`)
- [ ] Import and use functions from `services/rbac.ts`
- [ ] Move data fetching to SWR or React Query with proper cache keys

**`app/orgs/[orgslug]/dash/admin/users/client.tsx`:**

- [ ] Remove all 6 inline `fetch()` calls
- [ ] Remove local `UserBasic`, `Role`, `UserRoleAssignment` interfaces (centralize in types)
- [ ] Import and use functions from `services/rbac.ts`
- [ ] Fix inconsistent URL patterns (`/api/v1/` vs bare path)
- [ ] Remove hardcoded `?limit=100` — use pagination

**`components/Objects/Modals/Dash/OrgUsers/RolesUpdate.tsx`:**

- [ ] Replace `updateUserRole` from `services/organizations/orgs.ts` with `assignRole`/`revokeRole` from `services/rbac.ts`
- [ ] Remove `as any` casts

**`components/Objects/Modals/Dash/OrgRoles/AddRole.tsx` and `EditRole.tsx`:**

- [ ] Replace imports from `services/roles/roles.ts` with `services/rbac.ts`

**Estimated files touched:** 5
**Risk:** High — these are core admin UI pages, need thorough testing

---

### Phase 6 — Fix dashboard layout gating

**Problem:** `dash/layout.tsx` requires `MANAGE ORGANIZATION OWN`, blocking all non-admin roles from the entire dashboard.

**Solution:** Replace with a broad OR check that lets any "dashboard-worthy" role through:

```ts
// dash/layout.tsx
await requireAnyPermission(orgslug, [
  { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
  { action: Actions.CREATE, resource: Resources.COURSE, scope: Scopes.ORG },
  { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.ORG },
  { action: Actions.UPDATE, resource: Resources.COURSE, scope: Scopes.OWN },
  { action: Actions.READ,   resource: Resources.ANALYTICS, scope: Scopes.OWN },
  { action: Actions.MODERATE, resource: Resources.DISCUSSION, scope: Scopes.ORG },
  { action: Actions.INVITE, resource: Resources.USER, scope: Scopes.ORG },
]);
```

This lets instructors, maintainers, and moderators access the dashboard. Child layouts then refine access for their specific section.

**Alternatively**, add a `dashboard:access:org` permission in the backend for a cleaner single check, or a new approach: the parent layout only checks authentication (via `requireAuth`), and each child layout handles its own permission gate. This is simplest and most correct.

**Recommended approach:**

```ts
// dash/layout.tsx — only require authentication, not a specific permission
const session = await requireAuth(orgslug);
```

Each child layout already has its own `requireAnyPermission()` call. Let those be the actual gates.

**Estimated files touched:** 1
**Risk:** High — changes who can access the dashboard. Requires testing all role types.

---

### Phase 7 — Fix variable naming

Search-and-replace misleading `isAdmin` / `isUserAdmin` variables:

| File                                              | Old           | New                     |
| ------------------------------------------------- | ------------- | ----------------------- |
| `dash/courses/client.tsx`                         | `isUserAdmin` | `canManageOrg`          |
| `(withmenu)/courses/courses.tsx`                  | `isUserAdmin` | `canManageOrg`          |
| `Objects/Onboarding/Onboarding.tsx`               | `isUserAdmin` | `canManageOrg`          |
| `Objects/ContentPlaceHolder.tsx`                  | `isUserAdmin` | `canManageOrg`          |
| `Objects/Courses/CourseUpdates/CourseUpdates.tsx` | `isAdmin`     | `canUpdateCourse`       |
| `Objects/Courses/CourseAuthors/CourseAuthors.tsx` | `isAdmin`     | `canManageCourse`       |
| `discussions/discussion-reply.tsx`                | `isAdmin`     | `canModerateDiscussion` |

**Estimated files touched:** 7
**Risk:** Low — rename only, no logic change

---

### Phase 8 — Kill `ContentPlaceHolderIfUserIsNotAdmin`

**Delete** `components/Objects/ContentPlaceHolder.tsx`.

**Replace** usages in `components/Landings/LandingClassic.tsx` with inline `PermissionGuard`:

```tsx
<PermissionGuard
  action={Actions.CREATE}
  resource={Resources.COURSE}
  scope={Scopes.ORG}
  fallback={<p>{t('Courses.noContentUser')}</p>}
>
  <p>{t('Courses.noContentUserAdmin')}</p>
</PermissionGuard>
```

The permission check should match the **actual action** (creating a course / collection), not `MANAGE ORGANIZATION`.

**Estimated files touched:** 2 (delete 1, edit 1)
**Risk:** Low

---

### Phase 9 — Make `PermissionProvider` expose role context properly

**Problem:** `HeaderProfileBox.tsx` bypasses `usePermissions()` to get `session.data.roles` directly because the hook doesn't expose org-associated role metadata.

**Solution:** Change the `roles` type in `PermissionProvider` from `Role[]` to `RoleAssignment[]`:

```ts
interface RoleAssignment {
  role: Role;
  org: { id: number; slug: string; name: string };
}

interface PermissionContextValue {
  can: (action: Action, resource: Resource, scope: Scope) => boolean;
  canAny: (checks: Array<{ action: Action; resource: Resource; scope: Scope }>) => boolean;
  roles: RoleAssignment[];
  loading: boolean;
}
```

Then `HeaderProfileBox.tsx` reads `roles` from `usePermissions()` instead of bypassing it via `session.data.roles as any`.

**Estimated files touched:** 3 (`PermissionProvider.tsx`, `HeaderProfileBox.tsx`, `index.ts` types)
**Risk:** Low-Medium

---

### Phase 10 — Centralize RBAC-related types

**Create** `types/rbac.ts` or extend `types/permissions.ts` with all RBAC types currently scattered or duplicated:

```ts
// types/permissions.ts — additions

export interface Permission {
  id: number;
  name: string;
  resource_type: Resource;
  action: Action;
  scope: Scope;
  description: string | null;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}

export interface RoleAssignment {
  role: Role;
  org: {
    id: number;
    org_uuid: string;
    name: string;
    slug: string;
  };
}

export interface UserRoleAssignment {
  user_id: number;
  role_id: number;
  org_id: number;
  granted_at: string;
  granted_by: number | null;
  expires_at: string | null;
  user?: UserBasic;
  role?: Role;
}

export interface CreateRoleBody {
  name: string;
  description?: string;
  org_id: number;
}

export type UpdateRoleBody = Partial<Omit<CreateRoleBody, 'org_id'>>;
```

**Delete** local interface duplicates from:

- `dash/admin/roles/client.tsx` (local `Role`, `Permission`, `RoleWithPermissions`)
- `dash/admin/users/client.tsx` (local `UserBasic`, `Role`, `UserRoleAssignment`)
- `services/roles/roles.ts` (local `CreateOrUpdateRoleBody`)

**Estimated files touched:** 4
**Risk:** Low

---

### Phase 11 — Add permission cache invalidation

**Problem:** After admin changes a user's role, that user sees stale permissions for up to 5 minutes.

**Solution (server-side):**

- [ ] Remove `permissions_timestamp` field (unused, adds confusion)
- [ ] After role mutation in `services/rbac.ts`, call `revalidateTag('session')` to bust Next.js cache
- [ ] Reduce `SessionProvider.refetchInterval` from 5 minutes to 60 seconds

**Solution (client-side):**

- [ ] After admin assigns/revokes a role via `services/rbac.ts`, trigger a `session.update()` call via NextAuth's `useSession().update()` to force re-fetch

**Solution (cross-user — future):**

- Consider server-sent events or a `permissions_version` counter the client polls to detect when its permissions have changed. Out of scope for this refactor but worth tracking.

**Estimated files touched:** 3
**Risk:** Medium

---

### Phase 12 — Write tests

Populate `components/Security/__tests__/` with:

- [ ] `PermissionProvider.test.tsx` — test `can()`, `canAny()`, loading states, missing session
- [ ] `PermissionGuard.test.tsx` — test render/no-render/fallback based on permissions
- [ ] `server-auth.test.ts` — test `sessionCan()`, `requirePermission()`, `requireAnyPermission()` redirect behavior

Use `@testing-library/react` + `vitest`. Mock `useSession` from `next-auth/react`.

**Estimated files created:** 3
**Risk:** Low — pure additions

---

## 5. Phase Execution Order & Dependencies

```
Phase 1 (delete dead code)
    │
    ├──→ Phase 2 (fix LHSessionContext types)
    │        │
    │        └──→ Phase 3 (remove as any casts) ──→ Phase 9 (expose role context)
    │
    ├──→ Phase 4 (consolidate service) ──→ Phase 5 (rewrite admin pages)
    │
    ├──→ Phase 6 (fix layout gating) — independent
    │
    ├──→ Phase 7 (fix variable names) — independent
    │
    ├──→ Phase 8 (kill ContentPlaceHolder) — independent
    │
    └──→ Phase 10 (centralize types) — after Phase 4

Phase 11 (cache invalidation) — after Phase 5
Phase 12 (tests) — after all other phases
```

**Parallelizable:** Phases 6, 7, 8 can run in parallel with any other phase.
**Critical path:** Phase 2 → Phase 3 → Phase 9 (type fixes cascade).
**Highest risk:** Phase 5 (admin page rewrites) and Phase 6 (layout gating).

---

## 6. Files to Delete (Summary)

| Path                                        | Reason                                                        |
| ------------------------------------------- | ------------------------------------------------------------- |
| `services/permissions/`                     | Empty directory                                               |
| `services/roles/roles.ts`                   | Replaced by consolidated `services/rbac.ts`                   |
| `components/Objects/ContentPlaceHolder.tsx` | Self-described terrible; replaced by inline `PermissionGuard` |
| `components/Security/__tests__/` (empty)    | Recreated with actual tests                                   |

## 7. Files to Rewrite (Summary)

| Path                                             | Scope                                                    |
| ------------------------------------------------ | -------------------------------------------------------- |
| `services/rbac.ts`                               | Full rewrite as Server Actions; single RBAC service      |
| `app/orgs/[orgslug]/dash/admin/roles/client.tsx` | Remove inline fetch; use service layer                   |
| `app/orgs/[orgslug]/dash/admin/users/client.tsx` | Remove inline fetch; use service layer                   |
| `app/orgs/[orgslug]/dash/layout.tsx`             | Change gate from `requirePermission` to `requireAuth`    |
| `components/Security/PermissionProvider.tsx`     | Remove `isAdmin`; fix `roles` type to `RoleAssignment[]` |
| `components/Contexts/LHSessionContext.tsx`       | Fix `roles` type; remove `[key: string]: any`            |
| `types/permissions.ts`                           | Remove deprecated code; add shared RBAC types            |
| `types/next-auth.d.ts`                           | Remove `permissions_timestamp`                           |

## 8. Definition of Done

- [ ] `pnpm typecheck` passes with zero errors
- [ ] No `as any` on `usePlatformSession()` or `useOrg()` anywhere in the codebase
- [ ] No `isAdmin` / `isUserAdmin` variable names derived from permission checks
- [ ] `grep -r "buildPermissionName\|isAdminRole\|permissions_timestamp" apps/web` returns zero results
- [ ] `services/permissions/`, `services/roles/` directories do not exist
- [ ] `ContentPlaceHolderIfUserIsNotAdmin` does not exist
- [ ] `services/rbac.ts` is the only file making RBAC API calls
- [ ] Zero inline `fetch(getAPIUrl()...)` in admin pages
- [ ] An instructor role can access `dash/courses/` without having `MANAGE ORGANIZATION` permission
- [ ] All Security tests pass
- [ ] Role assignment changes propagate to the affected user's session within 60 seconds
