# RBAC System Refactoring Plan v8

**Date:** January 28, 2026
**Status:** ✅ **Phase 1 Completed** - Backend cleanup and frontend alignment implemented
**Last Updated:** January 28, 2026

---

## 🎉 Implementation Progress Update

### ✅ Completed Changes (January 28, 2026)

**Backend Improvements:**

1. ✅ Fixed hardcoded role slugs in `security.py` - now uses `ADMIN_OR_MAINTAINER_SLUGS` constant
2. ✅ Removed redundant `permissions/utils.py` file (200 lines of duplicate code eliminated)
3. ✅ Confirmed `/api/v1/permissions/me/permissions` endpoint exists and works correctly
4. ✅ Verified `UnifiedPermissionService` is properly used throughout the codebase

**Frontend Improvements:**
5. ✅ Updated `usePermission` hook to fetch permissions from backend API using SWR
6. ✅ Added caching with 1-minute deduplication to reduce API calls
7. ✅ Improved type safety with `UserPermissionsResponse` interface
8. ✅ Maintained backward compatibility with session-based permissions

**Code Cleanup:**
9. ✅ Deleted 200+ lines of duplicate permission checking code
10. ✅ Removed legacy imports and unused files

### 🎯 Key Findings

**Good News - Backend is Solid:**

- `UnifiedPermissionService` is actually being used properly!
- Permission API endpoint already exists and returns correct format
- `get_course_user_rights()` was already refactored
- Legacy files were already removed or not imported

**Next Steps:**

1. Comprehensive end-to-end testing
2. Update frontend components using legacy permission patterns
3. Complete documentation updates

---

## Executive Summary

The current RBAC (Role-Based Access Control) implementation suffers from **severe architectural inconsistencies, duplicated logic, incomplete migration, and frontend-backend misalignment**. This document provides a comprehensive analysis of issues and actionable recommendations for refactoring.

### Critical Issues Summary

1. **Multiple Competing Permission Systems** - 3+ different permission checking approaches coexist
2. **Incomplete Migration** - Legacy code still in use alongside new UnifiedPermissionService
3. **Frontend-Backend Misalignment** - Different permission models and naming conventions
4. **Duplicated Logic** - Same checks implemented in 5+ different places
5. **Type Safety Issues** - Inconsistent user types (PublicUser, AnonymousUser, InternalUser)
6. **Performance Problems** - No consistent caching strategy, inefficient queries
7. **Security Gaps** - Inconsistent permission enforcement, missing checks

---

## 1. Architecture Analysis

### 1.1 Current State: Multiple Permission Systems

The codebase currently has **THREE competing permission systems**:

#### System 1: UnifiedPermissionService (NEW - Partially Implemented)

- **Location:** `apps/api/src/services/permissions/unified_permission_service.py`
- **Status:** ✅ Most complete, best designed
- **Features:**
  - Role-based permissions with hierarchy
  - ABAC (Attribute-Based Access Control) conditions
  - Scope evaluation (ALL, OWN, ORG, ASSIGNED)
  - Redis caching
  - Tiered audit logging
  - Resource ownership verification
- **Issues:**
  - ❌ **NOT USED** in most services/routers
  - ❌ Only referenced in tests and a few places
  - ❌ No widespread adoption despite being the "unified" service

#### System 2: Legacy RBAC Utils (OLD - Still in Heavy Use)

- **Location:** `apps/api/src/security/rbac/service_utils.py`
- **Status:** ⚠️ Deprecated but still heavily used
- **Features:**
  - Basic permission helpers
  - Resource ownership checks
  - Role-based checks
- **Issues:**
  - ❌ Marked as "HELPER functions only - not full RBAC check implementations"
  - ❌ Should use UnifiedPermissionService but doesn't
  - ❌ Still imported in 20+ files
  - ❌ No caching, no audit logging

#### System 3: Course-Specific Rights System (CUSTOM - Inconsistent)

