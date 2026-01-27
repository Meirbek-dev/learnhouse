# RBAC System Refactoring Plan v3

## Executive Summary

This document analyzes the current RBAC (Role-Based Access Control) implementation, identifies bugs, architectural issues, and proposes improvements for a robust, maintainable permission system.

Migration file is a54a941bd13e_rbac_3rd_rewrite.py
---

## 1. Current Architecture Overview

### 1.1 Core Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RBAC System Architecture                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────────────┐    │
│  │ PermissionChecker│───▶│   PolicyEngine   │───▶│  Permission Cache   │    │
│  │   (checker.py)   │    │ (policy_engine.py)│    │ (permission_cache.py)│   │
│  └─────────────────┘    └──────────────────┘    └─────────────────────┘    │
│           │                      │                                          │
│           │                      │                                          │
│           ▼                      ▼                                          │
│  ┌─────────────────┐    ┌──────────────────┐                               │
│  │  AuditService   │    │   RoleService    │                               │
│  │(audit_service.py)│    │ (role_service.py)│                               │
│  └─────────────────┘    └──────────────────┘                               │
│                                  │                                          │
│                                  ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                         Database Models                          │      │
│  │  Permission │ Role │ RolePermission │ UserRole │ ResourcePermission│    │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Permission Flow

```
1. Request → PermissionChecker.check()
2. Check cache (Redis) → If hit, return cached result
3. PolicyEngine.evaluate()
   a. Check resource-level permissions (most specific)
   b. Get user's active roles (filter expired)
   c. Check ownership for "own" scope
   d. Check role permissions with hierarchy
   e. Evaluate ABAC conditions
4. Cache result → AuditService.log_check()
5. Return True/False
```

---

## 2. Identified Bugs & Issues

### 2.1 Critical Bugs

#### BUG-001: Missing `org_id` Context in Permission Checks

**Location:** `service_utils.py` - Multiple `courses_rbac_check_*` functions
**Severity:** High

```python
# Current code (line 440-445):
async def courses_rbac_check(
    ...
    db_session: Session,
    require_course_ownership: bool = False,
) -> bool:
    # org_id is NOT passed to checker.check()
    if checker.check(current_user, mapped_action, ResourceType.COURSE, course_uuid):
        return True
```

**Issue:** The `org_id` parameter is never passed to `checker.check()`, breaking organization-scoped permissions.

**Fix:**

```python
# Get org_id from course if not provided
if org_id is None:
    course = db_session.exec(select(Course).where(Course.course_uuid == course_uuid)).first()
    org_id = course.org_id if course else None

if checker.check(current_user, mapped_action, ResourceType.COURSE, course_uuid, org_id):
    return True
```

---

#### BUG-002: Race Condition in Permission Cache Invalidation

**Location:** `permission_cache.py` - `invalidate_user_permissions()`
**Severity:** Medium

```python
def invalidate_user_permissions(user_id: int) -> None:
    """Invalidate all cached permissions for a user."""
    r = get_redis_client()
    if not r:
        return
    try:
        # Find and delete all keys matching pattern
        # BUG: Pattern-based deletion not shown in implementation
```

**Issue:** The function appears incomplete and doesn't show the actual key deletion pattern, which could lead to stale permissions.

---

#### BUG-003: Inconsistent Anonymous User Handling

**Location:** `checker.py` lines 119-124 and `service_utils.py` multiple locations
**Severity:** Medium

```python
# In checker.py:
user_id = user.id if hasattr(user, "id") else 0

# In service_utils.py (different approach):
is_anonymous = user_id == 0
```

**Issue:** Anonymous user detection is inconsistent:

- Some places check `isinstance(user, AnonymousUser)`
- Some check `user.id == 0`
- Some check `hasattr(user, "id")`

---

#### BUG-004: Role Table Name Mismatch

**Location:** `models.py` vs `69fd16a5d534_rbac_rewrite.py`
**Severity:** High

```python
# In models.py (line 113):
class Role(RoleBase, table=True):
    __tablename__ = "roles"

# In migration (line 64):
op.create_table(
    "roles_new",  # Different table name!
```

**Issue:** The model defines `__tablename__ = "roles"` but the migration creates `roles_new`. This will cause queries to fail.

