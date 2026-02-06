# RBAC System: Critical Analysis & Production-Ready Refactoring Plan
>
> **Date:** February 2, 2026
> **Status:** In Progress (Phase 1 complete)
> **Goal:** Clean, simple, production-ready RBAC without legacy/compatibility cruft

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current System Problems](#current-system-problems)
3. [Architecture Issues](#architecture-issues)
4. [Code Smell Analysis](#code-smell-analysis)
5. [Production Readiness Gaps](#production-readiness-gaps)
6. [Proposed Clean Architecture](#proposed-clean-architecture)
7. [Implementation Plan](#implementation-plan)
8. [Migration Strategy](#migration-strategy)
9. [Testing Strategy](#testing-strategy)

---

## Executive Summary

The current RBAC system is **overengineered, inconsistent, and carries significant technical debt** from multiple refactoring attempts. What should be a straightforward permission checking system has become a tangled web of:

- **Dual table schemas** (`roles`/`permissions` vs `roles_v2`/`permissions_v2`)
- **Multiple service layers** (`PermissionService` aliased to `RBACService`, backwards-compat wrappers)
- **Inconsistent naming** (snake_case vs camelCase, `_v2` suffixes everywhere)
- **Two API routers** (`permissions.py` and `rbac_v2.py`) doing the same thing
- **Migration scripts** that remain in the codebase as "just in case" safety nets
- **Scope confusion** (what does `org` vs `own` vs `assigned` actually mean?)

**The result:** A system that's harder to understand, maintain, and extend than necessary.

---

## Current System Problems

### 1. Naming Inconsistency Nightmare

| Location         | Naming Pattern | Example                                            |
| ---------------- | -------------- | -------------------------------------------------- |
| Database tables  | `_v2` suffix   | `permissions_v2`, `roles_v2`, `user_roles_v2`      |
| Migration tables | No suffix      | `permissions`, `roles`, `user_roles`               |
| Python models    | `V2` suffix    | `PermissionV2`, `RoleV2`, `UserRoleV2`             |
| API endpoints    | Mixed          | `/api/v1/rbac/v2/check` (v1 in path, v2 in route!) |
| Service classes  | Aliased        | `PermissionService = RBACService`                  |

**Problem:** Developers can't tell which is "current" vs "legacy". The `_v2` suffix implies there's a `_v1` somewhere that matters—but it doesn't.

### 2. Dual Service/Router Architecture

**Current state:**

```
src/routers/permissions.py     → 789 lines, uses PermissionService
src/routers/rbac_v2.py         → 450+ lines, uses RBACService
src/services/permissions/      → Redirects to rbac/
src/services/rbac/             → Actual implementation
src/security/rbac/             → Another set of dependencies
src/security/permissions/      → Yet another folder
```

**Problem:** Two routers expose overlapping functionality. Neither is deprecated. The `permissions` folder just re-exports from `rbac`. Code lives in 4+ different places.

### 3. Backwards Compatibility Cruft

```python
# From src/services/rbac/service.py
async def check(
    self,
    user_id: int | None = None,       # New interface
    action: str = "",
    resource: str = "",
    ...
    # Backwards compatible parameters (old PermissionService interface)
    user = None,                       # Old interface
    raise_on_deny: bool = False,
    context = None,
) -> PermissionCheck | bool:          # Returns DIFFERENT types!
```

**Problem:** The main `check()` method:

- Accepts parameters from TWO different interfaces
- Returns `PermissionCheck` OR `bool` depending on how you call it
- Has an async wrapper `check_async()` that calls a sync method
- Converts Enums to strings, then does string manipulation

### 4. Scope Confusion & Implicit Behavior

**From permissions.yaml:**

```yaml
scopes:
  - all         # All resources of type
  - own         # Only owned resources
  - assigned    # Assigned to user
  - org         # Within organization
```

**But in the service:**

```python
def _build_permission_name(
    self, action: str, resource: str, scope: str = "org"  # DEFAULT IS ORG?!
) -> str:
```

**Problems:**

1. `scope: str = "org"` is a hardcoded default—but the permission system supports `all`, `own`, `assigned`
2. There's no scope fallback chain implementation despite the YAML documenting one
3. The `resource_id` parameter exists but isn't used in scope resolution
4. Ownership checking (`own` scope) is never implemented—it just checks if permission exists

### 5. Database Schema Duplication

**Tables in migration `69fd16a5d534_rbac_rewrite.py`:**

- `permissions` (non-v2)
- `roles` (non-v2)
- `role_permissions` (non-v2)
- `user_roles` (non-v2)
- `permission_audit_log` (non-v2)

**Tables in `models_v2.py`:**

- `permissions_v2`
- `roles_v2`
- `role_permissions_v2`
- `user_roles_v2`

**Problem:** The migration creates non-v2 tables. The models use v2 tables. There's a data migration script to copy from one to the other. Which tables are actually in use? Both? Neither consistently?

### 6. Enum/String Type Confusion

```python
# In enums.py - uses generated_enums
from src.db.permissions.generated_enums import Action, ResourceType, Scope

# In models.py - uses raw strings stored as enum database types
resource_type: ResourceType  # Enum type hint
action: Action

# In service.py - converts everything to strings
if hasattr(action, 'value'):
    action = action.value
action_str = str(action).lower()
```

**Problem:** The codebase can't decide if it uses Python Enums or strings. Models use Enums, service converts to strings, database stores enum types, API accepts both.

### 7. Circular Import Avoidance Hacks

```python
# From service.py - imports inside methods!
def _check_db(self, ...):
    from src.db.permissions.models_v2 import (
        PermissionV2,
        RoleV2,
        RolePermissionV2,
        UserRoleV2,
    )
```

**Problem:** Nearly every method has local imports to avoid circular dependencies. This is a symptom of poor module organization.

### 8. Frontend/Backend Schema Drift Risk

**Backend source of truth:**

- `shared/permissions.yaml`
- Generated via `scripts/generate_permissions.py`
- Produces `generated_enums.py` (Python) and `generated_permissions.ts` (TypeScript)

**Problem:**

1. Manual script execution required to sync
2. No validation that frontend/backend are in sync
3. The TypeScript types duplicate helper functions (`isAdminRole`, `isInstructorOrHigher`)

---

## Architecture Issues

### 1. Service Responsibility Bloat

`RBACService` is 818 lines and does:

- Permission checking (`check`, `check_sync`, `_check_db`)
- Batch permission checking (`check_many`)
- Role assignment (`assign_role`, `revoke_role`)
- Role CRUD (`create_role`, `add_permission_to_role`)
- User queries (`get_user_roles`, `get_user_permissions`)
- Permission name building (`_build_permission_name`)
- Cache coordination
- Audit logging

**Should be:** Separate `PermissionChecker`, `RoleManager`, and `PermissionQueryService`.

### 2. Missing Domain Concepts

**Not implemented despite being in the YAML:**

1. **Scope fallback chain** - documented but not implemented
2. **Role inheritance** - `inherits: null` in YAML, `parent_role_id` in DB, never used
3. **Wildcard permissions** - `*:*:*` handled in seeding only, not in runtime checks
4. **Resource-level permissions** - `ResourcePermission` interface exists in TypeScript, no backend
5. **Permission conditions** - `conditions` JSONB column exists, never used
6. **Grant types** - `ALLOW`/`DENY` enum exists, always `ALLOW`

### 3. Cache Strategy Issues

```python
# Cache key generation
def _permission_key(self, user_id, permission, org_id, resource_id):
    # Creates unique key per (user, permission, org, resource)
```

**Problems:**

1. No cache warming strategy
2. Cache invalidation is per-user—role changes require invalidating ALL users with that role
3. No batch cache operations
4. Negative cache (denied permissions) has same TTL as positive cache

### 4. Audit Logging Inconsistency

- `AuditService` exists but many operations don't use it
- Permission checks are audited only on denial
- Role changes audited inconsistently
- No correlation IDs for tracing

---

## Code Smell Analysis

### Smell 1: Primitive Obsession

```python
def check(user_id: int, action: str, resource: str, scope: str = "org")
```

Should be: `def check(user: User, permission: Permission)`

### Smell 2: God Object

`RBACService` - does everything, knows everything

### Smell 3: Feature Envy

```python
# Service builds permission name manually
perm_name = f"{resource}:{action}:{scope}"
```

Should be: `permission.name` (let Permission model own its naming)

### Smell 4: Speculative Generality

- `conditions` JSONB column - never used
- `grant_type` ALLOW/DENY - never used
- `parent_role_id` - never used
- `expires_at` on role permissions - checked but never set

### Smell 5: Inappropriate Intimacy

```python
# Service knows about database column names
query = select(PermissionV2).where(PermissionV2.name == permission_name)
```

Should use repository pattern.

---

## Production Readiness Gaps

### 1. Missing Error Handling

```python
try:
    result = self.db.exec(query).first()
except Exception as e:
    logger.error(f"Permission check query failed: {e}")
    return False, f"db_error:{str(e)}"  # LEAKS DB ERRORS TO API!
```

### 2. No Request Tracing

No correlation IDs, no distributed tracing support

### 3. Incomplete Rate Limiting

```python
_limiter = Limiter(key_func=get_remote_address)
# But only applied to some endpoints
```

### 4. No Health Checks

No endpoint to verify RBAC system health (Redis, DB connectivity)

### 5. Missing Metrics

No Prometheus/StatsD integration for:

- Permission check latency
- Cache hit/miss rates
- Role assignment frequency
- Denial rates

### 6. No Circuit Breaker

If Redis is down, every request hits DB without protection

---

## Proposed Clean Architecture

### 1. Remove ALL `_v2` Suffixes

**Database tables:**

- `permissions_v2` → `permission`
- `roles_v2` → `role`
- `role_permissions_v2` → `role_permission`
- `user_roles_v2` → `user_role`

**Python models:**

- `PermissionV2` → `Permission`
- `RoleV2` → `Role`
- etc.

### 2. Single Service Entry Point

```
src/
  rbac/
    __init__.py          # Public API exports
    service.py           # RbacService (thin orchestrator)
    checker.py           # PermissionChecker (pure check logic)
    manager.py           # RoleManager (CRUD operations)
    cache.py             # Cache operations
    repository.py        # Database queries
    models.py            # SQLModel tables
    schemas.py           # Pydantic request/response
    enums.py             # Action, Resource, Scope enums
```

### 3. Clean Permission Model

```python
class Permission(SQLModel, table=True):
    __tablename__ = "permission"

    id: int = Field(primary_key=True)
    resource: Resource
    action: Action
    scope: Scope

    @property
    def name(self) -> str:
        return f"{self.resource.value}:{self.action.value}:{self.scope.value}"

    @classmethod
    def parse(cls, name: str) -> "Permission":
        resource, action, scope = name.split(":")
        return cls(resource=Resource(resource), action=Action(action), scope=Scope(scope))
```

### 4. Simple Check Interface

```python
class RbacService:
    def check(
        self,
        user_id: int,
        permission: str,  # "course:update:own"
        *,
        org_id: int,
        resource_id: str | None = None,
    ) -> bool:
        """Check permission. Returns True/False. Never raises."""

    def require(
        self,
        user_id: int,
        permission: str,
        *,
        org_id: int,
        resource_id: str | None = None,
    ) -> None:
        """Check permission. Raises PermissionDenied if not granted."""
```

### 5. Proper Scope Resolution

```python
class ScopeResolver:
    """Resolves scope against actual resource ownership."""

    def resolve(
        self,
        user_id: int,
        scope: Scope,
        resource_type: Resource,
        resource_id: str | None,
    ) -> bool:
        match scope:
            case Scope.ALL:
                return True
            case Scope.ORG:
                return self._user_in_same_org(user_id, resource_type, resource_id)
            case Scope.OWN:
                return self._user_owns_resource(user_id, resource_type, resource_id)
            case Scope.ASSIGNED:
                return self._user_assigned_to_resource(user_id, resource_type, resource_id)
```

### 6. Single API Router

```python
router = APIRouter(prefix="/rbac", tags=["rbac"])

@router.post("/check")
async def check_permission(req: CheckRequest, user: CurrentUser) -> CheckResponse:
    """Check if current user has permission."""

@router.get("/me/permissions")
async def get_my_permissions(user: CurrentUser) -> PermissionsResponse:
    """Get current user's effective permissions."""

@router.get("/me/roles")
async def get_my_roles(user: CurrentUser) -> RolesResponse:
    """Get current user's roles."""

# Admin endpoints
@router.post("/roles", dependencies=[RequirePermission("role:create:org")])
async def create_role(req: CreateRoleRequest) -> RoleResponse:
    """Create new role."""

@router.post("/roles/{role_id}/permissions", dependencies=[RequirePermission("role:update:org")])
async def add_permission_to_role(role_id: int, req: AddPermissionRequest) -> None:
    """Add permission to role."""
```

---

## Implementation Plan

1. **Create new migration** that:
   - Renames `permissions_v2` → `permission`
   - Renames `roles_v2` → `role`
   - Renames `role_permissions_v2` → `role_permission`
   - Renames `user_roles_v2` → `user_role`
   - Drops old non-v2 tables if they exist
   - Updates all indexes and constraints

2. **Rename Python models**:
   - `PermissionV2` → `Permission`
   - Remove all `_v2` imports

3. **Delete migration scripts**:
   - Remove `scripts/migrate_to_rbac_v2.py`
   - Remove `scripts/seed_rbac_v2_permissions.py`
   - Create single `scripts/seed_permissions.py`

1. **Merge routers**:
   - Delete `src/routers/permissions.py`
   - Rename `src/routers/rbac_v2.py` → `src/routers/rbac.py`
   - Update all imports

2. **Simplify service**:
   - Remove backwards-compat parameters from `check()`
   - Remove `check_async()` wrapper
   - Use single return type `PermissionResult`
   - Remove circular import hacks via proper module structure

3. **Delete compatibility aliases**:
   - Remove `PermissionService = RBACService`
   - Remove `get_permission_service = get_rbac_service`
   - Update all callers to use `RbacService` directly

1. **Scope resolution**:
   - Implement `ScopeResolver` class
   - Add ownership checking for `own` scope
   - Add assignment checking for `assigned` scope

2. **Permission fallback chain**:
   - `course:update:own` should check `course:update:org` and `course:update:all`

3. **Role inheritance** (optional):
   - Either implement `parent_role_id` or remove the column

1. **Observability**:
   - Add Prometheus metrics
   - Add request correlation IDs
   - Structured logging

2. **Resilience**:
   - Circuit breaker for Redis
   - Graceful degradation to DB-only mode
   - Health check endpoint

3. **Performance**:
   - Cache warming on startup
   - Batch permission check optimization
   - Query optimization with EXPLAIN ANALYZE

---

## Migration Strategy

### Database Migration

```python
def upgrade():
    # 1. Rename tables
    op.rename_table("permissions_v2", "permission")
    op.rename_table("roles_v2", "role")
    op.rename_table("role_permissions_v2", "role_permission")
    op.rename_table("user_roles_v2", "user_role")

    # 2. Drop old tables (after verification)
    op.drop_table("permissions", if_exists=True)
    op.drop_table("roles", if_exists=True)
    op.drop_table("role_permissions", if_exists=True)
    op.drop_table("user_roles", if_exists=True)

    # 3. Update foreign keys and indexes
    # ... (rename constraints)
```

### Code Migration

1. **Global find/replace**:
   - `PermissionV2` → `Permission`
   - `RoleV2` → `Role`
   - `UserRoleV2` → `UserRole`
   - `permissions_v2` → `permission`
   - `roles_v2` → `role`

2. **Import updates**:
   - `from src.db.permissions.models_v2` → `from src.rbac.models`
   - `from src.services.permissions` → `from src.rbac`

3. **API path updates** (requires frontend coordination):
   - `/api/v1/rbac/v2/*` → `/api/v1/rbac/*`

---


---

## Files to Delete

After migration is complete, remove:

```
scripts/migrate_to_rbac_v2.py
scripts/seed_rbac_v2_permissions.py
scripts/verify_rbac_refactoring.py
scripts/verify_rbac_data_integrity.sql
apps/api/src/routers/permissions.py        # Merge into rbac.py
apps/api/src/services/permissions/         # Entire folder
apps/api/src/security/permissions/         # Entire folder
apps/api/src/db/permissions/models_v2.py   # Merge into models.py
apps/api/src/db/permissions/generated_enums.py  # Inline into enums.py
```

---

## Success Criteria

1. ✅ No `_v2` or `V2` anywhere in codebase
2. ✅ Single `src/rbac/` folder for all RBAC code
3. ✅ Single `/api/v1/rbac/*` API path
4. ✅ `RbacService.check()` has single signature, single return type
5. ✅ Scope resolution actually checks ownership
6. ✅ All tests pass with >90% coverage on RBAC module
7. ✅ P95 permission check latency < 10ms
8. ✅ Cache hit rate > 80% in production

---

## Appendix: Quick Reference

### Current → Proposed Mapping

| Current                      | Proposed              |
| ---------------------------- | --------------------- |
| `permissions_v2` table       | `permission` table    |
| `PermissionV2` model         | `Permission` model    |
| `RBACService`                | `RbacService`         |
| `PermissionService`          | ❌ Deleted             |
| `src/services/rbac/`         | `src/rbac/`           |
| `src/services/permissions/`  | ❌ Deleted             |
| `src/routers/permissions.py` | ❌ Deleted             |
| `src/routers/rbac_v2.py`     | `src/routers/rbac.py` |
| `/api/v1/rbac/v2/check`      | `/api/v1/rbac/check`  |

### Permission Format

```
{resource}:{action}:{scope}

Examples:
  course:create:org     - Create courses in organization
  course:update:own     - Update own courses
  course:read:all       - Read all courses
  user:invite:org       - Invite users to organization
```

### Scope Definitions

| Scope      | Meaning                    | Requires                         |
| ---------- | -------------------------- | -------------------------------- |
| `all`      | Any resource of this type  | Nothing                          |
| `org`      | Resources in user's org    | `org_id` parameter               |
| `own`      | Resources user created     | `resource_id` + ownership check  |
| `assigned` | Resources assigned to user | `resource_id` + assignment check |