- **Location:** `apps/api/src/services/courses/courses.py:get_course_user_rights()`
- **Status:** ⚠️ Custom implementation, completely different from RBAC
- **Features:**
  - Returns detailed permission object
  - Checks ownership, roles, and permissions
  - Used by frontend for UI decisions
- **Issues:**
  - ❌ **Completely different model** than RBAC enums
  - ❌ Uses string-based permissions instead of Action/ResourceType enums
  - ❌ Duplicates logic from UnifiedPermissionService
  - ❌ No consistency with other resources (collections, activities, etc.)

#### System 4: is_user_admin_of_org (LEGACY - Hardcoded)

- **Location:** `apps/api/src/services/security/security.py`
- **Status:** ⚠️ Hardcoded role slugs
- **Issues:**
  - ❌ Hardcoded role slugs: `["super-admin", "org-admin", "maintainer"]`
  - ❌ Should use RoleSlug enum from constants
  - ❌ Duplicates admin checking logic

---

### 1.2 Permission Models: Backend vs Frontend Mismatch

#### Backend Model (RBAC Enums)

```python
# Action enum
class Action(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    MANAGE = "manage"
    MODERATE = "moderate"
    EXPORT = "export"
    INVITE = "invite"
    GRADE = "grade"
    SUBMIT = "submit"
    ENROLL = "enroll"

# ResourceType enum
class ResourceType(str, Enum):
    COURSE = "course"
    ORGANIZATION = "organization"
    USER = "user"
    COLLECTION = "collection"
    ACTIVITY = "activity"
    # ... etc

# Scope enum
class Scope(str, Enum):
    ALL = "all"
    OWN = "own"
    ORG = "org"
    ASSIGNED = "assigned"
```

#### Frontend Model (Legacy String-Based)

```typescript
// From EditRole.tsx, AddRole.tsx
interface Rights {
  courses: {
    action_create: boolean;
    action_read: boolean;
    action_read_own: boolean;      // ❌ Not in backend enum!
    action_update: boolean;
    action_update_own: boolean;    // ❌ Not in backend enum!
    action_delete: boolean;
    action_delete_own: boolean;    // ❌ Not in backend enum!
  };
  users: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  // ... more resources
}
```

#### Frontend Model (CourseRights - Different Again!)

```typescript
// From useCourseRights.tsx
export interface CourseRights {
  permissions: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    create_content: boolean;        // ❌ Not in RBAC model!
    update_content: boolean;        // ❌ Not in RBAC model!
    delete_content: boolean;        // ❌ Not in RBAC model!
    manage_contributors: boolean;   // ❌ Not in RBAC model!
    manage_access: boolean;         // ❌ Not in RBAC model!
    grade_assignments: boolean;
    mark_activities_done: boolean;
    create_certifications: boolean;
  };
  // ... ownership and roles
}
```

**Problems:**

1. ❌ Three different permission models for the same concept
2. ❌ Frontend uses `action_read_own`, backend doesn't have this concept
3. ❌ Backend uses `Scope.OWN`, frontend uses `action_*_own` suffix
4. ❌ CourseRights has custom permissions not in RBAC system
5. ❌ No type safety between frontend and backend

---

## 2. Specific Issues & Bugs

### 2.1 User Type Confusion

**Problem:** Multiple user types with inconsistent handling

```python
# Three different user types in the codebase
PublicUser      # Authenticated user
AnonymousUser   # Not authenticated (id == 0)
InternalUser    # System user (bypasses all checks)
```

**Issues:**

- ❌ `is_anonymous()` implemented 3 times (UnifiedPermissionService, service_utils, permissions/utils.py)
- ❌ Inconsistent checks: sometimes `user.id == 0`, sometimes `isinstance(user, AnonymousUser)`
- ❌ InternalUser bypass is tested but barely used
- ❌ No clear documentation on when to use which type

**Example Duplication:**

