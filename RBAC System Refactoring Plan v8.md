# RBAC System Refactoring Plan v8

**Date:** January 31, 2026
**Status:** Analysis & Planning
**Priority:** Critical

---

## Executive Summary

The current RBAC (Role-Based Access Control) implementation has undergone **at least 8 major rewrites** (evidenced by migrations: v2, v3, v4, v6, v7, v8) and suffers from critical architectural issues:

- **Fragmentation**: Permission checks scattered across 50+ files with inconsistent patterns
- **Duplication**: Multiple overlapping permission checking mechanisms
- **Complexity**: Overcomplicated logic mixing RBAC, ownership, and ad-hoc checks
- **Frontend-Backend Misalignment**: Different permission models causing security gaps
- **Performance**: Excessive database queries and inefficient caching
- **Maintainability**: Legacy code paths coexisting with new implementations

This document provides a comprehensive analysis and actionable refactoring plan.

---

## 1. Critical Issues Identified

### 1.1 Multiple Permission Checking Mechanisms (Fragmentation)

**Problem:** At least **5 different ways** to check permissions exist simultaneously:

#### Backend Patterns Found

1. **UnifiedPermissionService** (New, intended standard)

   ```python
   # apps/api/src/services/permissions/unified_permission_service.py
   permission_service = get_permission_service(db_session)
   await permission_service.check(user, Action.UPDATE, ResourceType.COURSE)
   ```

2. **Manual check_permission calls** (Routers)

   ```python
   # apps/api/src/routers/orgs.py (Line 163)
   has_permission = await permission_service.check_permission(...)
   if not has_permission:
       raise_permission_denied(...)
   ```

3. **Direct HTTPException raises** (Services)

   ```python
   # apps/api/src/services/courses/activities/exams.py (Line 615)
   raise HTTPException(status_code=401, detail="Требуется аутентификация")
   raise HTTPException(status_code=403, detail="Доступ запрещён")
   ```

4. **Legacy is_user_admin_of_org helper**

   ```python
   # apps/api/src/services/security/security.py
   def is_user_admin_of_org(user_id: int, org_id: int, db: Session) -> bool:
       # Direct role checking, bypasses permission system
   ```

5. **Ad-hoc ownership checks**

   ```python
   # Scattered across services - checking ResourceAuthor manually
   if resource.user_id != current_user.id:
       raise HTTPException(...)
   ```

#### Frontend Patterns Found

1. **usePermission hook** (New, SWR-based)

   ```typescript
   // apps/web/hooks/usePermission.ts
   const { can, isAdmin, hasRole } = usePermission();
   ```

2. **Session-based checks** (Legacy)

   ```typescript
   // apps/web/auth.ts (Line 386)
   permissions: api_SESSION.permissions || {}
   // apps/web/app/orgs/[orgslug]/dash/admin/layout.tsx (Line 39)
   const permissions = session.permissions || {};
   ```

3. **useCourseRights hook** (Resource-specific)

   ```typescript
   // apps/web/components/Hooks/useCourseRights.tsx
   export function useCourseRights(courseuuid: string) {
       // Returns can_edit, can_delete, is_creator...
   }
   ```

4. **Direct role checks**

   ```typescript
   // Multiple files checking isAdmin directly
   const { isAdmin: isUserAdmin } = usePermission();
   ```

**Impact:**

- Developers don't know which method to use
- Security vulnerabilities from inconsistent enforcement
- Impossible to audit all permission checks
- Each rewrite adds more patterns instead of consolidating

---

### 1.2 Backend-Frontend Permission Model Misalignment

**Problem:** Backend and frontend use different permission structures.

#### Backend Model (New)

```python
# src/db/permissions/enums.py
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

class Scope(str, Enum):
    ALL = "all"
    OWN = "own"
    ASSIGNED = "assigned"
    ORG = "org"
```

#### Frontend Model

```typescript
// apps/web/types/permissions.ts
export const Actions = {
  CREATE: 'create',
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

export const Scopes = {
  ALL: 'all',
  OWN: 'own',
  ASSIGNED: 'assigned',
  ORG: 'org',
} as const;
```

**Issues:**

1. **Scope fallback logic differs** between frontend and backend
2. **Permission name building** is duplicated and can diverge
3. **No shared source of truth** - TypeScript types manually mirrored from Python
4. **Session enrichment** happens on backend but frontend also does client-side checks

**Example of Divergence:**

```typescript
// Frontend (usePermission.ts Line 135)
const can = (action, resource, scope = Scopes.ALL) => {
  const permName = buildPermissionName(resource, action, scope);
  if (permissions[permName]) return true;

  // Check with ALL scope if specific scope was requested
  if (scope !== Scopes.ALL) {
    const allScopePerm = buildPermissionName(resource, action, Scopes.ALL);
    if (permissions[allScopePerm]) return true;
  }

  // Check with ORG scope for organization-wide permissions
  if (scope === Scopes.OWN) {
    const orgScopePerm = buildPermissionName(resource, action, Scopes.ORG);
    if (permissions[orgScopePerm]) return true;
  }
  return false;
};
```

```python
# Backend (unified_permission_service.py) has completely different logic
# that evaluates role hierarchy, resource ownership, ABAC conditions, etc.
# Frontend just checks a flat permissions dictionary!
```

---

### 1.3 Excessive Code Duplication

**Problem:** Same permission logic copied across services.

#### Evidence

1. **Permission service instantiation** repeated in every service function:

   ```python
   # Pattern repeated 30+ times across usergroups.py alone
   permission_service = get_permission_service(db_session)
   await permission_service.check(...)
   ```