**Fix:** Ensure consistency - either:

1. Update migration to use `roles` table name, OR
2. Update model `__tablename__` to `roles_new`

---

#### BUG-005: Resource Permission Not Included in Response

**Location:** `routers/permissions.py` line 407
**Severity:** Low

```python
return UserPermissionsResponse(
    ...
    resource_permissions=[],  # TODO: Add resource permissions
)
```

**Issue:** Resource-level permissions are never returned in the `/me/permissions` endpoint despite the system supporting them.

---

#### BUG-006: Missing Scope.ASSIGNED Implementation

**Location:** `policy_engine.py` lines 395-399
**Severity:** Medium

```python
case Scope.ASSIGNED:
    # ASSIGNED scope: for resources explicitly assigned to user
    # Currently treated same as ALL within the caller's context
    # TODO: Check assignment table when implemented
    return True
```

**Issue:** The `ASSIGNED` scope always returns `True`, effectively bypassing any assignment-based permission checks.

---

### 2.2 Design Issues

#### DESIGN-001: Dual RBAC Systems Running in Parallel

**Files:**

- `src/security/rbac/` (new system)
- `src/db/roles.py` (old Role model still exists,remove it)

**Issue:** Two RBAC systems coexist, causing confusion and potential permission leaks:

- Old `Role` model in `src/db/roles.py`
- New `Role` model in `src/db/permissions/models.py`

---

#### DESIGN-002: Hardcoded Role Slug Checks

**Location:** `service_utils.py` - `is_admin_or_maintainer()` and `has_instructor_role()`

```python
def is_admin_or_maintainer(db_session: Session, user_id: int) -> bool:
    admin_roles = {
        "admin",
        "superadmin",
        "org_admin",
        "maintainer",
        "super-admin",  # Inconsistent naming
        "org-admin",    # Inconsistent naming
    }
    return any(
        role.slug.lower() in admin_roles or role.name.lower() in admin_roles
        ...
```

**Issue:** Role slugs are hardcoded in multiple places with inconsistent naming conventions (underscores vs hyphens).

---

#### DESIGN-003: No Permission Inheritance Depth Limit

**Location:** `policy_engine.py` - `_get_role_hierarchy_ids()`

```python
def _get_role_hierarchy_ids(self, role_id: int) -> list[int]:
    ids = []
    current_id: int | None = role_id
    visited = set()  # Prevents infinite loops but no depth limit

    while current_id is not None and current_id not in visited:
        visited.add(current_id)
        ids.append(current_id)
        role = self.db.get(Role, current_id)
        current_id = role.parent_role_id if role else None

    return ids
```

**Issue:** While infinite loops are prevented, deeply nested role hierarchies could impact performance. No maximum depth is enforced.

---

#### DESIGN-004: N+1 Query Problem in Role Permission Checks

**Location:** `policy_engine.py` - `_check_role_permission()`

```python
for role_id in role_ids:
    if self._role_has_permission(
        role_id, action, resource, scope_context, context
    ):
        return True
```

**Issue:** For each role in the hierarchy, a separate database query is made. This can lead to N+1 query problems for users with many roles.

---

#### DESIGN-005: Frontend-Backend Permission Name Mismatch

**Location:** Frontend `types/permissions.ts` vs Backend `enums.py`

```typescript
// Frontend (uses kebab-case in some places):
export const RoleSlugs = {
  SUPER_ADMIN: 'super-admin',
  ORG_ADMIN: 'org-admin',
```

```python
# Backend (inconsistent):
admin_roles = {
    "admin",
    "superadmin",  # No hyphen
    "org_admin",   # Underscore
    "super-admin", # Hyphen
```

**Issue:** Role slug naming conventions are inconsistent between frontend and backend.

---

### 2.3 Security Concerns

#### SEC-001: Missing Rate Limiting on Permission Check Endpoints

**Location:** `routers/permissions.py`

**Issue:** The `/permissions/check` endpoint has no rate limiting, potentially allowing abuse for permission enumeration attacks.

---

#### SEC-003: No Audit Trail for Permission Cache Hits

**Location:** `checker.py` - `check()`

```python
# Log to audit (only significant checks, not every read)
if action != Action.READ or not result:
    self.audit_service.log_check(...)
```