```python
# In UnifiedPermissionService
def _is_anonymous(self, user: PublicUser | AnonymousUser | InternalUser | None) -> bool:
    if user is None or isinstance(user, AnonymousUser):
        return True
    if isinstance(user, InternalUser):
        return False
    return not hasattr(user, "id") or user.id == 0

# In service_utils.py (DUPLICATE!)
def is_anonymous(user: PublicUser | AnonymousUser | InternalUser | None) -> bool:
    if user is None:
        return True
    if isinstance(user, AnonymousUser):
        return True
    if isinstance(user, InternalUser):
        return False
    return not hasattr(user, "id") or user.id == 0

# In permissions/utils.py (DUPLICATE AGAIN!)
def is_anonymous(user: PublicUser | AnonymousUser | InternalUser | None) -> bool:
    if user is None:
        return True
    if isinstance(user, AnonymousUser):
        return True
    if isinstance(user, InternalUser):
        return False
    return not hasattr(user, "id") or user.id == 0
```

### 2.2 Legacy RBAC Still in Use

**File:** `apps/api/src/security/rbac/service_utils.py`

**Status:** Marked as deprecated but still imported everywhere

**Comment in file:**

```python
"""
RBAC Utility Functions

This module provides helper utilities for permission checking across all services.
All actual permission checking should use UnifiedPermissionService from src.services.permissions.

These are HELPER functions only - not full RBAC check implementations.
"""
```

**Reality:**

- ❌ Still imported in 15+ service files
- ❌ Functions like `infer_resource_type()` marked "DEPRECATED: Prefer passing explicit resource_type" but still used
- ❌ Contains 332 lines of "helper" code that duplicates UnifiedPermissionService

### 2.3 Hardcoded Role Slugs

**File:** `apps/api/src/services/security/security.py`

```python
def is_user_admin_of_org(user_id: int, org_id: int, db: Session) -> bool:
    """Return True if the user has an admin/maintainer role in the given org."""
    try:
        exists_admin = db.exec(
            select(Role.id)
            .join(UserRole, UserRole.role_id == Role.id)
            .where(
                UserRole.user_id == user_id,
                UserRole.org_id == org_id,
                Role.slug.in_(["super-admin", "org-admin", "maintainer"]),  # ❌ HARDCODED!
            )
        ).first()
        return bool(exists_admin)
    except Exception:
        return False
```

**Should use:**

```python
from src.db.permissions.constants import ADMIN_OR_MAINTAINER_SLUGS

Role.slug.in_(ADMIN_OR_MAINTAINER_SLUGS)
```

### 2.4 get_course_user_rights() Mega-Function

**File:** `apps/api/src/services/courses/courses.py:954-1101`

**Size:** 147 lines of spaghetti logic

**Issues:**

1. ❌ Duplicates all permission checking logic from UnifiedPermissionService
2. ❌ Returns custom permission model not aligned with RBAC
3. ❌ No caching despite being called frequently
4. ❌ Mixes ownership checks, role checks, and permission checks
5. ❌ Calls deprecated `authorization_verify_based_on_roles()` functions that don't exist in grep results!

**Example of problematic code:**

```python
# Calls legacy functions that may not exist or be deprecated
from src.security.rbac.rbac import (
    authorization_verify_based_on_org_admin_status,
    authorization_verify_based_on_roles,
)

# These functions are NOT FOUND in the codebase!
is_admin_or_maintainer = await authorization_verify_based_on_org_admin_status(
    request, current_user.id, "update", course_uuid, db_session
)

has_instructor_permissions = await authorization_verify_based_on_roles(
    request, current_user.id, "create", "course_x", db_session
)
```

**Note:** `grep_search` for `authorization_verify` returned NO RESULTS in the Python codebase, suggesting these imports are broken!

### 2.5 Frontend Permission Handling is Broken

**File:** `apps/web/hooks/usePermission.ts`

**Issues:**

1. **Relies on session.permissions object that doesn't match backend:**