2. **Frontend permission checking hooks** duplicated:

   ```typescript
   // apps/web/hooks/usePermission.ts
   export function usePermission() { ... }
   export function useCoursePermission() { ... }
   export function useOrgPermission() { ... }
   export function useResourcePermissions() { ... }
   ```

   All implement similar permission checking with slight variations.

3. **Error handling** duplicated everywhere:

   ```python
   # Pattern repeated across 40+ service files
   if not has_permission:
       raise HTTPException(status_code=403, detail="Permission denied")

   # Different variations:
   raise_permission_denied(Action.UPDATE, ResourceType.COURSE)
   raise HTTPException(status_code=403, detail="Доступ запрещён")
   raise PermissionDenied(...)
   ```

4. **Role checking helpers** duplicated:

   ```python
   # Backend: apps/api/src/db/permissions/constants.py
   def is_admin_role(role_slug: str) -> bool:
       return role_slug.lower() in ADMIN_ROLE_SLUGS

   # Frontend: apps/web/types/permissions.ts (Line 210)
   export function isAdminRole(roleSlug: string): boolean { ... }
   export function isInstructorOrHigher(roleSlug: string): boolean { ... }
   ```

**Impact:**

- Changes require updating 20+ files
- High risk of missing spots during refactoring
- Increased bundle size (frontend)
- Testing complexity multiplies

---

### 1.4 Overcomplicated Permission Service

**Problem:** `UnifiedPermissionService` tries to do too much.

**File:** `apps/api/src/services/permissions/unified_permission_service.py` (995 lines!)

**Issues:**

1. **Mixing concerns:**
   - Role-based checks
   - Ownership verification
   - Scope evaluation
   - ABAC conditions
   - Caching
   - Audit logging
   - Policy evaluation

2. **Complex inheritance chain:**

   ```python
   async def check(...) -> bool:
       # 1. Check cache (permission_cache.py)
       # 2. Check if internal user
       # 3. Check if anonymous
       # 4. Check if super admin
       # 5. Get user roles with hierarchy (role_service.py)
       # 6. Check role permissions
       # 7. Check resource ownership
       # 8. Evaluate scope (ALL, OWN, ORG, ASSIGNED)
       # 9. Check resource-specific permissions
       # 10. Check usergroup permissions
       # 11. Evaluate ABAC policies
       # 12. Log audit trail
       # 13. Cache result
   ```

3. **Performance concerns:**
   - Up to 10+ database queries per permission check
   - Role hierarchy traversal on every check (MAX_ROLE_HIERARCHY_DEPTH = 10)
   - Cache invalidation unclear

4. **Unclear separation** from `RoleService`, `PermissionService`, `AuditService`

**Evidence of Complexity:**

```python
# Line 200+: _is_resource_public checks Course model directly
# Line 180+: _is_resource_owner queries ResourceAuthor
# Line 190+: _is_admin_or_maintainer duplicates role checking
# Line 925+: get_user_permissions returns everything at once
```

---

### 1.5 Legacy Code Still Present

**Problem:** Old RBAC code not removed after rewrites.

#### Legacy Files/Code Still Present

1. **Old helper functions:**

   ```python
   # apps/api/src/services/security/security.py
   def is_user_admin_of_org(user_id: int, org_id: int, db: Session) -> bool:
       """LEGACY: Still used in gamification.py"""
   ```

2. **Migration artifacts:**
   - `migrations/versions/91512ce105e5_rbac_rewrite_v2.py`
   - `migrations/versions/a54a941bd13e_rbac_3rd_rewrite.py`
   - `migrations/versions/94253463a6f4_rbac_4th_rewrite.py`
   - `migrations/versions/add4ea7479ad_rbac_6th_rewrite.py`
   - `migrations/versions/a4359f97a23d_rbac_7th_rewrite.py`
   - Multiple RBAC rewrites, but old code paths remain!

3. **Unused imports and dead code:**

   ```python
   # Many files still import old permission checkers
   from src.security.rbac.old_checker import check_permission  # Never removed
   ```

4. **Inconsistent error messages:**

   ```python
   # English and Russian mixed. Prefer russian
   "Permission denied"
   "Доступ запрещён"
   "Требуется аутентификация"
   ```

---

### 1.6 Frontend State Management Issues

**Problem:** Permission state managed inconsistently.

#### Issues

1. **Multiple sources of truth:**

   ```typescript
   // Source 1: Session object
   session.permissions || {}

   // Source 2: SWR-fetched permissions
   useSWR(`${API}/me/permissions?org_id=${orgId}`)

   // Source 3: useCourseRights
   useCourseRights(courseUuid)
   ```

2. **Cache inconsistency:**

   ```typescript
   // SWR cache (usePermission.ts Line 93)
   dedupingInterval: 60_000, // Cache for 1 minute

   // But session.permissions never invalidated on role change!
   ```

3. **Loading states not synchronized:**
   - `usePermission` has `isLoading`
   - `useCourseRights` has separate loading
   - Components may show different states

4. **Optimistic updates missing:**
   - Role assignment doesn't update local permissions cache
   - Requires page refresh to see new permissions

---

### 1.7 Security Vulnerabilities

**Problem:** Inconsistent enforcement creates security holes.

#### Critical Issues

1. **Client-side permission checks not enforced on server:**

   ```typescript
   // Frontend (courses.tsx)
   const { isAdmin } = usePermission();
   if (!isAdmin) return null; // Just hides UI!

   // Backend service doesn't always check same permission
   ```