**Issue:** Cache hits bypass audit logging entirely. Read operations are also skipped, which may be problematic for compliance requirements.

---

## 3. Performance Issues

### PERF-001: Redundant Database Queries

**Location:** `service_utils.py` - `rbac_check()`

```python
# Multiple functions call is_admin_or_maintainer() which queries roles
# Then checker.check() also queries roles via PolicyEngine
if is_admin_or_maintainer(db_session, user_id):  # Query 1
    return True
if checker.check(current_user, ...):  # Query 2 (repeats role fetch)
    return True
```

**Fix:** Pass pre-fetched roles to avoid redundant queries.

---

### PERF-002: Cache Key Granularity Too Fine

**Location:** `permission_cache.py`

```python
def _permission_key(...) -> str:
    base = f"rbac:perm:{user_id}:{action}:{resource}"
    if resource_id:
        base = f"{base}:{resource_id}"  # Creates unique key per resource
```

**Issue:** Creating cache keys per resource_id means frequently accessed resources won't benefit from role-level caching.

---

### PERF-003: Missing Database Indexes

**Location:** `models.py`

The `UserRole` table should have a composite index on `(user_id, org_id)` for faster lookups:

```python
__table_args__ = (
    Index("ix_user_roles_user_id", "user_id"),
    Index("ix_user_roles_org_id", "org_id"),
    # MISSING: Index("ix_user_roles_user_org", "user_id", "org_id"),
)
```

---

## 4. Improvement Recommendations

### 4.1 Short-Term Fixes (Priority: High)

| ID      | Issue                          | Action                                          | Effort |
| ------- | ------------------------------ | ----------------------------------------------- | ------ |
| FIX-001 | BUG-004 Table name mismatch    | Update model `__tablename__` to match migration | 1h     |
| FIX-002 | BUG-001 Missing org_id         | Add org_id parameter propagation                | 2h     |
| FIX-003 | DESIGN-002 Hardcoded slugs     | Create RoleSlug enum and use constants          | 4h     |
| FIX-004 | BUG-003 Anonymous handling     | Create `is_anonymous()` utility function        | 1h     |
| FIX-005 | BUG-005 Missing resource perms | Implement resource_permissions in response      | 2h     |

### 4.2 Medium-Term Improvements (Priority: Medium)

| ID      | Issue                      | Action                             | Effort |
| ------- | -------------------------- | ---------------------------------- | ------ |
| IMP-001 | PERF-001 Redundant queries | Refactor to pass pre-fetched roles | 8h     |
| IMP-002 | DESIGN-001 Dual systems    | Migrate to single RBAC system      | 16h    |
| IMP-003 | DESIGN-004 N+1 queries     | Batch role-permission lookups      | 6h     |
| IMP-004 | BUG-006 ASSIGNED scope     | Implement assignment table check   | 8h     |
| IMP-005 | PERF-003 Missing indexes   | Add composite indexes              | 2h     |

### 4.3 Long-Term Enhancements (Priority: Low)

| ID      | Issue                        | Action                             | Effort |
| ------- | ---------------------------- | ---------------------------------- | ------ |
| ENH-001 | SEC-001 Rate limiting        | Add rate limiting middleware       | 4h     |
| ENH-002 | SEC-003 Audit completeness   | Add configurable audit levels      | 8h     |
| ENH-003 | DESIGN-003 Depth limit       | Add MAX_ROLE_HIERARCHY_DEPTH       | 2h     |
| ENH-004 | SEC-002 Explicit permissions | Replace `*:*:*` with explicit list | 4h     |

---

## 5. Proposed Architectural Changes

### 5.1 Unified Role Slug Constants

Create a single source of truth for role slugs:

```python
# src/db/permissions/constants.py

from enum import StrEnum

class RoleSlug(StrEnum):
    SUPER_ADMIN = "super-admin"
    ORG_ADMIN = "org-admin"
    MAINTAINER = "maintainer"
    INSTRUCTOR = "instructor"
    MODERATOR = "moderator"
    USER = "user"

ADMIN_ROLE_SLUGS = frozenset({
    RoleSlug.SUPER_ADMIN,
    RoleSlug.ORG_ADMIN,
})

INSTRUCTOR_OR_HIGHER_SLUGS = frozenset({
    RoleSlug.SUPER_ADMIN,
    RoleSlug.ORG_ADMIN,
    RoleSlug.MAINTAINER,
    RoleSlug.INSTRUCTOR,
})
```