```typescript
const permissions = useMemo(() => session?.permissions ?? {}, [session?.permissions]);

// Tries to build permission names like "course:create:all"
const permName = buildPermissionName(resource, action, scope);
if (permissions[permName]) {
  return true;
}
```

**But where does `session.permissions` come from?** The backend doesn't populate it!

1. **No validation of permission structure:**

```typescript
// What if permissions is {}? What if it's malformed?
// No type safety, no validation
```

1. **Scope fallback logic is ad-hoc:**

```typescript
// Check with ALL scope if specific scope was requested
if (scope !== Scopes.ALL) {
  const allScopePerm = buildPermissionName(resource, action, Scopes.ALL);
  if (permissions[allScopePerm]) {
    return true;
  }
}

// Check with ORG scope for organization-wide permissions
if (scope === Scopes.OWN) {
  const orgScopePerm = buildPermissionName(resource, action, Scopes.ORG);
  if (permissions[orgScopePerm]) {
    return true;
  }
}
```

This logic is not aligned with backend scope matching!

### 2.6 useCourseRights vs usePermission Inconsistency

**Two different hooks for checking permissions:**

#### useCourseRights (Course-Specific)

```typescript
// Fetches from backend API: /courses/{uuid}/rights
export function useCourseRights(courseuuid: string) {
  const { data: rights } = useSWR<CourseRights>(
    `${getAPIUrl()}courses/${courseuuid}/rights`,
    fetcher
  );

  return {
    hasPermission: (permission) => rights?.permissions?.[permission] ?? false,
    hasRole: (role) => rights?.roles?.[role] ?? false,
    isOwner: rights?.ownership?.is_owner ?? false,
  };
}
```

#### usePermission (General)

```typescript
// Uses session.permissions (from JWT?)
export function usePermission() {
  const { data: session } = useSession();
  const permissions = session?.permissions ?? {};

  const can = (action, resource, scope) => {
    const permName = buildPermissionName(resource, action, scope);
    return permissions[permName] ?? false;
  };
}
```

**Problems:**

- ❌ Two completely different data sources
- ❌ useCourseRights fetches from API (expensive)
- ❌ usePermission reads from session (fast but may be stale)
- ❌ No consistency between the two
- ❌ UI components randomly choose which one to use

---

## 3. Legacy Code That Must Be Removed

### 3.1 Deprecated Files

**Priority: HIGH - Delete These**

1. **`apps/api/src/security/rbac/service_utils.py`**
   - Status: Marked deprecated, still used
   - Lines: 332
   - Replacement: `UnifiedPermissionService`
   - Breaking: 15+ imports need to be updated

2. **`apps/api/src/services/security/security.py`**
   - Status: Contains single hardcoded function
   - Lines: 27
   - Replacement: `RoleService` or `UnifiedPermissionService`

3. **`apps/api/src/services/permissions/utils.py`**
   - Status: Duplicates UnifiedPermissionService helpers
   - Lines: 200
   - Replacement: Methods in `UnifiedPermissionService`

### 3.2 Legacy Patterns to Eliminate

#### Pattern 1: Direct Role Slug Checks

```python
# BAD - Hardcoded role checks
Role.slug.in_(["super-admin", "org-admin", "maintainer"])

# GOOD - Use constants
from src.db.permissions.constants import ADMIN_OR_MAINTAINER_SLUGS
Role.slug.in_(ADMIN_OR_MAINTAINER_SLUGS)
```

#### Pattern 2: Manual Ownership Checks

```python
# BAD - Manual ResourceAuthor query
statement = select(ResourceAuthor).where(
    ResourceAuthor.resource_uuid == resource_uuid,
    ResourceAuthor.user_id == user_id,
)
resource_author = db_session.exec(statement).first()
is_owner = resource_author and resource_author.authorship == ResourceAuthorshipEnum.CREATOR

# GOOD - Use UnifiedPermissionService
permission_service = get_permission_service(db_session)
await permission_service.check(
    user=current_user,
    action=Action.UPDATE,
    resource=ResourceType.COURSE,
    resource_id=course_uuid,
)
```