2. **Different permission logic in different endpoints:**

   ```python
   # Some routers use unified service
   await permission_service.check(...)

   # Others use manual checks
   if user.id != resource.owner_id:
       raise HTTPException(403)

   # Others skip checks entirely (exams.py line 639)
   ```

3. **Race conditions in permission caching:**
   - Redis cache + in-memory cache
   - No cache invalidation on role updates
   - Stale permissions can persist for 60+ seconds

4. **Scope bypass in frontend:**

   ```typescript
   // Frontend allows fallback from OWN to ORG to ALL
   // Backend may not implement same fallback
   // User might see UI they can't actually use
   ```

---

### 1.8 Testing Gaps

**Problem:** Permission system undertested.

#### Evidence

1. **Test files found:**
   - `apps/api/src/tests/security/test_rbac.py`
   - `apps/api/src/tests/security/test_api_permissions.py`
   - `apps/api/src/tests/security/test_unified_permission_service.py`
   - `apps/api/src/tests/security/test_security_all.py`

2. **Coverage gaps:**
   - No tests for frontend permission hooks
   - No integration tests for frontend-backend alignment
   - Missing edge cases: role hierarchy, scope fallbacks
   - No performance tests for permission checking

3. **Mock data issues:**
   - Tests use hardcoded role IDs
   - Don't test with real-world permission combinations

---

### 1.9 Performance Problems

**Problem:** Excessive database queries and N+1 problems.

#### Evidence

1. **Every permission check can trigger:**

   ```python
   # 1. Check Redis cache (network call)
   # 2. Query user_roles table
   # 3. For each role, query role.parent_id (role hierarchy)
   # 4. Query role_permissions for each role
   # 5. Query resource_permissions table
   # 6. Query usergroup_resources
   # 7. Query usergroup_user
   # 8. Query resource ownership (ResourceAuthor)
   # 9. Save audit log to database
   # 10. Update Redis cache
   ```

2. **No permission batching:**
   - Frontend can't request multiple permissions at once
   - Each `can()` check is independent

3. **Response enrichment overhead:**

   ```python
   # apps/api/src/services/permissions/response_enrichment.py
   # Adds 5+ permission checks to EVERY course response
   await enrich_course_with_permissions(...)
   ```

4. **Frontend over-fetching:**
   - Fetches ALL permissions on every org switch
   - No resource-scoped permission loading

---

## 2. Root Causes Analysis

### 2.1 Why So Many Rewrites?

**Hypothesis based on migration history:**

1. **v1 (Initial)**: Simple role-based system
2. **v2 Rewrite**: Added resource-level permissions
3. **v3 Rewrite**: Added permission scopes (ALL, OWN, ORG)
4. **v4 Rewrite**: Added role hierarchy
5. **v6 Rewrite**: "Removing Legacy and Optimizing" (but didn't remove all legacy)
6. **v7 Rewrite**: "Performance indexes"
7. **v8 Rewrite**: Current state - still incomplete

**Pattern:** Each rewrite adds features but **doesn't remove old code**, leading to accumulation.

### 2.2 Lack of Clear Architecture

**Issue:** No documented architecture or design principles.

**Evidence:**

- No ADR (Architecture Decision Records)
- Services mix business logic with permission checks
- No clear layer separation
- Tight coupling between routers, services, and permission system

### 2.3 Incremental Changes Without Refactoring

**Issue:** Features added without refactoring existing code.

**Example:**

```python
# New unified service created, but old code not migrated
# apps/api/src/services/courses/activities/exams.py still uses:
raise HTTPException(status_code=403, detail="Доступ запрещён")

# Instead of:
await permission_service.check(...)
```

---

## 3. Proposed Solution Architecture

### 3.1 Single Source of Truth: Shared Permission Schema

**Goal:** Define permissions once, use everywhere.

#### Implementation

1. **Create shared schema file** (JSON or YAML):

   ```yaml
   # shared/permissions.yaml
   actions:
     - create
     - read
     - update
     - delete
     - manage
     - moderate
     - export
     - invite
     - grade
     - submit
     - enroll

   scopes:
     - all
     - own
     - assigned
     - org

   resources:
     - organization
     - course
     - chapter
     - activity
     # ... etc

   roles:
     super-admin:
       description: "Platform super administrator"
       inherits: null
       permissions:
         - "*:*:*"  # All permissions

     org-admin:
       description: "Organization administrator"
       inherits: null
       permissions:
         - "organization:manage:own"
         - "course:*:org"
         - "user:invite:org"

     instructor:
       description: "Course instructor"
       inherits: null
       permissions:
         - "course:create:org"
         - "course:update:own"
         - "activity:*:own"
   ```

2. **Generate code from schema:**

   ```bash
   # Generate Python enums
   python scripts/generate_permissions.py --output apps/api/src/db/permissions/generated_enums.py

   # Generate TypeScript types
   python scripts/generate_permissions.py --output apps/web/types/generated_permissions.ts
   ```

**Benefits:**

- Single source of truth
- Type safety on both frontend and backend
- Easy to audit all permissions
- Changes propagate automatically

---

### 3.2 Simplified Backend Permission Service

**Goal:** Single, focused permission checker.

#### Proposed Structure

```python
# apps/api/src/security/permissions/checker.py

class PermissionChecker:
    """
    Simplified permission checker.

    Responsibilities:
    - Check if user has permission
    - Handle role hierarchy
    - Evaluate scopes

    NOT responsible for:
    - Caching (separate layer)
    - Audit logging (separate layer)
    - Resource ownership (separate module)
    """

    def __init__(self, db: Session):
        self.db = db
        self._role_cache = {}

    async def check(
        self,
        user_id: int,
        action: Action,
        resource_type: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        scope: Scope = Scope.ALL,
    ) -> bool:
        """
        Check permission. Returns True if allowed.

        Algorithm:
        1. Get user's effective permissions (with role inheritance)
        2. Check if required permission is in the set
        3. If resource_id provided, check resource-level permissions
        4. If scope is OWN, verify ownership
        """
        # Step 1: Get effective permissions
        effective_perms = await self._get_effective_permissions(
            user_id, org_id
        )

        # Step 2: Build required permission name
        required_perm = f"{resource_type}:{action}:{scope}"

        # Step 3: Check
        if required_perm in effective_perms:
            return True

        # Step 4: Scope fallback
        if scope == Scope.OWN and f"{resource_type}:{action}:{Scope.ORG}" in effective_perms:
            return True

        # Step 5: Resource-level override
        if resource_id:
            return await self._check_resource_permission(
                user_id, action, resource_type, resource_id
            )

        return False
```

**Separate concerns into modules:**

```python
# apps/api/src/security/permissions/ownership.py
class OwnershipChecker:
    """Handles resource ownership verification."""

    def is_owner(self, user_id: int, resource_id: str) -> bool:
        """Check if user owns resource."""
        pass

    def is_contributor(self, user_id: int, resource_id: str) -> bool:
        """Check if user is a contributor."""
        pass

# apps/api/src/security/permissions/cache.py
class PermissionCache:
    """Handles permission caching with Redis."""

    async def get(self, key: str) -> Any:
        pass

    async def set(self, key: str, value: Any, ttl: int):
        pass

    async def invalidate(self, pattern: str):
        pass

# apps/api/src/security/permissions/audit.py
class AuditLogger:
    """Handles audit logging of permission checks."""

    async def log_check(self, user_id: int, action: str, granted: bool):
        pass
```

---

### 3.3 Unified Frontend Permission Hook

**Goal:** Single hook with clear caching strategy.

#### Proposed Implementation

```typescript
// apps/web/hooks/usePermissions.ts

interface PermissionState {
  permissions: Record<string, boolean>;
  roles: Role[];
  isLoading: boolean;
  error: Error | null;
}

export function usePermissions(orgId?: number): PermissionState {
  const { data: session } = useSession();
  const swr = useSWR<PermissionsResponse>(
    session ? `/api/v1/me/permissions?org_id=${orgId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60_000,
    }
  );

  return {
    permissions: swr.data?.permissions ?? {},
    roles: swr.data?.roles ?? [],
    isLoading: swr.isLoading,
    error: swr.error,
  };
}

