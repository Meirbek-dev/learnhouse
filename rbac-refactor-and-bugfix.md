# RBAC Refactor - Bug Analysis & Fix Plan

## Executive Summary

After the RBAC refactor, the **org-admin** role lost access to most dashboard features. The root cause is a **scope mismatch**: the backend grants org-admin permissions with `:org` scope, but the frontend checks for `:own` scope using exact string matching. Additionally, several backend bugs (wrong permission strings, missing permissions, optional `org_id`) compound the problem.

**13 bugs identified across 20+ files. 3 are critical, 6 are high severity, 4 are medium.**

---

## Root Cause

### How the permission system works

1. **Backend** stores 3-part permissions: `resource:action:scope` (e.g. `course:update:org`)
2. **Backend `get_expanded_permissions()`** expands wildcards (`*`) for the frontend, e.g. `course:*:org` becomes `course:create:org`, `course:update:org`, etc.
3. **Frontend `can()` function** does **exact** `Set.has()` lookups: `can(Actions.UPDATE, Resources.COURSE, Scopes.OWN)` checks for the string `"course:update:own"`

### The problem

The `get_expanded_permissions()` method expands wildcard `*` patterns but does **NOT** expand the scope hierarchy. In the backend's own `_resolve()` method, `:org` scope implies `:own` (if you can manage all resources in an org, you can manage your own). But the frontend doesn't know this -- it only does exact matching.

**Result**: org-admin has `organization:manage:org` but the frontend checks for `organization:manage:own` → **not found** → feature hidden.

---

## Bug Inventory

### BUG #1 [CRITICAL] - `get_expanded_permissions()` doesn't expand scope hierarchy

**File**: `apps/api/src/security/rbac.py` — `get_expanded_permissions()` method (line ~175)

**Problem**: Wildcards are expanded but scope hierarchy is not. The scope hierarchy is:

- `all` > `org` > `own` (broadest to narrowest for ownership)
- `all` > `assigned` (separate track, but `all` and `org` imply `assigned`)

A user with `course:update:org` should also have `course:update:own` in their expanded set (because org-wide access implies self-access). Currently it does not.

**Impact**: This is the **root cause** of nearly all frontend visibility bugs for org-admin. Fixing this single bug resolves bugs #2, #3, #5, #6, #10, #11, #12, and #13.

**Fix**: After expanding wildcards, also add implied narrower scopes:

```python
# After the existing expansion loop, add scope hierarchy expansion:
SCOPE_IMPLIES: dict[str, list[str]] = {
    "all": ["org", "assigned", "own"],
    "org": ["own"],
}

hierarchy_expanded: set[str] = set()
for perm_str in expanded:
    hierarchy_expanded.add(perm_str)
    parts = perm_str.split(":")
    if len(parts) == 3:
        res, act, scp = parts
        for implied_scope in SCOPE_IMPLIES.get(scp, []):
            hierarchy_expanded.add(f"{res}:{act}:{implied_scope}")

return hierarchy_expanded
```

---

### BUG #2 [CRITICAL] - Org settings page blocks org-admin (server-side redirect)

**File**: `apps/web/app/orgs/[orgslug]/dash/org/layout.tsx`

**Code**:

```typescript
await requireAnyPermission(orgslug, [
    { action: Actions.READ, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
]);
```

**Problem**: Both checks use `Scopes.OWN`. Org-admin has `organization:read:org` and `organization:update:org` but **not** `:own`. This server-side guard **redirects org-admin to /unauthorized** before any page renders.