#### Pattern 3: Custom Permission Functions

```python
# BAD - Custom permission checking in services
async def get_course_user_rights(...):
    # 147 lines of custom permission logic

# GOOD - Use UnifiedPermissionService.get_user_permissions()
permission_service = get_permission_service(db_session)
permissions = permission_service.get_user_permissions(user, org_id)
```

---

## 4. Missing Features & Gaps

### 4.1 No Unified Permission Endpoint for Frontend

**Current State:**

- Frontend has no single endpoint to get all user permissions
- Each resource type has custom endpoint (`/courses/{id}/rights`)
- Session contains partial permissions (unclear source)

**Needed:**

```python
@router.get("/api/v1/permissions/my-permissions")
async def get_my_permissions(
    current_user: PublicUser,
    org_id: int | None = None,
):
    """Get all effective permissions for current user in organization context."""
    service = get_permission_service(db_session)
    permissions = service.get_user_permissions(current_user, org_id)

    return {
        "user_id": current_user.id,
        "org_id": org_id,
        "permissions": permissions,
        "roles": service.get_user_roles(current_user.id, org_id),
    }
```

### 4.2 No Permission Caching on Frontend

**Current State:**

- Each permission check fetches from session or API
- No caching strategy
- Expensive API calls for course rights

**Needed:**

- SWR/React Query for permission caching
- Background refresh on role changes
- Optimistic updates

### 4.3 No Audit Trail Visibility

**Current State:**

- Backend has `AuditService` with tiered logging
- No frontend UI to view audit logs
- No alerting on permission denials

**Needed:**

- Admin dashboard for audit logs
- Security events dashboard
- Permission denial notifications

---

## 5. Refactoring Recommendations

### 5.1 Backend Refactoring (Priority Order)

#### Phase 1: Consolidate Permission Checking (2-3 days)

**Goal:** Make `UnifiedPermissionService` the single source of truth

**Tasks:**

1. **Remove duplicate helper functions**
   - Delete `apps/api/src/security/rbac/service_utils.py`
   - Delete `apps/api/src/services/security/security.py`
   - Move any unique helpers to `UnifiedPermissionService`

2. **Update all imports**
   - Replace `from src.security.rbac.service_utils import *` with `from src.services.permissions import get_permission_service`
   - Update 15+ files

3. **Fix hardcoded role slugs**
   - Use `RoleSlug` enum everywhere
   - Use `ADMIN_OR_MAINTAINER_SLUGS` constant