### 5.2 Simplified Permission Checker Interface

```python
# Proposed simplified interface
class PermissionChecker:
    def can(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource: ResourceType,
        *,
        resource_id: str | None = None,
        org_id: int | None = None,
        owner_id: int | None = None,  # NEW: Pre-computed ownership
    ) -> bool:
        """Check permission with optional pre-computed ownership."""
        ...
```

### 5.3 Batch Permission Fetching

```python
def get_user_effective_permissions(
    self,
    user_id: int,
    org_id: int | None = None,
) -> EffectivePermissions:
    """
    Single query to get all user's effective permissions.

    Returns:
        EffectivePermissions with:
        - roles: List of active roles
        - permissions: Dict of permission_name -> bool
        - resource_permissions: List of resource-specific overrides
    """
    # Single optimized query with JOINs
    ...
```

---

## 8. Checklist

### Critical Fixes

- [x] Fix BUG-004: Role table name mismatch (already fixed in migration 91512ce105e5)
- [x] Fix BUG-001: Add org_id to permission checks
- [x] Fix BUG-003: Standardize anonymous user detection
- [x] Fix BUG-005: Resource permissions in /me/permissions response
- [x] Fix BUG-006: Implement ASSIGNED scope with UserGroupResource
- [x] Fix PERF-003: Add composite indexes

### Performance Improvements

- [x] Fix N+1 queries: Batch role-permission lookups in PolicyEngine
- [x] Add MAX_ROLE_HIERARCHY_DEPTH limit (10 levels)

### Security Enhancements

- [x] Add rate limiting to /permissions/check endpoints (60/min batch, 120/min single)
- [x] Add configurable audit levels (AuditLevel enum)

### Code Quality

- [x] Create RoleSlug enum and constants
- [x] Remove hardcoded role slug strings
- [ ] Add type hints where missing
- [ ] Add docstrings to public methods

### Documentation

- [ ] Document permission naming convention
- [ ] Document role hierarchy rules
- [ ] Add API documentation for permission endpoints
- [ ] Create permission troubleshooting guide

---

## 9. Appendix

### A. Current Permission Names Format

```
{resource_type}:{action}:{scope}

Examples:
- course:create:org
- course:read:all
- course:update:own
- user:invite:org
```

### B. Default System Roles

| Slug        | Priority | Parent     | Description               |
| ----------- | -------- | ---------- | ------------------------- |
| super-admin | 100      | -          | Platform-wide full access |
| org-admin   | 90       | -          | Organization full control |
| maintainer  | 70       | org-admin  | Content management        |
| instructor  | 50       | maintainer | Course creation           |
| moderator   | 40       | org-admin  | Community moderation      |
| user        | 10       | -          | Standard user             |

### C. Files Modified Summary

| File                                                     | Changes                                                        |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| `src/db/permissions/constants.py`                        | NEW - RoleSlug enum and helper functions                       |
| `src/db/permissions/__init__.py`                         | Export constants, AuditLevel                                   |
| `src/db/permissions/enums.py`                            | Add AuditLevel enum                                            |
| `src/db/permissions/models.py`                           | Add composite index to UserRole                                |
| `src/security/rbac/service_utils.py`                     | Add is_anonymous, get_user_id, use constants, add org_id       |
| `src/security/rbac/checker.py`                           | Configurable audit levels, use standardized utilities          |
| `src/security/rbac/__init__.py`                          | Export new utilities                                           |
| `src/services/permissions/policy_engine.py`              | Batch queries, ASSIGNED scope, MAX_ROLE_HIERARCHY_DEPTH        |
| `src/services/permissions/role_service.py`               | Use RoleSlug constants in seed_default_roles                   |
| `src/routers/permissions.py`                             | Rate limiting, resource_permissions in response                |
| `migrations/versions/a54a941bd13e_rbac_3rd_rewrite.py`   | Add composite indexes migration                                |

---