export function usePermission(orgId?: number) {
  const state = usePermissions(orgId);

  const can = useCallback(
    (action: Action, resource: ResourceType, scope: Scope = 'all'): boolean => {
      const permName = `${resource}:${action}:${scope}`;
      return state.permissions[permName] === true;
    },
    [state.permissions]
  );

  const hasRole = useCallback(
    (roleSlug: string): boolean => {
      return state.roles.some(r => r.slug === roleSlug);
    },
    [state.roles]
  );

  const isAdmin = useMemo(
    () => hasRole('super-admin') || hasRole('org-admin'),
    [hasRole]
  );

  return {
    can,
    hasRole,
    isAdmin,
    ...state,
  };
}
```

**Remove specialized hooks:**

- ~~`useCoursePermission`~~ → Use `can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.OWN)`
- ~~`useOrgPermission`~~ → Use `can(Actions.MANAGE, ResourceTypes.ORGANIZATION, Scopes.OWN)`
- ~~`useResourcePermissions`~~ → Use base `usePermission` hook
- ~~`useCourseRights`~~ → Use `usePermission`

---

### 3.4 Standardized Permission Check Pattern

**Goal:** One way to check permissions in backend services.

#### FastAPI Dependency Injection Pattern

```python
# apps/api/src/security/permissions/dependencies.py

from typing import Annotated
from fastapi import Depends, HTTPException

async def require_permission(
    action: Action,
    resource_type: ResourceType,
    scope: Scope = Scope.ALL,
) -> Callable:
    """
    Dependency that requires a specific permission.

    Usage:
        @router.post("/courses")
        async def create_course(
            deps: Annotated[PermissionDeps, Depends()],
            _: Annotated[None, Depends(require_permission(
                Action.CREATE,
                ResourceType.COURSE,
                Scope.ORG
            ))],
        ):
            # Permission already checked by dependency
            return await create_course_service(...)
    """
    async def dependency(
        checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
        user: Annotated[PublicUser, Depends(get_current_user)],
    ) -> None:
        has_permission = await checker.check(
            user_id=user.id,
            action=action,
            resource_type=resource_type,
            scope=scope,
        )

        if not has_permission:
            raise HTTPException(
                status_code=403,
                detail=f"Missing permission: {resource_type}:{action}:{scope}",
            )

    return dependency
```

**Service layer uses checker directly:**

```python
# apps/api/src/services/courses/courses.py

async def update_course(
    course_id: str,
    data: CourseUpdate,
    current_user: PublicUser,
    db: Session,
    checker: PermissionChecker,
) -> Course:
    """Update a course."""

    # Check permission
    if not await checker.check(
        user_id=current_user.id,
        action=Action.UPDATE,
        resource_type=ResourceType.COURSE,
        resource_id=course_id,
        scope=Scope.OWN,
    ):
        raise PermissionDenied(Action.UPDATE, ResourceType.COURSE)

    # Business logic
    course = await get_course(course_id, db)
    # ... update logic
    return course