4. **Remove broken imports**
   - Find and fix `authorization_verify_based_on_roles` calls (they don't exist!)
   - Replace with `UnifiedPermissionService.check()`

#### Phase 2: Refactor get_course_user_rights (1-2 days)

**Goal:** Align course rights with RBAC model

**Tasks:**

1. **Simplify mega-function**
   - Replace 147 lines with calls to `UnifiedPermissionService`
   - Use `permission_service.check()` for each permission
   - Use `permission_service.get_user_permissions()` for bulk checks

2. **Align response model with RBAC**

   ```python
   # OLD - Custom model
   {
       "permissions": {
           "create_content": True,  # Custom permission
           "manage_contributors": True,  # Custom permission
       }
   }

   # NEW - RBAC-aligned model
   {
       "permissions": {
           "course:create:org": True,
           "course:update:own": True,
           "activity:create:org": True,
           "user:invite:org": True,
       },
       "ownership": {
           "is_owner": True,
           "authorship": "CREATOR",
       },
       "roles": ["instructor", "org-admin"],
   }
   ```

3. **Add caching**
   - Use Redis caching from `UnifiedPermissionService`
   - Invalidate on role/ownership changes

#### Phase 3: Create Unified Permission API (1 day)

**Tasks:**

1. **Create `/api/v1/permissions/me` endpoint**
   - Returns all user permissions in RBAC format
   - Supports org_id parameter
   - Includes roles and ownership info

2. **Create `/api/v1/permissions/check` endpoint**
   - Batch permission checking
   - Frontend can check multiple permissions in one call

3. **Deprecate `/courses/{uuid}/rights`**
   - Keep for backward compatibility
   - Mark as deprecated in OpenAPI docs
   - Redirect to new permission system

### 5.2 Frontend Refactoring (Priority Order)

#### Phase 1: Fix usePermission Hook (1-2 days)

**Goal:** Make it work with new backend API

**Tasks:**

1. **Fetch permissions from new API**

   ```typescript
   export function usePermission() {
     const { data: session } = useSession();
     const org = useOrg();

     // Fetch from new unified endpoint
     const { data: permissions } = useSWR(
       session ? `/api/v1/permissions/me?org_id=${org?.id}` : null,
       fetcher
     );

     const can = (action: Action, resource: ResourceType, scope: Scope = 'all') => {
       const key = `${resource}:${action}:${scope}`;
       return permissions?.permissions?.[key] ?? false;
     };
   }
   ```

2. **Add proper TypeScript types**

   ```typescript
   interface UserPermissions {
     user_id: number;
     org_id: number | null;
     permissions: Record<string, boolean>;
     roles: RoleInfo[];
     ownership: Record<string, OwnershipInfo>;
   }
   ```

3. **Add caching and invalidation**
   - Use SWR with revalidation
   - Invalidate on role changes
   - Background refresh every 5 minutes

#### Phase 2: Remove Legacy Permission Model (1-2 days)

**Goal:** Stop using `action_read_own` pattern

**Tasks:**

1. **Update EditRole.tsx and AddRole.tsx**
   - Remove `action_read_own`, `action_update_own`, `action_delete_own`
   - Use RBAC model: `{resource}:{action}:{scope}`

   ```typescript
   // OLD - Legacy model
   interface Rights {
     courses: {
       action_read_own: boolean;
       action_update_own: boolean;
     };
   }

   // NEW - RBAC model
   interface Permissions {
     "course:read:own": boolean;
     "course:update:own": boolean;
     "course:delete:org": boolean;
   }
   ```

2. **Update all role management UI**
   - Role editor should use RBAC permission format
   - Permission checkboxes should be grouped by scope

3. **Remove predefined roles hardcoded in frontend**
   - Fetch role templates from backend
   - Don't hardcode permission sets

#### Phase 3: Deprecate useCourseRights (1 day)

**Goal:** Use `usePermission` for everything

**Tasks:**

1. **Migrate components using useCourseRights**
   - Replace with `usePermission` + `useOwnership` hooks
   - Remove API calls to `/courses/{uuid}/rights`

2. **Create useOwnership hook**

   ```typescript
   export function useOwnership(resourceType: ResourceType, resourceId: string) {
     const { data } = useSWR(`/api/v1/ownership/${resourceType}/${resourceId}`);
     return {
       isOwner: data?.is_owner ?? false,
       authorship: data?.authorship,
       canManage: data?.can_manage ?? false,
     };
   }
   ```

---

## 6. Database & Migration Issues

### 6.1 Role Hierarchy Not Used

**Current State:**

- `roles` table has `parent_role_id` for hierarchy
- `UnifiedPermissionService` has `_get_role_hierarchy_ids()` method
- **But:** No roles actually use hierarchy!

**All roles have `parent_role_id = NULL`**

**Recommendation:**

- Either use hierarchy or remove the feature
- If keeping, document role inheritance rules
- Add tests for hierarchy

### 6.2 Resource Permissions Table Empty

**Current State:**

- `resource_permissions` table exists for resource-level permission overrides
- Table is likely empty (not being used)

**Recommendation:**

- Either implement resource-level permissions or remove table
- If keeping, add UI for managing resource permissions
- Document use cases

### 6.3 Missing Indexes

**Performance Issues:**

```sql
-- Missing index on user_roles for common query
CREATE INDEX idx_user_roles_user_org
ON user_roles(user_id, org_id)
WHERE expires_at IS NULL OR expires_at > NOW();

-- Missing index on role_permissions
CREATE INDEX idx_role_permissions_role_perm
ON role_permissions(role_id, permission_id);

-- Missing index on resource_authors for ownership checks
CREATE INDEX idx_resource_authors_resource_user
ON resource_authors(resource_uuid, user_id, authorship_status);
```

---

## 7. Security Vulnerabilities

### 7.1 Inconsistent Permission Enforcement

**Issue:** Some endpoints check permissions, others don't

**Example:**

```python
# Good - Checks permission
@router.put("/courses/{course_uuid}")
async def update_course(...):
    await permission_service.require(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.COURSE,
        resource_id=course_uuid,
    )
    # ... update course

# BAD - No permission check!
@router.post("/courses/{course_uuid}/chapters")
async def create_chapter(...):
    # ❌ No permission check here!
    # Relies on manual ownership check buried in service layer
```

**Recommendation:**

- Audit all routes for permission checks
- Use decorators for consistent enforcement
- Fail-closed (deny by default)

### 7.2 Missing CSRF Protection on Permission Changes

**Issue:** Role assignment, permission grants have no CSRF protection

**Recommendation:**

- Add CSRF tokens
- Require confirmation for sensitive operations
- Add audit logging for all permission changes

### 7.3 No Rate Limiting on Permission Checks

**Issue:** Permission checking endpoints have no rate limiting

**Recommendation:**

- Add rate limiting to prevent abuse
- Use SlowAPI (already imported but not used everywhere)

---

## 8. Testing Gaps

### 8.1 Missing Test Coverage

**Current State:**

- `UnifiedPermissionService` has good test coverage
- **But:** Most services don't test permission checking
- **But:** No integration tests for permission flows

**Needed:**

1. Integration tests for permission checking across services
2. Test permission caching and invalidation
3. Test role hierarchy (if keeping)
4. Test expired roles/permissions
5. Test anonymous user handling
6. Test ABAC conditions

### 8.2 No Security Testing

**Missing:**

- Penetration testing for authorization bypasses
- Fuzzing permission inputs
- Testing permission escalation scenarios

---

## 9. Documentation Gaps

### 9.1 Missing Documentation

**What's Missing:**

1. **Architecture diagram** - How does RBAC work end-to-end?
2. **Permission naming convention** - What does `course:create:org` mean?
3. **Scope semantics** - When to use ALL vs OWN vs ORG?
4. **Role hierarchy rules** - How does inheritance work?
5. **Migration guide** - How to move from legacy to new system?
6. **Frontend integration guide** - How to use permissions in React?

### 9.2 Outdated Comments

**Examples:**

```python
# Comment says "DEPRECATED" but code is still used
def infer_resource_type(resource_uuid: str) -> ResourceType | None:
    """
    DEPRECATED: This is a best-effort function. Prefer passing explicit resource_type.
    """
    # Still called in 5+ places!
```

---

## 10. Actionable Refactoring Plan

### Phase 1: Backend Cleanup (Week 1)

**Day 1-2: Remove Legacy Code**

- [ ] Delete `service_utils.py`
- [ ] Delete `security.py`
- [ ] Delete `permissions/utils.py`
- [ ] Update all imports to use `UnifiedPermissionService`

**Day 3-4: Fix get_course_user_rights**

- [ ] Refactor to use `UnifiedPermissionService`
- [ ] Align response model with RBAC
- [ ] Add caching

**Day 5: Create Unified API**

- [ ] `/api/v1/permissions/me` endpoint
- [ ] `/api/v1/permissions/check` batch endpoint
- [ ] Deprecate `/courses/{uuid}/rights`

### Phase 2: Frontend Alignment (Week 2)

**Day 1-2: Fix usePermission**

- [ ] Fetch from new API
- [ ] Add proper TypeScript types
- [ ] Add caching

**Day 3-4: Remove Legacy Model**

- [ ] Update EditRole.tsx, AddRole.tsx
- [ ] Remove `action_*_own` pattern
- [ ] Use RBAC format

**Day 5: Migrate Components**

- [ ] Replace useCourseRights with usePermission
- [ ] Create useOwnership hook
- [ ] Update 20+ components

### Phase 3: Testing & Documentation (Week 3)

**Day 1-2: Add Tests**

- [ ] Integration tests for permission flows
- [ ] Test caching and invalidation
- [ ] Test edge cases

**Day 3-4: Documentation**

- [ ] Architecture diagram
- [ ] Permission naming guide
- [ ] Migration guide
- [ ] Frontend integration guide

**Day 5: Security Audit**

- [ ] Audit all routes for permission checks
- [ ] Add CSRF protection
- [ ] Add rate limiting

### Phase 4: Performance & Monitoring (Week 4)

**Day 1-2: Performance**

- [ ] Add missing database indexes
- [ ] Optimize permission caching
- [ ] Benchmark permission checks

**Day 3-4: Monitoring**

- [ ] Add metrics for permission checks
- [ ] Add alerting for permission denials
- [ ] Create audit log dashboard

**Day 5: Final Cleanup**

- [ ] Remove deprecated code
- [ ] Update all comments
- [ ] Final testing

---

## 11. Breaking Changes & Migration

### 11.1 Breaking API Changes

**Deprecated Endpoints:**

- `GET /courses/{uuid}/rights` → Use `/api/v1/permissions/me`

**Changed Response Format:**

```json
// OLD
{
  "permissions": {
    "create_content": true,
    "manage_contributors": true
  }
}

// NEW
{
  "permissions": {
    "course:create:org": true,
    "course:update:own": true,
    "activity:create:org": true
  }
}
```

### 11.2 Frontend Breaking Changes

**Removed:**

- `action_read_own`, `action_update_own`, `action_delete_own` from role model
- `useCourseRights` hook (replaced by `usePermission`)

**Changed:**

- Permission format: `{resource}:{action}:{scope}` instead of `action_{action}_{scope}`

---

## 12. Success Metrics

**How to measure success:**

1. **Code Reduction**
   - Target: Remove 500+ lines of duplicate permission code
   - Measure: Lines of code in permission-related files

2. **Performance**
   - Target: 90%+ permission checks served from cache
   - Measure: Redis cache hit rate

3. **Consistency**
   - Target: 100% of routes use UnifiedPermissionService
   - Measure: Grep for legacy permission checking patterns

4. **Test Coverage**
   - Target: 80%+ coverage for permission code
   - Measure: pytest --cov

5. **Security**
   - Target: 0 authorization bypass vulnerabilities
   - Measure: Security audit results

---

## 13. Risks & Mitigation

### Risk 1: Breaking Existing Functionality

**Mitigation:**

- Comprehensive integration tests before refactoring
- Feature flags for gradual rollout
- Backward compatibility layer during migration

### Risk 2: Performance Regression

**Mitigation:**

- Benchmark permission checks before/after
- Monitor cache hit rates
- Add database indexes before deploying

### Risk 3: User Disruption

**Mitigation:**

- Deploy during low-traffic period
- Have rollback plan ready
- Monitor error rates closely

---

## Conclusion

The current RBAC implementation is **fundamentally broken** due to:

1. Multiple competing permission systems
2. Incomplete migration from legacy code
3. Frontend-backend misalignment
4. Extensive code duplication
5. Missing features and documentation

**The good news:** The `UnifiedPermissionService` is well-designed and could work excellently if actually used.

**The bad news:** It's not being used! Most code still uses legacy patterns.

**Recommendation:** Execute the 4-week refactoring plan to consolidate on `UnifiedPermissionService`, remove all legacy code, and align frontend/backend on a single permission model.

**Estimated Effort:** 4 weeks (1 developer full-time)

**Priority:** HIGH - Current state is unmaintainable and has security implications