**Fix** (defense-in-depth, also fix even though Bug #1 fix would resolve):

```typescript
await requireAnyPermission(orgslug, [
    { action: Actions.READ, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.READ, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
]);
```

---

### BUG #3 [CRITICAL] - Dashboard sidebar hides Org settings, Courses, Users for org-admin

**Files**:

- `apps/web/components/Dashboard/Menus/DashSidebar.tsx` (lines 99-104)
- `apps/web/components/Dashboard/Menus/DashMobileMenu.tsx` (lines 18-23)
- `apps/web/components/Security/HeaderProfileBox.tsx` (lines 40-45)

**Code** (DashSidebar):

```typescript
const canSeeOrg =
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.OWN);
```

**Problem**: Checks `:own` but org-admin has `:org`. Organization settings menu item is hidden.

**Fix** (defense-in-depth):

```typescript
const canSeeOrg =
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.ORG);
```

Apply same pattern to all three files and to `canAccessDashboard` in HeaderProfileBox.

---

### BUG #4 [HIGH] - `remove_user_from_org` checks wrong permission

**File**: `apps/api/src/services/orgs/users.py` (line 135)

**Code**:

```python
checker.require(current_user.id, "organization:delete", org.id)
```

**Problem**: "Remove user from org" checks `organization:delete`, which semantically means "delete the entire organization". Org-admin does NOT have `organization:delete:org` (intentionally — admins shouldn't delete the org). But org-admin SHOULD be able to remove members.

**Fix**: Change to a permission the org-admin has:

```python
checker.require(current_user.id, "organization:manage", org.id)
```

---

### BUG #5 [HIGH] - Course edit tabs hidden from org-admin

**File**: `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page.tsx`

**Code**:

```typescript
// "General" and "Content" tabs:
requiredScope: Scopes.OWN,  // checks course:update:own

// "Access" and "Contributors" tabs:
requiredScope: Scopes.OWN,  // checks course:manage:own
```

**Problem**: Org-admin has `course:update:org` and `course:manage:org` (via `course:*:org`) but tabs check for `:own`. All tabs except "Certification" are hidden.

**Fix**: Resolved by Bug #1 fix. For defense-in-depth, also change tab scopes:

```typescript
{ key: 'general', requiredScope: Scopes.ORG, ... },     // or keep OWN if Bug #1 is fixed
{ key: 'content', requiredScope: Scopes.ORG, ... },
{ key: 'access', requiredScope: Scopes.ORG, ... },
{ key: 'contributors', requiredScope: Scopes.ORG, ... },
```

---

### BUG #6 [HIGH] - Org-admin missing essential user management permissions

**File**: `apps/api/src/db/permission_enums.py` — `SYSTEM_ROLES[ORG_ADMIN]` (line 78)

**Current org-admin user permissions**:

```python
"user:read:org",
"user:update:org",
```

**Missing permissions**:

- `user:create:org` — org-admin cannot create users
- `user:delete:org` — org-admin cannot delete users
- `user:invite:org` — org-admin cannot invite users

**Fix**: Add to org-admin's permissions list:

```python
"user:create:org",
"user:delete:org",
"user:invite:org",
```

---

### BUG #7 [HIGH] - `submission:grade` uses non-existent resource type

**File**: `apps/api/src/routers/courses/assignments.py` (line 490)

**Code**:

```python
checker.require(current_user.id, "submission:grade", org_id)
```

**Problem**: `submission` is not a valid `ResourceType` in the permission enum. The correct resource is `assignment`. No role has `submission:grade:*` so this endpoint always fails except for super-admin.

**Fix**:

```python
checker.require(current_user.id, "assignment:grade", org_id)
```

---

### BUG #8 [HIGH] - Optional `org_id` in user/usergroup routers causes permission failures

**Files**:

- `apps/api/src/routers/users.py` (lines 140, 165, 278): `org_id: Query() = None`
- `apps/api/src/routers/usergroups.py` (lines 116, 138, 159): `org_id: Query() = None`

**Problem**: When `org_id` is `None`, the permission checker loads system-level permissions only (no org-scoped permissions). Since org-admin permissions are all `:org` scoped, they require an org context to be loaded. If the frontend omits `org_id` from the query string, all permission checks fail.

**Affected endpoints**:

- `PUT /users/{user_id}` — update other user's profile
- `PUT /users/update_avatar/{user_id}` — update other user's avatar
- `DELETE /users/user_id/{user_id}` — delete user
- `PUT /usergroups/{usergroup_id}` — update usergroup
- `DELETE /usergroups/{usergroup_id}` — delete usergroup
- `POST /usergroups/{usergroup_id}/add_users` — add users to usergroup

**Fix**: For usergroup endpoints, resolve `org_id` from the usergroup's own `org_id` field when not provided. For user endpoints, resolve from the user's org membership. Example for usergroups:

```python
# If org_id not provided, resolve from the usergroup itself
if org_id is None:
    ug = db_session.get(UserGroup, usergroup_id)
    if ug:
        org_id = ug.org_id
```

---

### BUG #9 [HIGH] - Admin layout uses wrong scopes (partial)

**File**: `apps/web/app/orgs/[orgslug]/dash/admin/layout.tsx`

**Code**:

```typescript
await requireAnyPermission(orgslug, [
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.UPDATE, resource: Resources.ROLE, scope: Scopes.ORG },
]);
```

**Problem**: First two checks use `Scopes.OWN` (wrong for org-admin). Currently works only because the 3rd check (`role:update:org`) matches. Fragile — would break if role permissions change.

**Fix**: Add `:org` scope checks:

```typescript
await requireAnyPermission(orgslug, [
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.OWN },
    { action: Actions.MANAGE, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.ORGANIZATION, scope: Scopes.ORG },
    { action: Actions.UPDATE, resource: Resources.ROLE, scope: Scopes.ORG },
]);
```

---

### BUG #10 [MEDIUM] - Mobile menu doesn't gate Courses and Users links

**File**: `apps/web/components/Dashboard/Menus/DashMobileMenu.tsx`

**Problem**: Desktop sidebar conditionally shows Courses (gated by `canSeeCourses`) and Users (gated by `canSeeUsers`), but mobile menu shows them **unconditionally**. A regular user without course/user management permissions sees these links and gets redirected to unauthorized on click.

**Fix**: Apply same `canSeeCourses` / `canSeeUsers` guards as the desktop sidebar:

```typescript
{canSeeCourses ? (
    <ToolTip content={t('tooltips.courses')} ...>
        <AppLink href="/dash/courses" ...>
```

---

### BUG #11 [MEDIUM] - CourseUpdates and CourseAuthors hidden from org-admin

**Files**:

- `apps/web/components/Objects/Courses/CourseUpdates/CourseUpdates.tsx`
- `apps/web/components/Objects/Courses/CourseAuthors/CourseAuthors.tsx`

**Code**:

```typescript
const canUpdateCourse = can(Actions.UPDATE, Resources.COURSE, Scopes.OWN);
const canManageCourse = can(Actions.MANAGE, Resources.COURSE, Scopes.OWN);
```

**Problem**: Checks `:own` but org-admin has `:org`.

**Fix**: Resolved by Bug #1. For defense-in-depth, add `:org` checks:

```typescript
const canUpdateCourse = can(Actions.UPDATE, Resources.COURSE, Scopes.OWN) ||
                         can(Actions.UPDATE, Resources.COURSE, Scopes.ORG);
```

---

### BUG #12 [MEDIUM] - Onboarding hidden from org-admin

**File**: `apps/web/components/Objects/Onboarding/Onboarding.tsx`

**Code**:

```typescript
const canManageOrg = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN);
```

**Problem**: Checks `:own`, org-admin has `:org`.

**Fix**: Resolved by Bug #1. For defense-in-depth:

```typescript
const canManageOrg = can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN) ||
                      can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.ORG);
```

---

### BUG #13 [MEDIUM] - Python syntax error in `RequirePermission`

**File**: `apps/api/src/security/rbac.py` (line 544)

**Code**:

```python
except ValueError, TypeError:
```

**Problem**: This is Python 2 syntax. In Python 3 it should be `except (ValueError, TypeError):`. This is a **SyntaxError** that would prevent the entire `rbac.py` module from importing if the file is compiled. Currently this class appears unused by any router (they use `PermissionCheckerDep` directly), which may be why it hasn't been caught.

**Fix**:

```python
except (ValueError, TypeError):
```

---

## Implementation Plan

### Phase 1: Backend Core Fix (resolves majority of bugs)

| Step | File                                          | Bug | Description                                                                     |
| ---- | --------------------------------------------- | --- | ------------------------------------------------------------------------------- |
| 1.1  | `apps/api/src/security/rbac.py`               | #1  | Add scope hierarchy expansion to `get_expanded_permissions()`                   |
| 1.2  | `apps/api/src/security/rbac.py`               | #13 | Fix `except ValueError, TypeError:` syntax                                      |
| 1.3  | `apps/api/src/db/permission_enums.py`         | #6  | Add `user:create:org`, `user:delete:org`, `user:invite:org` to org-admin        |
| 1.4  | `apps/api/src/services/orgs/users.py`         | #4  | Change `organization:delete` to `organization:manage` in `remove_user_from_org` |
| 1.5  | `apps/api/src/routers/courses/assignments.py` | #7  | Change `submission:grade` to `assignment:grade`                                 |

### Phase 2: Backend Router Fixes

| Step | File                                 | Bug | Description                                                   |
| ---- | ------------------------------------ | --- | ------------------------------------------------------------- |
| 2.1  | `apps/api/src/routers/usergroups.py` | #8  | Resolve `org_id` from usergroup when not provided in query    |
| 2.2  | `apps/api/src/routers/users.py`      | #8  | Resolve `org_id` from user's org membership when not provided |

### Phase 3: Frontend Defense-in-Depth (server-side layouts)

| Step | File                                                | Bug | Description             |
| ---- | --------------------------------------------------- | --- | ----------------------- |
| 3.1  | `apps/web/app/orgs/[orgslug]/dash/org/layout.tsx`   | #2  | Add `:org` scope checks |
| 3.2  | `apps/web/app/orgs/[orgslug]/dash/admin/layout.tsx` | #9  | Add `:org` scope checks |

### Phase 4: Frontend Defense-in-Depth (client-side components)

| Step | File                                                                  | Bug     | Description                                                |
| ---- | --------------------------------------------------------------------- | ------- | ---------------------------------------------------------- |
| 4.1  | `apps/web/components/Dashboard/Menus/DashSidebar.tsx`                 | #3      | Add `:org` scope to `canSeeOrg`                            |
| 4.2  | `apps/web/components/Dashboard/Menus/DashMobileMenu.tsx`              | #3, #10 | Add `:org` scope to `canSeeOrg` + gate Courses/Users links |
| 4.3  | `apps/web/components/Security/HeaderProfileBox.tsx`                   | #3      | Add `:org` scope to `canAccessDashboard`                   |
| 4.4  | `apps/web/app/orgs/.../[subpage]/page.tsx`                            | #5      | Add `:org` scope to tab permission checks                  |
| 4.5  | `apps/web/components/Objects/Courses/CourseUpdates/CourseUpdates.tsx` | #11     | Add `:org` scope check                                     |
| 4.6  | `apps/web/components/Objects/Courses/CourseAuthors/CourseAuthors.tsx` | #11     | Add `:org` scope check                                     |
| 4.7  | `apps/web/components/Objects/Onboarding/Onboarding.tsx`               | #12     | Add `:org` scope check                                     |

### Phase 5: Seeding / Migration

| Step | Description                                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1  | Create Alembic migration to add the 3 new permission rows (`user:create:org`, `user:delete:org`, `user:invite:org`) and link them to the org-admin role |
| 5.2  | Update `seed_default_roles()` to be idempotent with the new permissions                                                                                 |

---

## Verification Checklist

After applying all fixes, verify as **org-admin**:

- [ ] Dashboard link visible in header profile dropdown
- [ ] Sidebar shows: Home, Courses, Assignments, Users, Org Settings
- [ ] Mobile menu gates Courses/Users properly
- [ ] Organization settings page loads (no redirect to /unauthorized)
- [ ] Admin (roles) page loads
- [ ] Course edit page shows all tabs: General, Content, Access, Contributors, Certification
- [ ] Can create a new course
- [ ] Can edit course updates and authors
- [ ] Can create/delete users
- [ ] Can remove users from organization
- [ ] Can grade assignment submissions
- [ ] Can update/delete usergroups (with and without explicit `org_id` in query)
- [ ] Onboarding flow visible
- [ ] Payments page accessible (if feature enabled)

---

## Risk Assessment

- **Bug #1 fix** (scope expansion) is the highest-impact single change. It fixes ~8 bugs at once, but if the expansion logic is wrong it could over-grant access. The proposed hierarchy (`all > org > own` and `all > org > assigned`) is safe because it matches the backend's own `_resolve()` logic.
- **Frontend defense-in-depth** (Phases 3-4) ensures that even if the backend expansion is broken, the UI still works for org-admin. These changes are low-risk (only adds additional `||` checks).
- **Bug #6** (missing permissions) and **Bug #4** (wrong permission string) require careful review to ensure no privilege escalation.