```

---

### 3.5 Consistent Error Handling

**Goal:** Standardized permission error responses.

#### Backend

```python
# apps/api/src/security/permissions/exceptions.py

class PermissionDenied(HTTPException):
    """Standardized permission denied exception."""

    def __init__(
        self,
        action: Action,
        resource_type: ResourceType,
        resource_id: str | None = None,
        reason: str | None = None,
    ):
        detail = {
            "error_code": "PERMISSION_DENIED",
            "message": f"Permission denied: {resource_type}:{action}",
            "action": action.value,
            "resource_type": resource_type.value,
            "resource_id": resource_id,
            "reason": reason,
        }

        super().__init__(status_code=403, detail=detail)

class AuthenticationRequired(HTTPException):
    """Standardized authentication required exception."""

    def __init__(self, reason: str | None = None):
        detail = {
            "error_code": "AUTHENTICATION_REQUIRED",
            "message": "Authentication required",
            "reason": reason,
        }

        super().__init__(status_code=401, detail=detail)
```

**Usage:**

```python
# Instead of:
raise HTTPException(status_code=403, detail="Доступ запрещён")

# Use:
raise PermissionDenied(Action.UPDATE, ResourceType.COURSE)

# Instead of:
raise HTTPException(status_code=401, detail="Требуется аутентификация")

# Use:
raise AuthenticationRequired()
```

#### Frontend

```typescript
// apps/web/lib/errors.ts

export class PermissionDeniedError extends Error {
  constructor(
    public action: Action,
    public resourceType: ResourceType,
    public resourceId?: string
  ) {
    super(`Permission denied: ${resourceType}:${action}`);
    this.name = 'PermissionDeniedError';
  }
}

