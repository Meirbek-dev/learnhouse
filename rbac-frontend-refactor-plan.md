# Frontend RBAC Refactor Plan

## Current State Assessment

The frontend RBAC system has a solid architectural foundation — centralized permission provider, auto-generated types from backend, server-side route guards, and a clean `resource:action:scope` permission model. However, the implementation has accumulated significant problems: pervasive type safety violations, dead code, hardcoded role-slug logic that bypasses the permission system, and inconsistent patterns across components.

---

## Problems

### 1. Dead Code in PermissionProvider

**`PermissionProvider.tsx`** exports `roles` and `canAny` — neither is used anywhere in the codebase.

```tsx
// PermissionProvider.tsx:54-55 — computed, memoized, exported, never consumed
const roles = useMemo<RoleAssignment[]>(
  () => (session?.roles as RoleAssignment[] | undefined) ?? [],
  [session?.roles],
);

// PermissionProvider.tsx:61-63 — same story
const canAny = useMemo(() => {
  return (checks: { action: Action; resource: Resource; scope: Scope }[]): boolean => {
    return checks.some((c) => can(c.action, c.resource, c.scope));
  };
}, [can]);
```

Zero consumers across the entire codebase. These are computed on every render for every authenticated user, stored in context, and never read.

---

### 3. Dead Code in LHSessionContext

**`LHSessionContext.tsx`** exports five helper functions that are never called anywhere:

| Export                      | Line  | Used?                                           |
| --------------------------- | ----- | ----------------------------------------------- |
| `getUserProperty()`         | 79-87 | No                                              |
| `getTokens()`               | 89-90 | No                                              |
| `getRoles()`                | 92-93 | No                                              |
| `isAuthenticated()`         | 64-68 | No (components check `session.status` directly) |
| `useAuthenticatedSession()` | 70-77 | Minimally / not meaningfully                    |

These expand the public API surface, confuse developers reading the module, and suggest an incomplete refactoring — someone created them anticipating usage that never materialized.

---

### 4. Hardcoded Role-Slug Logic Bypassing the Permission System

Several components check role slugs directly instead of checking permissions. This defeats the entire purpose of having a permission-based system.

**HeaderProfileBox.tsx:46-68** — Role display configs keyed by slug:

```tsx
const roleConfigs: Record<string, RoleInfo> = {
  [RoleSlugs.SUPER_ADMIN]: { name: '...', icon: <Crown />, ... },
  [RoleSlugs.ORG_ADMIN]:   { name: '...', icon: <Crown />, ... },
  [RoleSlugs.MAINTAINER]:  { name: '...', icon: <Shield />, ... },
  [RoleSlugs.INSTRUCTOR]:  { name: '...', icon: <Users />, ... },
  [RoleSlugs.USER]:        { name: '...', icon: <User />, ... },
};
userRoleInfo = roleConfigs[roleSlug] || roleConfigs[RoleSlugs.USER] || null;
```

**HeaderProfileBox.tsx:74-80** — Hardcoded system-slug list to filter custom roles:

```tsx
const systemSlugs = [
  RoleSlugs.SUPER_ADMIN, RoleSlugs.ORG_ADMIN,
  RoleSlugs.MAINTAINER, RoleSlugs.INSTRUCTOR, RoleSlugs.USER,
];
return !systemSlugs.includes(slug);
```

Should use `role.is_system` field that already exists on the role object from the backend.

**OrgUsers.tsx:114-119** — Hardcoded priority map:

```tsx
const priorities: Record<string, number> = {
  [RoleSlugs.SUPER_ADMIN]: 1000,
  [RoleSlugs.ORG_ADMIN]: 900,
  [RoleSlugs.MAINTAINER]: 800,
  [RoleSlugs.INSTRUCTOR]: 700,
  [RoleSlugs.MODERATOR]: 500,
  [RoleSlugs.USER]: 100,
};
```

Should use `role.priority` field from the database. The backend already provides this.

**OrgUsers.tsx:258** — Direct slug comparison for privilege guard:

```tsx
const isTargetSuperAdmin = user.role.slug === RoleSlugs.SUPER_ADMIN;
```

**OrgRoles.tsx:132-157** — Slug-based access level descriptions and system role detection:

```tsx
if (slug === RoleSlugs.SUPER_ADMIN || slug === RoleSlugs.ORG_ADMIN) {
  return t('fullAccess');
}
// ...
const systemSlugs: string[] = [
  RoleSlugs.SUPER_ADMIN, RoleSlugs.ORG_ADMIN,
  RoleSlugs.MAINTAINER, RoleSlugs.INSTRUCTOR, RoleSlugs.USER,
];
```

Should use `role.is_system` for system detection and `role.priority` for ordering.

**Why this matters:** If an org creates a custom role called "Team Lead" with higher priority than Instructor, these hardcoded maps don't know about it. The system becomes brittle — you can't add new system roles without updating every hardcoded list.

---

### 5. Wrong Default Type in HeaderProfileBox

```tsx
// HeaderProfileBox.tsx:36
const permissions = session?.data?.permissions ?? {};
```

`permissions` is typed as `string[]` (array). Default should be `[]` (empty array), not `{}` (empty object). And this variable is declared but **never used** in the component — pure dead code with a type bug.

---

### 6. ContentPlaceHolder: Acknowledged Technical Debt

```tsx
// ContentPlaceHolder.tsx:6
// Terrible name and terrible implementation, need to be refactored asap
const ContentPlaceHolderIfUserIsNotAdmin = ({ text }: { text: string }) => {
  const isAdmin = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN);
  return <span>{isAdmin ? text : t('noContentYet')}</span>;
};
```

- Name says "IfUserIsNotAdmin" but checks `MANAGE:ORGANIZATION:OWN`
- The "admin" concept is meaningless in RBAC — it's about permissions
- The component's own author marked it for immediate refactoring

---

### 7. Redundant `new Set()` Creation in Server Auth

```tsx
// server-auth.ts:24
export function sessionCan(...): boolean {
  const perms = new Set(session.permissions);  // new Set on every call
  return perms.has(perm(resource, action, scope));
}
```

`requireAnyPermission` calls `sessionCan` in a loop (`checks.some(c => sessionCan(...))`), creating a new `Set` for every permission check. With 5 checks, that's 5 Set constructions from the same array.

---

### 8. Dashboard Access Check: `MANAGE:ORGANIZATION:OWN` Overloaded

The permission `MANAGE:ORGANIZATION:OWN` is used as a catch-all "is this a dashboard user?" check in multiple unrelated places:

| File                        | Purpose                           |
| --------------------------- | --------------------------------- |
| `HeaderProfileBox.tsx:34`   | Show "Dashboard" link in dropdown |
| `DashSidebar.tsx:99`        | Show "Organization" nav item      |
| `DashMobileMenu.tsx`        | Show "Organization" in mobile nav |
| `ContentPlaceHolder.tsx:11` | Decide placeholder text           |
| `courses/client.tsx`        | Course management context         |
| `courses.tsx (withmenu)`    | Course listing context            |

This permission means "can manage this organization" but it's being used as a proxy for "is a privileged user." These are conceptually different. A user with `COURSE:CREATE:ORG` should see the dashboard but may not have `MANAGE:ORGANIZATION:OWN`.

---

### 9. Dual Permission Systems for Resource-Level Access

The codebase uses two different approaches for resource-level permissions:

**Approach 1: RBAC `can()` checks** — used in PermissionGuard, sidebar, route guards

```tsx
const canCreate = can(Actions.CREATE, Resources.COURSE, Scopes.ORG);
```

**Approach 2: Backend-computed `can_*` booleans on API objects** — used in discussions, activities

```tsx
// From API response object
post.can_update  // boolean
post.can_delete  // boolean
post.can_moderate // boolean
post.is_owner    // boolean
```

Both are technically valid (Approach 2 handles row-level ownership checks), but there's no documentation or convention about when to use which. Some components mix both.

---

### Phase 1: Clean Dead Code

**Step 2.1: Remove unused exports from `PermissionProvider.tsx`**

Remove `roles` and `canAny` from the context value. Remove the `RoleAssignment` interface export (no consumers). Simplify to:

```tsx
interface PermissionContextValue {
  can: (action: Action, resource: Resource, scope: Scope) => boolean;
  loading: boolean;
}
```

If `canAny` is needed in the future, it can be trivially re-added.

**Step 2.2: Remove unused exports from `LHSessionContext.tsx`**

Delete: `getUserProperty()`, `getTokens()`, `getRoles()`, `isAuthenticated()`, `useAuthenticatedSession()`.

