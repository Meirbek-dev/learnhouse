# RBAC System Refactor Plan

## Table of Contents

1. [Critique: Why the Current System is Broken](#1-critique-why-the-current-system-is-broken)
2. [Architecture: Target Design](#2-architecture-target-design)
3. [Implementation Plan](#3-implementation-plan)
4. [File-by-File Changes](#4-file-by-file-changes)
5. [Migration Strategy](#5-migration-strategy)
6. [Testing Strategy](#6-testing-strategy)

---

## 1. Critique: Why the Current System is Broken

### 1.1 The System is in a Half-Migrated, Non-Functional State

The RBAC system exists in two parallel realities that were never connected:

- **Old API**: `PermissionService.check(user=, action=, resource=, org_id=, raise_on_deny=)` — called 194 times across 32 files
- **New API**: `RBACService.check_sync(user_id=, action=, resource=, org_id=, resource_id=, request=, use_cache=)` — called 0 times in production code

A shim in `src/services/permissions/__init__.py` does `PermissionService = RBACService`, which means every single `await permission_service.check(user=current_user, ...)` call in the codebase will crash with a `TypeError` at runtime because:

| What callers pass           | What `RBACService` actually expects       |
| --------------------------- | ----------------------------------------- |
| `check()`                   | Method doesn't exist. Only `check_sync()` |
| `user=` (PublicUser object) | `user_id=` (int)                          |
| `raise_on_deny=False`       | No such parameter                         |
| `await` (async)             | Synchronous method                        |
| Returns `bool`              | Returns `PermissionCheck` dataclass       |

**Impact**: 194 permission checks across orgs, courses, users, payments, assignments, exams, discussions, collections, chapters, activities, certifications, usergroups, gamification, contributors — all broken.

### 1.2 Bootstrap / Setup is Broken

`setup.py` calls two methods that don't exist on `RBACService`:

```python
permission_service.seed_default_roles()    # ← doesn't exist
permission_service.assign_role(role_id=1)  # ← expects role_slug, not role_id
```

The installation flow for new deployments is completely non-functional.

### 1.3 Wildcard Permissions Are Dead Code

`permissions.yaml` defines super-admin as `*:*:*` and org-admin with wildcards like `organization:*:org`, `course:*:org`. The actual engine does an **exact string match** in `_check_db()`:

```python
Permission.name == permission_name  # No wildcard/glob resolution
```

Result: super-admin with `*:*:*` stored in the database fails every specific permission check like `course:update:org`. The entire wildcard system is decoration.

### 1.4 Scope Fallback Chain is Documentation-Only

The YAML documents a fallback `own → org → all`, but `_build_permission_name()` hardcodes scope to `"org"` and the engine does zero fallback. A user with `course:update:all` fails a check for `course:update:org`.

### 1.5 Role Hierarchy (`inherits`) is Dead Code

`permissions.yaml` defines inheritance chains (`instructor inherits user`, `maintainer inherits instructor`). The DB model `RoleCreate` has `parent_role_id`. The frontend `RoleHierarchyTree` renders parent-child relationships. But `_check_db()` does a flat join — it never traverses the hierarchy. An instructor doesn't inherit user permissions.

### 1.6 Overengineered for What it Actually Does

The system has 684-line service, Redis cache layer, audit service, enrichment service, monitoring dev tools, role hierarchy tree UI component, permission denied UI component — but none of it works because the core `check()` method signature is wrong. It's elaborate scaffolding around a broken foundation.

Specific overengineering:

- **Redis cache** for permission checks that never execute
- **Audit logging** with IP tracking, user-agent capture, request IDs — for checks that crash before reaching the audit code
- **Permission monitoring dev tools** (`PermissionMonitor` class tracking cache hit rates, avg check times) — monitoring a non-functional system
- **Response enrichment** (`enrich_course_with_permissions`, `enrich_collection_with_permissions`, etc.) — 8 resource-specific enrichment functions that call `check_sync()` in a loop, creating N+1 query patterns. Declared `async` but call synchronous methods
- **Batch permission checking** endpoint and schemas — for a check method that doesn't exist

### 1.7 Massive Code Duplication

Every protected endpoint hand-rolls the same 4-line pattern:

```python
has_permission = await permission_service.check(
    user=current_user, action=Action.XXX, resource=ResourceType.XXX,
    org_id=org_id, raise_on_deny=False,
)
if not has_permission:
    raise PermissionDenied(action="xxx", resource_type="yyy", reason="...")
```

This is repeated 194 times. A `require_permission()` FastAPI dependency was built in `src/services/rbac/dependencies.py` to eliminate this — but it's used exactly 0 times.

### 1.8 Dual AdminGuard Components

Two completely different `AdminGuard` implementations:

1. `components/Security/AdminGuard.tsx` — Permission-based: checks `can(Actions.MANAGE, ResourceTypes.ORGANIZATION)` with redirect support
2. `components/Security/PermissionGuard.tsx` — Role-based: checks `isAdmin`/`isSuperAdmin` from role list

Both are imported from `components/Security/index.ts`. Which one you get depends on import path. They have different semantics and different fallback behaviors.

### 1.9 Frontend-Backend Endpoint Mismatch

- `PermissionProvider` fetches from `/me/permissions` — actual route is `/api/v1/rbac/me/permissions`
- `usePermissions` fetches from `/permissions/resource/{type}/{id}` — this route doesn't exist at all
- `AdminGuard` checks `organization:manage:all` (scope=ALL) — but org-admin only has `organization:manage:org`. No org-admin can pass the guard

### 1.10 Scattered Import Paths with Shim Layers

The same types/functions are importable from 4+ different paths:

```
src.db.permissions.generated_enums → Action, ResourceType
src.db.permissions.enums           → re-exports generated_enums + adds AuditAction
src.db.permissions                 → re-exports enums + models
src.db.permissions.constants       → RoleSlug, role groups

src.services.rbac.service          → RBACService
src.services.rbac                  → re-exports
src.services.permissions           → shim: PermissionService = RBACService

src.security.rbac.exceptions       → PermissionDenied, etc.
src.security.permissions           → shim → rbac.exceptions
src.security.permissions.exceptions → shim → rbac.exceptions
```

Some routers import from `src.db.permissions`, others from `src.db.permissions.generated_enums`, others from `src.db.permissions.enums`. Three different import paths for `Action` and `ResourceType`.

### 1.11 `_v2` Table Name Suffix Confusion

DB models use `permissions_v2`, `roles_v2`, `role_permissions_v2`, `user_roles_v2` as table names. The migration creates these `_v2` tables. This is a migration artifact that should never ship to production — it signals "temporary parallel tables during migration" but there are no v1 tables to migrate from anymore.

### 1.12 users.py Passes Garbage to Permission Checks

```python
await permission_service.check(
    user="create",           # ← literal string "create" as user
    action=Action.READ,
    resource=ResourceType.ORGANIZATION,
    resource_id=current_user, # ← user object as resource_id
)
```

This appears at 4 call sites in `src/services/users/users.py`. Even if the method existed, these would never authorize correctly.

### 1.13 Summary: Root Causes

| Root Cause                                                                | Consequence                                                      |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Incomplete migration from old to new API                                  | 194 broken call sites                                            |
| No integration tests                                                      | Broken state wasn't caught                                       |
| Overengineered caching/auditing before core worked                        | Complexity without value                                         |
| Frontend built against assumed API, not actual API                        | Guard components check non-existent endpoints                    |
| Wildcard/scope/hierarchy designed in YAML but never implemented in engine | Permissions.yaml is fiction                                      |
| Shim layers hide breakage                                                 | `PermissionService = RBACService` looks fine, crashes at runtime |

---

## 2. Architecture: Target Design

### 2.1 Principles

1. **One service, one method, one import path** — No shims, no aliases, no re-exports
2. **Permissions resolved in-memory, not per-query** — Load user's effective permissions once, check against the set
3. **Wildcards and scope fallback actually work** — Pattern matching, not string equality
4. **Declarative route protection** — `Depends(require_permission(...))`, not 4-line boilerplate
5. **Frontend gets a flat permission set** — No second-guessing, no client-side resolution
6. **No `_v2` suffixes, no compatibility shims, no dead code**

### 2.2 Permission Model

Keep the `{resource}:{action}:{scope}` triple format. It's a good model — it just needs a working engine.

```
Permission string: "course:update:org"
Wildcard:          "course:*:org"     → matches any action on course in org scope
Super wildcard:    "*:*:*"            → matches everything
```

**Resolution order** (first match wins):

1. Exact match: `course:update:org`
2. Action wildcard: `course:*:org`
3. Resource wildcard: `*:update:org`
4. Scope broadening: `course:update:all` covers `course:update:org` and `course:update:own`
5. Full wildcard: `*:*:*`

**Scope hierarchy**: `own < assigned < org < all`

### 2.3 Data Model (Clean)

```
┌──────────────┐     ┌───────────────────┐     ┌──────────────┐
│   roles      │────<│ role_permissions   │>────│ permissions  │
│              │     │                   │     │              │
│ id           │     │ role_id           │     │ id           │
│ slug         │     │ permission_id     │     │ name         │
│ name         │     │ granted_at        │     │ resource     │
│ org_id (FK)  │     └───────────────────┘     │ action       │
│ is_system    │                               │ scope        │
│ priority     │     ┌───────────────────┐     │ description  │
│ created_at   │────<│ user_roles        │     │ is_dangerous │
└──────────────┘     │                   │     └──────────────┘
                     │ user_id (FK)      │
                     │ role_id (FK)      │
                     │ org_id (FK)       │
                     │ assigned_at       │
                     │ assigned_by       │
                     └───────────────────┘
```

- No `_v2` suffix
- No `expires_at` (YAGNI — not used anywhere, adds complexity)
- No `parent_role_id` (hierarchy handled by permission assignment, not role nesting)
- No `permission_audit_log` table (use application logging, not a DB table — it's a write-heavy append-only table that will grow unbounded)
- `org_id` nullable on roles: NULL = global system role
- Composite unique: `(slug, org_id)` on roles
- Composite unique: `(user_id, role_id, org_id)` on user_roles

### 2.4 Backend Architecture

```
src/
├── db/
│   └── permissions.py              # SQLModel tables + Pydantic schemas (single file)
├── security/
│   ├── auth.py                     # JWT auth (unchanged)
│   └── rbac.py                     # PermissionChecker class + require() dependency + exceptions
└── services/
    └── roles.py                    # Role CRUD service
```

**No more:**

- `src/db/permissions/` directory (7 files) → single `src/db/permissions.py`
- `src/services/rbac/` directory (6 files) → single `src/security/rbac.py`
- `src/services/permissions/` shim directory → deleted
- `src/security/permissions/` shim directory → deleted
- `src/security/rbac/` directory (3 files) → merged into `src/security/rbac.py`
- `src/services/rbac/enrichment.py` → deleted (permissions embedded in API responses by the serializer)
- `src/services/rbac/cache.py` → deleted (in-memory per-request, not Redis)
- `src/services/rbac/audit.py` → deleted (use structured logging)

### 2.5 Core Engine: `PermissionChecker`

```python
class PermissionChecker:
    """Loads user's effective permissions once, checks in-memory."""

    def __init__(self, db: Session):
        self.db = db
        self._cache: dict[tuple[int, int], set[str]] = {}  # (user_id, org_id) → permission set

    def _load_permissions(self, user_id: int, org_id: int) -> set[str]:
        """Single query: JOIN user_roles → roles → role_permissions → permissions
        Returns set of permission name strings for this user+org."""
        ...

    def check(self, user_id: int, permission: str, org_id: int) -> bool:
        """Check if user has permission in org. Handles wildcards + scope fallback."""
        perms = self._get_or_load(user_id, org_id)
        return self._matches(permission, perms)

    def require(self, user_id: int, permission: str, org_id: int) -> None:
        """check() + raise PermissionDenied if False."""
        if not self.check(user_id, permission, org_id):
            raise PermissionDenied(permission=permission)

    def check_many(self, user_id: int, permissions: list[str], org_id: int) -> dict[str, bool]:
        """Batch check. Single permission load, multiple in-memory checks."""
        ...

    def get_effective_permissions(self, user_id: int, org_id: int) -> set[str]:
        """Return all effective permissions for frontend consumption."""
        ...

    @staticmethod
    def _matches(required: str, granted: set[str]) -> bool:
        """Wildcard + scope fallback matching."""
        if required in granted or "*:*:*" in granted:
            return True

        resource, action, scope = required.split(":")

        # Check wildcards: resource:*:scope, *:action:scope, resource:*:*
        wildcard_patterns = [
            f"{resource}:*:{scope}",
            f"*:{action}:{scope}",
            f"{resource}:*:*",
            f"*:*:{scope}",
        ]
        if any(p in granted for p in wildcard_patterns):
            return True

        # Scope broadening: org covers own, all covers org
        SCOPE_HIERARCHY = {"own": ["assigned", "org", "all"], "assigned": ["org", "all"], "org": ["all"]}
        for broader_scope in SCOPE_HIERARCHY.get(scope, []):
            broader = f"{resource}:{action}:{broader_scope}"
            if broader in granted or f"{resource}:*:{broader_scope}" in granted:
                return True

        return False
```

### 2.6 Route Protection: `require_permission` Dependency

```python
def require_permission(permission: str, *, org_id_param: str = "org_id"):
    """FastAPI dependency that checks permission from path/query params."""
    async def dependency(
        request: Request,
        current_user: CurrentUser,
        checker: PermissionCheckerDep,
    ):
        org_id = request.path_params.get(org_id_param) or request.query_params.get(org_id_param)
        checker.require(current_user.id, permission, int(org_id))

    return Depends(dependency)

# Usage in routers:
@router.post("/courses", dependencies=[require_permission("course:create:org")])
async def create_course(...):
    ...
```

Every protected endpoint becomes a one-liner dependency instead of a 4-line boilerplate block.

### 2.7 Frontend Architecture

```
components/Security/
├── PermissionProvider.tsx    # Context: fetches permissions, provides can()/hasRole()
├── PermissionGuard.tsx       # Single guard component (replaces 4 variants)
└── AdminGuard.tsx            # Deleted — use PermissionGuard with admin permission

hooks/
└── usePermissions.ts         # Simplified: just reads from PermissionProvider context

types/
└── permissions.ts            # Generated enums + interfaces (single file)
```

**PermissionProvider** fetches `GET /api/v1/rbac/me/permissions?org_id=X` once, receives:

```json
{
  "roles": [{"slug": "org-admin", "name": "Organization Admin", "priority": 90}],
  "permissions": ["organization:*:org", "course:*:org", "user:read:org", ...],
  "org_id": 123
}
```

**`can()` method** — Does the same wildcard+scope matching as backend, client-side:

```typescript
function can(permission: string): boolean {
  return matchesAny(permission, permissions);
}
```

**Single `PermissionGuard`** — Replaces `PermissionGuard`, `MultiPermissionGuard`, `RoleGuard`, `AdminGuard`:

```tsx
<PermissionGuard permission="course:create:org">
  <CreateCourseButton />
</PermissionGuard>

<PermissionGuard permissions={["course:create:org", "course:update:org"]} mode="any">
  <CourseTools />
</PermissionGuard>
```

### 2.8 Code Generation from YAML

Keep the code generation from `permissions.yaml` → TypeScript + Python. Simplify the output:

**Python output** (`src/db/permission_enums.py`):

```python
class Resource(StrEnum):
    ORGANIZATION = "organization"   # lowercase, matches permission strings directly
    COURSE = "course"
    ...

class Action(StrEnum):
    CREATE = "create"               # lowercase, matches permission strings directly
    READ = "read"
    ...

class Scope(StrEnum):
    ALL = "all"
    OWN = "own"
    ORG = "org"
    ASSIGNED = "assigned"

class RoleSlug(StrEnum):
    SUPER_ADMIN = "super-admin"
    ORG_ADMIN = "org-admin"
    ...

SYSTEM_ROLES: dict[str, list[str]]  # slug → [permission strings]
```

No uppercase-lowercase conversion needed. Values match permission strings directly.

**TypeScript output** (`types/permissions.ts`):

```typescript
export const Resource = { ORGANIZATION: "organization", COURSE: "course", ... } as const;
export const Action = { CREATE: "create", READ: "read", ... } as const;
export const Scope = { ALL: "all", OWN: "own", ORG: "org", ASSIGNED: "assigned" } as const;
export const RoleSlug = { SUPER_ADMIN: "super-admin", ORG_ADMIN: "org-admin", ... } as const;
```

---

## 3. Implementation Plan

### Phase 1: Clean Database Layer

**Goal**: Single source of truth for DB models, no `_v2` suffixes

| Step | Action                                                                                                                                                             | Files         |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| 1.1  | Create `src/db/permissions.py` — single file with all tables + schemas                                                                                             | New file      |
| 1.2  | Write Alembic migration: rename `permissions_v2` → `permissions`, `roles_v2` → `roles`, `role_permissions_v2` → `role_permissions`, `user_roles_v2` → `user_roles` | New migration |
| 1.3  | Drop `permission_audit_log_v2` table — replace with structured logging                                                                                             | Migration     |
| 1.4  | Remove `expires_at` from user_roles, `parent_role_id` from roles schema                                                                                            | Migration     |
| 1.5  | Delete `src/db/permissions/` directory (all 7 files)                                                                                                               | Delete        |
| 1.6  | Update all imports across 47 files that import from `src.db.permissions.*`                                                                                         | Bulk update   |

### Phase 2: Build the New Engine

**Goal**: Working permission checker with wildcard + scope fallback

| Step | Action                                                                                                                            | Files         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| 2.1  | Create `src/security/rbac.py` — `PermissionChecker` class + `require_permission` dependency + exceptions                          | New file      |
| 2.2  | Implement `_matches()` with wildcard resolution + scope hierarchy                                                                 | In `rbac.py`  |
| 2.3  | Implement `_load_permissions()` — single JOIN query, returns `set[str]`                                                           | In `rbac.py`  |
| 2.4  | Implement `check()`, `require()`, `check_many()`, `get_effective_permissions()`                                                   | In `rbac.py`  |
| 2.5  | Write unit tests for `_matches()` covering: exact match, action wildcard, resource wildcard, scope broadening, `*:*:*`, non-match | New test file |
| 2.6  | Delete `src/services/rbac/` directory (6 files)                                                                                   | Delete        |
| 2.7  | Delete `src/security/rbac/` directory (3 files)                                                                                   | Delete        |
| 2.8  | Delete `src/services/permissions/` shim directory                                                                                 | Delete        |
| 2.9  | Delete `src/security/permissions/` shim directory                                                                                 | Delete        |

### Phase 3: Convert All 194 Call Sites

**Goal**: Every `permission_service.check(...)` → `Depends(require_permission(...))` or `checker.require()`

| Step | Action                                                                                                                                                    | Scope                                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 3.1  | **Routers** — Convert inline checks to `dependencies=[require_permission("...")]` on route decorators                                                     | 35 call sites across 10 router files   |
| 3.2  | **Services** — Replace `permission_service.check()` with `checker.require()` passed as parameter                                                          | 159 call sites across 22 service files |
| 3.3  | Fix the 4 garbage calls in `users.py` (`user="create"`) — determine actual intent and write correct permission check                                      | 4 call sites                           |
| 3.4  | Fix `setup.py` — replace `seed_default_roles()` with direct DB seeding, replace `assign_role(role_id=1)` with `assign_role(user_id, "org-admin", org_id)` | 1 file                                 |
| 3.5  | Remove all `PermissionService` / `get_permission_service` imports — replace with `PermissionChecker`                                                      | 34 files                               |

**Conversion patterns:**

```python
# BEFORE (router — 4 lines, repeated everywhere):
@router.post("/courses")
async def create_course(
    permission_service: Annotated[PermissionService, Depends(get_permission_service)],
    current_user = Depends(get_current_user),
    org_id: int,
):
    has_permission = await permission_service.check(
        user=current_user, action=Action.CREATE,
        resource=ResourceType.COURSE, org_id=org_id, raise_on_deny=False,
    )
    if not has_permission:
        raise PermissionDenied(action="create", resource_type="course")
    ...

# AFTER (router — 0 lines, declarative):
@router.post("/courses", dependencies=[require_permission("course:create:org")])
async def create_course(
    current_user: CurrentUser,
    org_id: int,
):
    ...
```

```python
# BEFORE (service — inline check):
async def update_course(self, course_id, data, current_user, org_id, db):
    permission_service = get_permission_service(db)
    has_permission = await permission_service.check(
        user=current_user, action=Action.UPDATE,
        resource=ResourceType.COURSE, org_id=org_id, raise_on_deny=False,
    )
    if not has_permission:
        raise PermissionDenied(...)

# AFTER (service — checker passed in):
async def update_course(self, course_id, data, current_user, org_id, checker: PermissionChecker):
    checker.require(current_user.id, "course:update:org", org_id)
```

### Phase 4: Simplify Roles Service

**Goal**: Clean role CRUD without circular dependencies

| Step | Action                                                                                       | Files              |
| ---- | -------------------------------------------------------------------------------------------- | ------------------ |
| 4.1  | Rewrite `src/services/roles.py` — CRUD for roles using `PermissionChecker` for authorization | Rewrite            |
| 4.2  | Update `src/routers/roles.py` — use `require_permission` dependencies                        | Update             |
| 4.3  | Rewrite `src/routers/rbac.py` — simplify to: check, me/permissions, assign, revoke           | Update             |
| 4.4  | Remove role hierarchy tree logic (dead code)                                                 | Delete unused code |
| 4.5  | Delete `src/services/roles/roles.py` → move to `src/services/roles.py`                       | Flatten            |

### Phase 5: Clean Code Generation

**Goal**: YAML → Python + TypeScript with lowercase values matching permission strings

| Step | Action                                                                | Files                                                |
| ---- | --------------------------------------------------------------------- | ---------------------------------------------------- |
| 5.1  | Update codegen script: emit lowercase `StrEnum` values in Python      | Generator script                                     |
| 5.2  | Update codegen script: emit lowercase const values in TypeScript      | Generator script                                     |
| 5.3  | Remove `Action.ACCESS` and `ResourceType.API` (not in YAML, not used) | Generated files                                      |
| 5.4  | Regenerate both files                                                 | `src/db/permission_enums.py`, `types/permissions.ts` |
| 5.5  | Remove `src/db/permissions/enums.py` re-export layer                  | Delete                                               |

### Phase 6: Frontend Overhaul

**Goal**: Single permission provider, single guard component, working endpoint URLs

| Step | Action                                                                                                                             | Files          |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 6.1  | Rewrite `PermissionProvider.tsx` — fetch from correct endpoint, store flat permission set, implement client-side wildcard matching | Rewrite        |
| 6.2  | Delete `usePermissions.ts` hook (329 lines) — all replaced by `PermissionProvider.can()`                                           | Delete         |
| 6.3  | Merge `AdminGuard.tsx` into `PermissionGuard.tsx` — single component                                                               | Merge + delete |
| 6.4  | Simplify `PermissionGuard.tsx` — single component with `permission`/`permissions`/`mode` props                                     | Rewrite        |
| 6.5  | Delete `PermissionDenied.tsx` — inline a simpler version into `PermissionGuard` fallback                                           | Delete         |
| 6.6  | Delete `RoleHierarchyTree.tsx` — dead code (no hierarchy in the system)                                                            | Delete         |
| 6.7  | Delete `PermissionMonitoring.tsx` — dev tools for a system that now works trivially                                                | Delete         |
| 6.8  | Delete `HeaderProfileBox.tsx` role mapping logic — simplify to use role name directly                                              | Simplify       |
| 6.9  | Update `types/permissions.ts` — single file, no re-exports from `generated_permissions.ts`                                         | Consolidate    |
| 6.10 | Update all 9 consumer files (`dash/page.tsx`, `courses.tsx`, `collections/page.tsx`, etc.) to use new `PermissionGuard` API        | 9 files        |

### Phase 7: Seed Data & Migration

**Goal**: Clean database seeding that actually works

| Step | Action                                                                                                    | Files         |
| ---- | --------------------------------------------------------------------------------------------------------- | ------------- |
| 7.1  | Write new Alembic migration for table renames and column drops                                            | New migration |
| 7.2  | Rewrite `setup.py` seeding — iterate `SYSTEM_ROLES` dict from generated enums, create roles + permissions | Rewrite       |
| 7.3  | Ensure `assign_role()` uses `role_slug` consistently                                                      | Verify        |

---

## 4. File-by-File Changes

### Files to DELETE (17 files)

| File                                     | Reason                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `src/db/permissions/__init__.py`         | Replaced by `src/db/permissions.py`                                    |
| `src/db/permissions/constants.py`        | Role groups (`ADMIN_ROLE_SLUGS` etc) — inline into `rbac.py` or remove |
| `src/db/permissions/enums.py`            | Re-export layer — import generated enums directly                      |
| `src/db/permissions/generated_enums.py`  | Moved to `src/db/permission_enums.py` (flattened)                      |
| `src/db/permissions/models.py`           | Merged into `src/db/permissions.py`                                    |
| `src/db/permissions/models_v2.py`        | Merged into `src/db/permissions.py`                                    |
| `src/services/rbac/__init__.py`          | Barrel export — no longer needed                                       |
| `src/services/rbac/service.py`           | Replaced by `src/security/rbac.py`                                     |
| `src/services/rbac/dependencies.py`      | Merged into `src/security/rbac.py`                                     |
| `src/services/rbac/enrichment.py`        | Deleted — permissions in API response serialization                    |
| `src/services/rbac/cache.py`             | Deleted — in-memory per-request                                        |
| `src/services/rbac/audit.py`             | Deleted — use structured logging                                       |
| `src/services/permissions/__init__.py`   | Compatibility shim — deleted                                           |
| `src/security/rbac/__init__.py`          | Barrel export — deleted                                                |
| `src/security/rbac/dependencies.py`      | Merged into `src/security/rbac.py`                                     |
| `src/security/rbac/exceptions.py`        | Merged into `src/security/rbac.py`                                     |
| `src/security/permissions/__init__.py`   | Compatibility shim — deleted                                           |
| `src/security/permissions/exceptions.py` | Compatibility shim — deleted                                           |

### Frontend files to DELETE (4 files)

| File                                           | Reason                                                           |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `hooks/usePermissions.ts`                      | 329 lines of complexity — replaced by `PermissionProvider.can()` |
| `components/Security/AdminGuard.tsx`           | Merged into `PermissionGuard.tsx`                                |
| `components/Security/RoleHierarchyTree.tsx`    | Dead code — no hierarchy                                         |
| `components/Security/PermissionMonitoring.tsx` | Unnecessary dev tooling                                          |

### Files to CREATE (3 files)

| File                              | Purpose                                                                |
| --------------------------------- | ---------------------------------------------------------------------- |
| `src/db/permissions.py`           | Single file: tables + schemas                                          |
| `src/security/rbac.py`            | Single file: `PermissionChecker` + `require_permission()` + exceptions |
| `src/tests/security/test_rbac.py` | Unit tests for wildcard matching, scope fallback, permission loading   |

### Files to REWRITE (5 files)

| File                                                  | Change                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------- |
| `src/routers/rbac.py`                                 | Simplify to 4 endpoints using new `PermissionChecker`       |
| `src/routers/roles.py`                                | Use `require_permission` dependencies                       |
| `src/services/roles.py` (moved from `roles/roles.py`) | Clean CRUD with `PermissionChecker`                         |
| `src/services/setup/setup.py`                         | Fix seeding to use new API                                  |
| `web/components/Security/PermissionProvider.tsx`      | Correct endpoint, flat permission set, client-side matching |

### Files to UPDATE (34 backend + 9 frontend = 43 files)

All files currently importing `PermissionService` / `get_permission_service`:

**Backend routers** (10 files): `orgs.py`, `users.py`, `usergroups.py`, `gamification.py`, `courses/courses.py`, `courses/assignments.py`, `courses/code_challenges.py`, `ee/payments.py`

**Backend services** (22 files): `users/users.py`, `users/usergroups.py`, `orgs/orgs.py`, `orgs/users.py`, `orgs/invites.py`, `orgs/join.py`, `courses/courses.py`, `courses/chapters.py`, `courses/collections.py`, `courses/discussions.py`, `courses/updates.py`, `courses/contributors.py`, `courses/certifications.py`, `courses/activities/activities.py`, `courses/activities/assignments.py`, `courses/activities/exams.py`, `courses/activities/pdf.py`, `courses/activities/video.py`, `payments/payments_config.py`, `payments/payments_courses.py`, `payments/payments_customers.py`, `payments/payments_products.py`, `payments/payments_users.py`, `blocks/block_types/quizBlock/quizBlock.py`

**Frontend** (9 files): `dash/page.tsx`, `dash/layout.tsx`, `dash/courses/client.tsx`, `dash/admin/users/client.tsx`, `dash/admin/roles/client.tsx`, `courses/courses.tsx`, `collections/page.tsx`, `Landings/LandingClassic.tsx`, `Landings/CreateCourseTrigger.tsx`

---

## 5. Migration Strategy

### Database Migration

```python
"""Rename RBAC tables, drop unused columns."""

def upgrade():
    # Rename tables
    op.rename_table("permissions_v2", "permissions")
    op.rename_table("roles_v2", "roles")
    op.rename_table("role_permissions_v2", "role_permissions")
    op.rename_table("user_roles_v2", "user_roles")

    # Drop unused table
    op.drop_table("permission_audit_log_v2")

    # Drop unused columns
    op.drop_column("user_roles", "expires_at")
```

### Data: No migration needed

The permission strings and role definitions stay the same. Only table names change. All existing `user_roles` assignments remain valid.

---

## Appendix: Metric Before/After

| Metric                                           | Before   | After                 |
| ------------------------------------------------ | -------- | --------------------- |
| Backend RBAC files                               | 22       | 4                     |
| Frontend RBAC files                              | 9        | 4                     |
| Lines of RBAC code (backend)                     | ~2,500   | ~400                  |
| Lines of RBAC code (frontend)                    | ~1,200   | ~300                  |
| Import paths for PermissionService               | 4        | 1                     |
| Import paths for Action/ResourceType             | 3        | 1                     |
| Compatibility shim files                         | 4        | 0                     |
| Boilerplate lines per permission check (router)  | 4-6      | 0 (declarative)       |
| Boilerplate lines per permission check (service) | 4-6      | 1                     |
| Working permission checks                        | 0/194    | 194/194               |
| Wildcard resolution                              | Broken   | Working               |
| Scope fallback                                   | Broken   | Working               |
| Role hierarchy                                   | Broken   | Removed (unnecessary) |
| Redis dependency for RBAC                        | Required | Removed               |
| DB queries per permission check                  | 1        | 0 (per-request load)  |