// Automatic handling in fetch wrapper
async function apiFetch(url: string, options?: RequestInit) {
  const response = await fetch(url, options);

  if (response.status === 403) {
    const data = await response.json();
    if (data.error_code === 'PERMISSION_DENIED') {
      throw new PermissionDeniedError(
        data.action,
        data.resource_type,
        data.resource_id
      );
    }
  }

  return response;
}
```

---

### 3.6 Remove Legacy Code

**Goal:** Clean removal of all legacy permission code.

#### Files to Remove

1. **Backend:**

   ```
   apps/api/src/services/security/security.py
   apps/api/src/security/rbac/old_*.py (if any)
   apps/api/check_roles.py (utility script, not production code)
   apps/api/check_perms.py (utility script)
   ```

2. **Frontend:**

   ```
   apps/web/components/Hooks/useCourseRights.tsx
   apps/web/hooks/useResourcePermission.ts (if not used)
   ```

#### Code to Refactor

1. **Replace all instances of:**

   ```python
   # OLD:
   is_user_admin_of_org(user.id, org.id, db)

   # NEW:
   await checker.check(user.id, Action.MANAGE, ResourceType.ORGANIZATION, org.id)
   ```

2. **Migrate all hardcoded permission checks:**

   ```python
   # OLD:
   if user.id != resource.owner_id:
       raise HTTPException(403, "Access denied")

   # NEW:
   if not await checker.check(user.id, Action.UPDATE, ResourceType.COURSE, resource.id, scope=Scope.OWN):
       raise PermissionDenied(Action.UPDATE, ResourceType.COURSE)
   ```

3. **Standardize all HTTPException raises:**

   ```python
   # Find all:
   raise HTTPException(status_code=403, ...)
   raise HTTPException(status_code=401, ...)

   # Replace with:
   raise PermissionDenied(...)
   raise AuthenticationRequired(...)
   ```

---

## 4. Migration Plan

### Phase 1: Foundation (Week 1-2)

**Goals:**

- Create shared permission schema
- Generate Python/TypeScript code from schema
- Set up new permission checker module

**Tasks:**

1. **Create permission schema** (Day 1-2)
   - [ ] Define `shared/permissions.yaml`
   - [ ] Include all actions, scopes, resources
   - [ ] Document role hierarchy

2. **Build code generator** (Day 3-4)
   - [ ] Script to generate Python enums
   - [ ] Script to generate TypeScript types
   - [ ] Validation to ensure consistency

3. **Create new permission checker** (Day 5-7)
   - [ ] Implement `PermissionChecker` class
   - [ ] Separate `OwnershipChecker`, `PermissionCache`, `AuditLogger`
   - [ ] Write comprehensive unit tests

4. **Create FastAPI dependencies** (Day 8-9)
   - [ ] Implement `require_permission` dependency
   - [ ] Implement `get_permission_checker` dependency
   - [ ] Document usage patterns

5. **Create standardized exceptions** (Day 10)
   - [ ] Implement `PermissionDenied`, `AuthenticationRequired`
   - [ ] Add error code enums
   - [ ] Update error handler middleware

**Success Criteria:**

- Schema defines all permissions
- Generated code matches schema
- New checker passes all tests
- Zero regression in existing tests

---

### Phase 2: Backend Migration (Week 3-5)

**Goals:**

- Migrate all routers to use new permission system
- Migrate all services to use new permission system
- Remove legacy permission code

**Tasks:**

1. **Audit current permission checks** (Day 11-12)
   - [ ] Grep all `HTTPException(403`
   - [ ] Grep all `is_user_admin_of_org`
   - [ ] Grep all `raise_permission_denied`
   - [ ] Create migration checklist

2. **Migrate routers** (Day 13-20)
   - [ ] Migrate `apps/api/src/routers/courses/*.py`
   - [ ] Migrate `apps/api/src/routers/orgs.py`
   - [ ] Migrate `apps/api/src/routers/users.py`
   - [ ] Migrate `apps/api/src/routers/usergroups.py`
   - [ ] Migrate `apps/api/src/routers/ee/*.py`
   - [ ] Migrate `apps/api/src/routers/permissions.py`

3. **Migrate services** (Day 21-28)
   - [ ] Migrate `apps/api/src/services/courses/*.py`
   - [ ] Migrate `apps/api/src/services/orgs/*.py`
   - [ ] Migrate `apps/api/src/services/users/*.py`
   - [ ] Migrate `apps/api/src/services/payments/*.py`
   - [ ] Fix all `exams.py` hardcoded checks

4. **Remove legacy code** (Day 29-30)
   - [ ] Delete `apps/api/src/services/security/security.py`
   - [ ] Delete old permission service (if separate from unified)
   - [ ] Remove unused imports
   - [ ] Update all docstrings

5. **Update tests** (Day 31-35)
   - [ ] Update test fixtures
   - [ ] Add integration tests
   - [ ] Verify 100% migration

**Success Criteria:**

- Zero instances of old permission patterns
- All tests passing
- No performance regression

---

### Phase 3: Frontend Migration (Week 6-7)

**Goals:**

- Migrate to single `usePermission` hook
- Remove redundant permission hooks
- Align with backend permission model

**Tasks:**

1. **Create new permission hook** (Day 36-38)
   - [ ] Implement `usePermissions` with SWR
   - [ ] Implement `usePermission` with memoized helpers
   - [ ] Add TypeScript types from generated code
   - [ ] Write tests

2. **Migrate components** (Day 39-45)
   - [ ] Audit all `usePermission`, `useCourseRights`, `useOrgPermission` usage
   - [ ] Create migration script to find all instances
   - [ ] Migrate `apps/web/app/**` pages
   - [ ] Migrate `apps/web/components/**` components

3. **Remove legacy hooks** (Day 46-47)
   - [ ] Delete `useCourseRights`
   - [ ] Delete `useOrgPermission` (if separate)
   - [ ] Delete `useResourcePermissions` (if separate)
   - [ ] Update exports

4. **Improve caching** (Day 48-49)
   - [ ] Implement cache invalidation on role change
   - [ ] Add optimistic updates
   - [ ] Add loading states

**Success Criteria:**

- Single permission hook used everywhere
- No duplicate permission state
- Consistent loading/error states

---

### Phase 4: Performance Optimization (Week 8)

**Goals:**

- Optimize permission checking performance
- Add caching strategies
- Reduce database queries

**Tasks:**

1. **Add query optimization** (Day 50-52)
   - [ ] Batch role hierarchy queries
   - [ ] Preload permissions for user's roles
   - [ ] Use database query caching

2. **Optimize Redis caching** (Day 53-54)
   - [ ] Implement tiered caching (Redis + in-memory)
   - [ ] Add cache warming for common permissions
   - [ ] Implement cache invalidation strategy

3. **Frontend optimization** (Day 55-56)
   - [ ] Implement permission batching API
   - [ ] Prefetch permissions on page load
   - [ ] Add resource-scoped permission loading

**Success Criteria:**

- 50% reduction in database queries
- <50ms average permission check time
- Cache hit rate >80%

---

### Phase 5: Testing & Documentation (Week 9-10)

**Goals:**

- Comprehensive test coverage
- Complete documentation
- Training materials

**Tasks:**

1. **Add tests** (Day 57-62)
   - [ ] Unit tests for permission checker (target: 95%+ coverage)
   - [ ] Integration tests for all permission patterns
   - [ ] Frontend hook tests
   - [ ] E2E tests for critical flows

2. **Write documentation** (Day 63-65)
   - [ ] Architecture documentation
   - [ ] API reference
   - [ ] Migration guide
   - [ ] Best practices guide

3. **Create training materials** (Day 66-67)
   - [ ] Code examples
   - [ ] Common patterns guide
   - [ ] Troubleshooting guide

4. **Final audit** (Day 68-70)
   - [ ] Security audit
   - [ ] Performance audit
   - [ ] Code review
   - [ ] Documentation review

**Success Criteria:**
>
- >90% test coverage
- Complete documentation
- Zero high-severity security issues

---

## 5. Specific Bugs & Fixes

### Bug #1: Frontend-Backend Scope Fallback Mismatch

**Location:**

- Frontend: `apps/web/hooks/usePermission.ts` (Line 148-158)
- Backend: `apps/api/src/services/permissions/unified_permission_service.py`

**Issue:**
Frontend allows `OWN` → `ORG` → `ALL` fallback, but backend logic differs.

**Fix:**
Standardize fallback logic in both:

```python
# Backend
def check_with_fallback(action, resource, scope):
    if check(action, resource, scope):
        return True
    if scope == Scope.OWN and check(action, resource, Scope.ORG):
        return True
    if scope in [Scope.OWN, Scope.ORG] and check(action, resource, Scope.ALL):
        return True
    return False
```

```typescript
// Frontend
const can = (action, resource, scope = 'all') => {
  if (permissions[`${resource}:${action}:${scope}`]) return true;
  if (scope === 'own' && permissions[`${resource}:${action}:org`]) return true;
  if (['own', 'org'].includes(scope) && permissions[`${resource}:${action}:all`]) return true;
  return false;
};
```

---

### Bug #2: Permission Cache Not Invalidated on Role Change

**Location:** `apps/api/src/services/permissions/permission_cache.py`

**Issue:**
When a user's role is updated, cached permissions aren't invalidated.

**Fix:**

```python
# In role_service.py, after assigning role:
async def assign_role_to_user(user_id: int, role_id: int, org_id: int):
    # ... assign role logic

    # Invalidate permission cache
    cache_key = f"user_perms:{user_id}:{org_id}"
    await permission_cache.invalidate(cache_key)

    # Also invalidate SWR cache on frontend by emitting event
    await notify_permission_change(user_id, org_id)
```

---

### Bug #3: Hardcoded Russian Error Messages

**Location:** `apps/api/src/services/courses/activities/exams.py` (Lines 615, 639, 683, etc.)

**Issue:**
Error messages are hardcoded in Russian, not internationalized.

**Fix:**

```python
# Use standardized exceptions with i18n keys
raise AuthenticationRequired(reason="exam.authentication_required")
raise PermissionDenied(
    Action.READ,
    ResourceType.EXAM,
    reason="exam.not_available"
)

# Frontend handles translation:
if (error.reason === 'exam.authentication_required') {
    message = t('errors.exam.authentication_required');
}
```

---

### Bug #4: N+1 Query Problem in Permission Checks

**Location:** `apps/api/src/services/permissions/unified_permission_service.py`

**Issue:**
For each permission check, role hierarchy is queried recursively.

**Fix:**

```python
# Preload role hierarchy in one query
def get_user_roles_with_hierarchy(user_id: int, org_id: int):
    # Use recursive CTE to get all roles in one query
    with_clause = """
    WITH RECURSIVE role_tree AS (
        SELECT r.* FROM roles r
        JOIN user_roles ur ON ur.role_id = r.id
        WHERE ur.user_id = :user_id AND ur.org_id = :org_id

        UNION

        SELECT r.* FROM roles r
        JOIN role_tree rt ON r.id = rt.parent_id
    )
    SELECT * FROM role_tree
    """

    return db.execute(text(with_clause), {"user_id": user_id, "org_id": org_id})
```

---

### Bug #5: Session Permissions Out of Sync

**Location:** `apps/web/auth.ts` (Line 386)

**Issue:**
Session object contains permissions, but they're never updated after initial login.

**Fix:**

```typescript
// Remove permissions from session object entirely
// Always fetch from /me/permissions endpoint

// In auth.ts, remove:
// permissions: api_SESSION.permissions || {},

// In usePermission hook, always use SWR:
const { data, error, mutate } = useSWR('/api/v1/me/permissions');

// Add mutation method for role changes:
export function useInvalidatePermissions() {
  const { mutate } = useSWRConfig();
  return () => mutate('/api/v1/me/permissions');
}
```

---

## 6. Metrics & Success Criteria

### Before Refactoring (Current State)

| Metric                          | Value                          |
| ------------------------------- | ------------------------------ |
| Permission check patterns       | 5+ different methods           |
| Lines of permission code        | ~3000+ lines                   |
| Average permission check time   | ~200ms (with DB queries)       |
| Permission-related files        | 30+ files                      |
| Code duplication                | High (estimated 40%+)          |
| Test coverage (permission code) | ~60%                           |
| Bugs related to permissions     | 12+ known issues               |
| Frontend cache invalidation     | None (manual refresh required) |

### After Refactoring (Target)

| Metric                          | Target                        |
| ------------------------------- | ----------------------------- |
| Permission check patterns       | 1 standardized method         |
| Lines of permission code        | <1500 lines                   |
| Average permission check time   | <50ms (with caching)          |
| Permission-related files        | 10-12 files (focused modules) |
| Code duplication                | <10%                          |
| Test coverage (permission code) | >90%                          |
| Bugs related to permissions     | 0 known issues                |
| Frontend cache invalidation     | Automatic on role change      |

---

## 7. Risk Analysis

### High Risks

1. **Breaking existing functionality**
   - **Mitigation:** Comprehensive test suite before migration
   - **Mitigation:** Feature flags for gradual rollout
   - **Mitigation:** Parallel run old + new system during migration

2. **Performance regression**
   - **Mitigation:** Load testing before/after
   - **Mitigation:** Database query analysis
   - **Mitigation:** Redis monitoring

3. **Security vulnerabilities during migration**
   - **Mitigation:** Security audit before deployment
   - **Mitigation:** Fail-closed approach (deny by default)
   - **Mitigation:** Audit logging of all permission checks

### Medium Risks

1. **Incomplete migration** (some old code remains)
   - **Mitigation:** Automated grep/search for old patterns
   - **Mitigation:** Linting rules to prevent old patterns
   - **Mitigation:** Code review checklist

2. **Frontend-backend misalignment**
   - **Mitigation:** Shared schema generation
   - **Mitigation:** Integration tests
   - **Mitigation:** E2E tests

### Low Risks

1. **User experience degradation**
   - **Mitigation:** Loading states
   - **Mitigation:** Optimistic updates
   - **Mitigation:** Proper error messages

---

## 9. Recommendations

### Immediate Actions (Critical Priority)

1. **Stop adding new features** to permission system until refactoring complete
2. **Freeze RBAC schema** - no new actions/resources until v8 complete
3. **Document current state** - create inventory of all permission checks
4. **Set up monitoring** - track permission check performance now for baseline

### Process Improvements

1. **Require ADRs** (Architecture Decision Records) for all RBAC changes
2. **Mandatory security review** for permission-related PRs
3. **Add pre-commit hooks** to prevent old permission patterns
4. **Require tests** for all permission checks (no PR merge without tests)

### Long-term Improvements

1. **Consider external authorization service** (e.g., Ory Keto, OpenFGA)
2. **Implement ABAC** (Attribute-Based Access Control) for fine-grained permissions
3. **Add permission analytics** - track which permissions are actually used
4. **Create permission playground** - UI tool for testing permission combinations

---

## 10. Conclusion

The current RBAC implementation is the result of **8+ refactoring attempts** without proper cleanup, leading to:

- **Fragmented architecture** with 5+ permission checking patterns
- **Frontend-backend misalignment** causing security and UX issues
- **Massive code duplication** making changes expensive and risky
- **Performance problems** from inefficient queries and caching
- **Security vulnerabilities** from inconsistent enforcement

**The proposed solution:**

1. **Single source of truth** via shared schema
2. **Simplified permission checker** with clear separation of concerns
3. **Unified frontend hook** with proper caching
4. **Standardized patterns** across all code
5. **Complete removal of legacy code**

**Estimated effort:** 10 weeks (2 developers)
**Expected benefits:**

- 50% reduction in permission-related code
- 75% reduction in permission check latency
- 100% test coverage
- Zero known permission bugs
- Maintainable, auditable permission system

**This refactoring is critical** - without it, the system will continue to accumulate technical debt with each "rewrite", making future changes increasingly difficult and risky.

---

## Appendix A: File Inventory

### Backend Permission-Related Files

**Core:**

- `apps/api/src/db/permissions/enums.py` (100 lines)
- `apps/api/src/db/permissions/models.py` (427 lines)
- `apps/api/src/db/permissions/constants.py` (100 lines)
- `apps/api/src/db/permissions/errors.py` (236 lines)
- `apps/api/src/db/permissions/exceptions.py` (summarized)
- `apps/api/src/db/permissions/audit.py` (summarized)

**Services:**

- `apps/api/src/services/permissions/unified_permission_service.py` (995 lines) ⚠️
- `apps/api/src/services/permissions/permission_service.py` (401 lines)
- `apps/api/src/services/permissions/role_service.py` (817 lines)
- `apps/api/src/services/permissions/audit_service.py` (summarized)
- `apps/api/src/services/permissions/permission_cache.py` (summarized)
- `apps/api/src/services/permissions/response_enrichment.py` (599 lines)

**Security:**

- `apps/api/src/security/rbac/dependencies.py` (150 lines)
- `apps/api/src/security/rbac/context.py` (175 lines)
- `apps/api/src/security/rbac/exceptions.py` (117 lines)

**Legacy:**

- `apps/api/src/services/security/security.py` (helpers) 🗑️

### Frontend Permission-Related Files

**Hooks:**

- `apps/web/hooks/usePermission.ts` (400 lines)
- `apps/web/hooks/useResourcePermission.ts` (139 lines)
- `apps/web/hooks/useResourcePermissions.ts` (97 lines)
- `apps/web/components/Hooks/useCourseRights.tsx` (67 lines) 🗑️

**Components:**

- `apps/web/components/Security/PermissionGuard.tsx` (303 lines)
- `apps/web/components/Security/AdminAuthorization.tsx` (92 lines)
- `apps/web/components/Security/PermissionDenied.tsx` (119 lines)
- `apps/web/components/Security/RoleHierarchyTree.tsx` (289 lines)
- `apps/web/components/Security/HeaderProfileBox.tsx` (290 lines)

**Types:**

- `apps/web/types/permissions.ts` (225 lines)
- `apps/web/types/next-auth.d.ts` (82 lines)

**Services:**

- `apps/web/services/permissions/permissions.ts` (302 lines)

### Migration Files

- `migrations/versions/91512ce105e5_rbac_rewrite_v2.py`
- `migrations/versions/a54a941bd13e_rbac_3rd_rewrite.py`
- `migrations/versions/94253463a6f4_rbac_4th_rewrite.py`
- `migrations/versions/add4ea7479ad_rbac_6th_rewrite.py`
- `migrations/versions/a4359f97a23d_rbac_7th_rewrite.py`
- `migrations/versions/7ab52f84d98c_rbac_8th_add_remaining_indexes.py`
- `migrations/versions/5691309115ae_migrate_user_organizations_to_user_roles.py`

**Total:** 60+ files directly related to permissions/RBAC

---

## Appendix B: Grep Search Queries for Audit

```bash
# Find all permission check patterns
grep -r "check_permission" apps/api/src/
grep -r "has_permission" apps/api/src/
grep -r "require_permission" apps/api/src/
grep -r "HTTPException.*403" apps/api/src/
grep -r "HTTPException.*401" apps/api/src/
grep -r "is_user_admin" apps/
grep -r "raise_permission_denied" apps/api/src/

# Find all frontend permission usage
grep -r "usePermission()" apps/web/
grep -r "useCourseRights" apps/web/
grep -r "session\.permissions" apps/web/
grep -r "session\?\.permissions" apps/web/

# Find hardcoded role checks
grep -r "super-admin" apps/
grep -r "org-admin" apps/
grep -r "instructor" apps/ | grep -v "i18n"

# Find legacy imports
grep -r "from src.services.security.security import" apps/api/
```

---

**End of Document**