Keep only: `usePlatformSession()` (the single hook that all components use) and the context provider.

**Step 2.3: Remove dead variable in `HeaderProfileBox.tsx`**

Delete line 36:

```tsx
const permissions = session?.data?.permissions ?? {};  // unused, wrong type
```

**Files to modify:**

- `apps/web/components/Security/PermissionProvider.tsx`
- `apps/web/components/Contexts/LHSessionContext.tsx`
- `apps/web/components/Security/HeaderProfileBox.tsx`

---

### Phase 3: Replace Hardcoded Role-Slug Logic

**Step 3.1: Use `role.is_system` instead of hardcoded slug lists**

Replace all patterns like:

```tsx
const systemSlugs = [RoleSlugs.SUPER_ADMIN, RoleSlugs.ORG_ADMIN, ...];
return !systemSlugs.includes(slug);
```

With:

```tsx
return !role.is_system;
```

**Files:** `HeaderProfileBox.tsx`, `OrgRoles.tsx`

**Step 3.2: Use `role.priority` instead of hardcoded priority maps**

Replace:

```tsx
const priorities: Record<string, number> = {
  [RoleSlugs.SUPER_ADMIN]: 1000,
  [RoleSlugs.ORG_ADMIN]: 900,
  ...
};
return priorities[slug] ?? 0;
```

With:

```tsx
return role.priority;
```

**Files:** `OrgUsers.tsx`

**Step 3.3: Refactor role display in `HeaderProfileBox.tsx`**

The role display configs (`roleConfigs` map keyed by slug) need rethinking. Options:

**Option A (recommended):** Keep the slug-keyed display configs for system roles only (this is UI presentation, not access control — it's acceptable to map known system roles to specific icons/colors). But use `role.is_system` for filtering, and `role.priority` for sorting. The slug → icon/color mapping is a view concern, not a security concern.

**Option B:** Have the backend include display metadata (icon, color) on role objects. This is cleaner but requires backend changes.

Go with **Option A** — the slug-to-display mapping is view logic and doesn't bypass security. The important thing is that no *authorization decisions* use slug comparisons.

**Step 3.4: Fix `OrgUsers.tsx` super-admin check**

Replace:

```tsx
const isTargetSuperAdmin = user.role.slug === RoleSlugs.SUPER_ADMIN;
```

With a priority-based check:

```tsx
const isTargetHigherOrEqual = user.role.priority >= currentUserHighestPriority;
```

The business logic is "can't manage users with equal or higher privilege" — express that directly.

**Files to modify:**

- `apps/web/components/Security/HeaderProfileBox.tsx`
- `apps/web/components/Dashboard/Pages/Users/OrgUsers/OrgUsers.tsx`
- `apps/web/components/Dashboard/Pages/Users/OrgRoles/OrgRoles.tsx`

---

### Phase 4: Fix ContentPlaceHolder

**Step 4.1: Rename and simplify**

Rename `ContentPlaceHolderIfUserIsNotAdmin` to `PermissionText` or `ProtectedText`:

```tsx
interface ProtectedTextProps {
  text: string;
  action: Action;
  resource: Resource;
  scope: Scope;
  fallback?: string;
}

const ProtectedText = ({ text, action, resource, scope, fallback }: ProtectedTextProps) => {
  const { can } = usePermissions();
  const t = useTranslations('General');
  return <span>{can(action, resource, scope) ? text : (fallback ?? t('noContentYet'))}</span>;
};
```

This makes the component reusable with any permission, not just the hardcoded admin check.

**Step 4.2: Update all call sites**

Find all consumers and update to pass explicit permission props.

**Files to modify:**

- `apps/web/components/Objects/ContentPlaceHolder.tsx`
- All files importing `ContentPlaceHolderIfUserIsNotAdmin`

---

### Phase 5: Fix Server-Side Auth Performance

**Step 5.1: Create Set once in `requireAnyPermission`**

```tsx
export async function requireAnyPermission(
  orgslug: string,
  checks: { action: Action; resource: Resource; scope: Scope }[],
  redirectTo?: string,
) {
  const session = await requireAuth(orgslug);
  const perms = new Set(session.permissions);
  const hasAny = checks.some(c => perms.has(perm(c.resource, c.action, c.scope)));
  if (!hasAny) {
    redirect(redirectTo ?? `/orgs/${orgslug}/unauthorized`);
  }
  return session;
}
```

Also update `sessionCan` to accept an optional pre-built Set, or refactor so the Set is built once and passed through.

**Files to modify:**

- `apps/web/lib/server-auth.ts`

---

### Phase 6: Define Dashboard Access Permission

**Step 6.1: Stop overloading `MANAGE:ORGANIZATION:OWN`**

Create a clear convention for "can access the dashboard." Options:

**Option A (recommended):** Use the server-side layout guards as the single source of truth for dashboard section access. Each section already has its own `requireAnyPermission` in its layout. The sidebar should mirror these same checks:

```tsx
// DashSidebar.tsx
const canSeeOrg = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN)
                || can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.OWN);
const canSeeCourses = can(Actions.CREATE, Resources.COURSE, Scopes.ORG)
                   || can(Actions.UPDATE, Resources.COURSE, Scopes.ORG);
const canSeeUsers = can(Actions.INVITE, Resources.USER, Scopes.ORG)
                 || can(Actions.UPDATE, Resources.USER, Scopes.ORG);
```

This aligns the sidebar visibility with the actual route guards, eliminating the proxy pattern.

**Option B:** Add a dedicated `DASHBOARD:READ:ORG` permission on the backend. Cleaner but requires migration.

Go with **Option A** first — align sidebar checks with layout guards. No backend changes needed.

**Step 6.2: Fix `HeaderProfileBox.tsx` dashboard link visibility**

The "Dashboard" link in the profile dropdown should show when user has *any* dashboard-level permission, not just `MANAGE:ORGANIZATION:OWN`. Use `canAny` or a multi-check:

```tsx
const canAccessDashboard = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN)
  || can(Actions.CREATE, Resources.COURSE, Scopes.ORG)
  || can(Actions.UPDATE, Resources.COURSE, Scopes.ORG)
  || can(Actions.INVITE, Resources.USER, Scopes.ORG);
```

**Files to modify:**

- `apps/web/components/Dashboard/Menus/DashSidebar.tsx`
- `apps/web/components/Dashboard/Menus/DashMobileMenu.tsx`
- `apps/web/components/Security/HeaderProfileBox.tsx`

---

### Phase 7: Document the Dual Permission Pattern

**Step 7.1: Add a code comment in PermissionProvider explaining when to use what**

```tsx
/**
 * Two permission-checking patterns exist:
 *
 * 1. RBAC `can()` — for UI gating: "can this user create courses in this org?"
 *    Used in: PermissionGuard, sidebar, route layouts
 *
 * 2. Backend `can_*` booleans on API objects — for row-level access:
 *    "can this user edit THIS specific post?"
 *    Used in: discussion posts, activity elements
 *
 * Use (1) for feature/section access. Use (2) for individual resource actions
 * where ownership or assignment matters.
 */
```

This is documentation, not code — but it prevents the next developer from creating a third pattern.

---

### Phase 9: Cleanup Session Error Handling

**Step 9.1: Always return `permissions: []` on session fetch failure**

In `auth.ts`, the error fallback returns roles but not permissions:

```tsx
// Current (auth.ts, session callback error path)
return {
  ...session,
  user: { ... },
  roles: [],
  tokens: tokens,
  // permissions is MISSING — becomes undefined
};
```

Fix:

```tsx
return {
  ...session,
  user: { ... },
  roles: [],
  tokens: tokens,
  permissions: [],  // explicitly empty, not undefined
};
```

This ensures `PermissionProvider` always receives an array, never `undefined`.

**Files to modify:**

- `apps/web/auth.ts`

---

## Execution Order

| Phase | Description                  | Risk   | Scope       |
| ----- | ---------------------------- | ------ | ----------- |
| 2     | Remove dead code             | Low    | 3 files     |
| 3     | Replace hardcoded slug logic | Low    | 3 files     |
| 4     | Fix ContentPlaceHolder       | Low    | 2-3 files   |
| 5     | Fix server-auth performance  | Low    | 1 file      |
| 6     | Define dashboard access      | Medium | 3 files     |
| 7     | Document dual pattern        | Low    | 1 file      |
| 8     | Add tests                    | Low    | 3 new files |
| 9     | Fix session error handling   | Low    | 1 file      |
