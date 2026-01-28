# RBAC System Frontend-Backend Alignment Plan

## Executive Summary

This document outlines a comprehensive plan to resolve frontend-backend misalignments in the RBAC (Role-Based Access Control) system. The system has undergone a major backend refactoring from a legacy "rights-based" model to a modern permission-based RBAC system, but the frontend has not been fully updated to align with these changes. Remove all legacy, backward compat, duplicated code

**Status**: The backend has migrated to a new permission system, but the frontend still expects and uses legacy patterns in many places.

**Impact**: Medium to High - Affects authorization, role management, and user experience across the platform.

---

## 1. Current State Analysis

### 1.1 Backend (API) - New System ✅

**Location**: `apps/api/src/db/permissions/`, `apps/api/src/services/permissions/`

**Key Components**:

- **Enums** (`enums.py`):
  - `Action`: CREATE, READ, UPDATE, DELETE, MANAGE, MODERATE, EXPORT, INVITE, GRADE, SUBMIT, ENROLL
  - `ResourceType`: 19 resource types (organization, course, chapter, activity, etc.)
  - `Scope`: ALL, OWN, ASSIGNED, ORG
  - `AuditAction`, `AuditLevel`, `PermissionErrorCode`

- **Models** (`models.py`):
  - `Permission`: Individual permission definitions with name format `resource:action:scope`
  - `Role`: New role model with hierarchy support, org_id, parent_role_id, slug, priority
  - `RolePermission`: Junction table for role-permission assignments
  - `UserRole`: User-role assignments per organization
  - `ResourcePermission`: Resource-level permission overrides

- **Services**:
  - `UnifiedPermissionService`: Main entry point for all RBAC checks
  - `RoleService`: Role management and hierarchy
  - `PermissionService`: Permission CRUD operations
  - `AuditService`: Permission audit logging
  - `PermissionCache`: Redis caching for performance

- **API Endpoints** (`routers/permissions.py`):
  - `GET /permissions/me/permissions` - Get user's effective permissions
  - `POST /permissions/check` - Batch permission checks
  - `GET /roles`, `POST /roles`, `PUT /roles/{id}`, `DELETE /roles/{id}` - Role management
  - `GET /roles/{id}/permissions` - Get role permissions

**Migration Status**:

- ✅ Database migration completed
- ✅ Old `rights` column removed from role table
- ✅ New permission system seeded with base permissions
- ✅ Role permissions migrated from JSON `rights` to `role_permissions` table

### 1.2 Frontend (Web) - Partial Update ⚠️

**Location**: `apps/web/types/permissions.ts`, `apps/web/hooks/usePermission.ts`, `apps/web/services/permissions/`

**Current Implementation**:

**Types** (`types/permissions.ts`):

- ✅ Modern permission types (Action, ResourceType, Scope enums)
- ✅ `Permission`, `Role`, `RoleWithPermissions` interfaces
- ✅ `UserPermissionsResponse` interface
- ✅ Helper functions: `buildPermissionName()`, `parsePermissionName()`
- ✅ `CommonPermissions` constant with pre-built permission names

**Hook** (`hooks/usePermission.ts`):

- ✅ Uses SWR to fetch permissions from `GET /permissions/me/permissions`
- ✅ Implements `can(action, resource, scope)` method
- ✅ Role checking methods: `hasRole()`, `isAdmin()`, `isInstructor()`
- ⚠️ Falls back to session permissions for backward compatibility
- ⚠️ Still uses legacy session role structure in places

**Service** (`services/permissions/permissions.ts`):

- ✅ `fetchUserPermissions()` - Calls new API endpoint
- ✅ `batchCheckPermissions()` - Batch permission checks
- ⚠️ Not widely used across the codebase

### 1.3 Legacy System Remnants ❌

**Backend Legacy** (Being Phased Out):

- `apps/api/src/services/roles/roles.py` - Still references old validation patterns
- `apps/api/src/security/rbac/rbac.py` - Old RBAC functions still in use
- Various service files still use `authorization_verify_based_on_roles_and_authorship()`

**Issues**:

1. **Old RBAC functions** still widely used instead of `UnifiedPermissionService`
2. **Role model confusion**: Both old `role` table and new `roles` table references
3. **Rights-based logic**: Some services still check `user_role.rights` dictionary
4. **Hardcoded role IDs**: Checks like `role.id in [1, 2]` for admin detection

---

## 2. Identified Misalignments

### 2.1 Critical Issues 🔴

#### Issue 1: Dual Permission Systems

**Problem**: Backend has both old RBAC functions (`rbac.py`) and new `UnifiedPermissionService`, causing inconsistency.

**Location**:

- `apps/api/src/security/rbac/rbac.py` - Old system
- `apps/api/src/services/permissions/unified_permission_service.py` - New system
- Multiple services import from both

**Impact**: Inconsistent permission checks, potential security gaps

**Example**:

```python
# Old pattern (still used in many places)
await authorization_verify_based_on_roles_and_authorship(
    request, user_id, "update", course_uuid, db_session
)

# New pattern (should be used)
await permission_service.check(
    user=current_user,
    action=Action.UPDATE,
    resource=ResourceType.COURSE,
    resource_id=course_uuid,
    org_id=org_id,
)
```

#### Issue 2: Session-Based vs API-Based Permissions in Frontend

**Problem**: Frontend relies on JWT session permissions instead of fetching from API consistently.

**Location**:

- `apps/web/hooks/usePermission.ts` - Lines 98-107 (fallback logic)

**Impact**: Stale permissions, cache issues, inconsistent UX

**Code**:

```typescript
const permissions = useMemo(() => {
  if (permissionsData?.permissions) {
    return permissionsData.permissions;
  }
  // Fallback to session permissions (LEGACY - should be removed)
  return session?.permissions ?? {};
}, [permissionsData?.permissions, session?.permissions]);
```

#### Issue 3: Hardcoded Role IDs

**Problem**: Services use hardcoded role IDs (1, 2) instead of role slugs.

**Location**:

- `apps/api/src/services/roles/roles.py` - Multiple locations
- `apps/api/src/security/rbac/rbac.py` - Lines 186, etc.

**Impact**: Breaks if role IDs change, not database-agnostic

**Example**:

```python
# Bad - Hardcoded IDs
if role.id in [1, 2]:  # Assuming 1 and 2 are admin role IDs
    return True

# Good - Use slugs
if role.slug in ['super-admin', 'org-admin']:
    return True
```

### 2.2 High Priority Issues 🟠

#### Issue 4: Inconsistent Permission Check Patterns

**Problem**: Frontend permission checks don't always match backend logic.

**Details**:

- Backend uses scope-based evaluation (ALL > ORG > OWN > ASSIGNED)
- Frontend checks scopes but doesn't properly cascade
- Resource ownership not always factored in frontend checks

#### Issue 5: Missing Resource-Level Permissions

**Problem**: Backend supports `resource_permissions` table for resource-specific overrides, but frontend doesn't use them.

**Impact**: Cannot implement fine-grained per-resource permissions in UI

#### Issue 6: Incomplete Migration from "Rights" to "Permissions"

**Problem**: Some backend services still expect `role.rights` JSON structure.

**Location**:

- `apps/api/src/services/roles/roles.py` - Lines 79-95 (permission validation)
- `apps/api/src/tests/security/test_rbac.py` - Test fixtures use old Rights models

### 2.3 Medium Priority Issues 🟡

#### Issue 7: Permission Cache Not Used by Frontend

**Problem**: Backend has Redis caching for permissions, but frontend doesn't leverage it effectively.

**Impact**: Unnecessary API calls, slower performance

#### Issue 8: Audit Logging Not Integrated

**Problem**: Backend has comprehensive audit logging, but frontend doesn't trigger or display audit events.

**Impact**: No visibility into permission denials for users/admins

#### Issue 9: Role Hierarchy Not Exposed to Frontend

**Problem**: Backend supports role inheritance (`parent_role_id`), but frontend doesn't understand or display it.

**Impact**: Cannot show role relationships in UI

#### Issue 10: Batch Permission Checks Underutilized

**Problem**: Frontend has `batchCheckPermissions()` but still makes individual permission checks in many places.

**Impact**: More API calls than necessary, slower page loads

---

## 3. Migration Strategy

### 3.1 Phase 1: Backend Consolidation (Week 1-2)

**Goal**: Standardize all backend permission checks to use `UnifiedPermissionService`.

#### Tasks

**1.1 Deprecate Old RBAC Functions**

- [ ] Create adapter layer in `rbac.py` that wraps `UnifiedPermissionService`
- [ ] Add deprecation warnings to old functions
- [ ] Update documentation

**1.2 Migrate Service Files**

- [ ] `apps/api/src/services/roles/roles.py` - Replace old permission checks
- [ ] `apps/api/src/services/users/users.py` - Use new service
- [ ] `apps/api/src/services/orgs/orgs.py` - Use new service
- [ ] `apps/api/src/services/courses/courses.py` - Use new service
- [ ] `apps/api/src/security/courses_security.py` - Consolidate with new service

**1.3 Remove Hardcoded Role IDs**

- [ ] Replace all `role.id in [1, 2]` with `role.slug in ADMIN_SLUGS`
- [ ] Use constants from `apps/api/src/db/permissions/constants.py`

**1.4 Update Tests**

- [ ] Migrate test fixtures from old Rights models to new Permission models
- [ ] Add tests for `UnifiedPermissionService`
- [ ] Remove deprecated RBAC function tests

### 3.2 Phase 2: Frontend Permission System Overhaul (Week 3-4)

**Goal**: Update frontend to fully use new permission API and remove legacy code.

#### Tasks

**2.1 Remove Session Permission Fallback**

- [ ] Update `usePermission.ts` to only use API-fetched permissions
- [ ] Remove fallback to `session?.permissions`
- [ ] Handle loading states properly

**2.2 Implement Resource-Level Permissions**

- [ ] Add `useResourcePermission(resourceType, resourceId)` hook
- [ ] Fetch resource permissions from backend
- [ ] Integrate with existing permission checks

**2.3 Add Permission Denial Feedback**

- [ ] Create `PermissionDenied` component
- [ ] Show why permission was denied (role, scope, etc.)
- [ ] Link to audit logs for admins

**2.4 Optimize Batch Checks**

- [ ] Identify pages that check multiple permissions
- [ ] Replace individual checks with `batchCheckPermissions()`
- [ ] Add caching layer in frontend

**2.5 Add Role Hierarchy UI**

- [ ] Create role tree visualization component
- [ ] Show inherited permissions
- [ ] Allow selecting parent roles when creating roles

### 3.3 Phase 3: API Alignment (Week 5)

**Goal**: Ensure all API endpoints consistently use new permission system.

#### Tasks

**3.1 Audit API Endpoints**

- [ ] List all endpoints that perform permission checks
- [ ] Verify they use `UnifiedPermissionService` or dependency injection
- [ ] Document permission requirements in OpenAPI schema

**3.2 Add Permission Metadata to Responses**

- [ ] Include `can_update`, `can_delete` flags in resource responses
- [ ] Add `available_actions` array to show what user can do
- [ ] Frontend can hide/show buttons based on this

**3.3 Standardize Error Responses**

- [ ] Use `PermissionErrorCode` enum consistently
- [ ] Return detailed error messages (which permission is missing)
- [ ] Frontend can parse and display appropriately

### 3.4 Phase 4: Testing & Validation (Week 6)

**Goal**: Comprehensive testing of the unified RBAC system.

#### Tasks

**4.1 Integration Tests**

- [ ] Test permission checks across all resource types
- [ ] Test scope evaluation (ALL, ORG, OWN, ASSIGNED)
- [ ] Test role hierarchy and inheritance
- [ ] Test resource-level permission overrides

---

## 4. Detailed Technical Changes

### 4.1 Backend Changes

#### Change 1: Create Permission Service Dependency

**File**: `apps/api/src/security/rbac/dependencies.py`

**Action**: Create centralized dependency for permission service

```python
from fastapi import Depends
from sqlmodel import Session
from src.core.events.database import get_db_session
from src.services.permissions.unified_permission_service import UnifiedPermissionService

def get_permission_service(
    db_session: Session = Depends(get_db_session),
) -> UnifiedPermissionService:
    """Get permission service instance."""
    return UnifiedPermissionService(db_session)
```

#### Change 2: Deprecate Old RBAC Functions

**File**: `apps/api/src/security/rbac/rbac.py`

**Action**: Wrap old functions with new service and add warnings

```python
import warnings
from src.services.permissions import get_permission_service

async def authorization_verify_based_on_roles_and_authorship(
    request: Request,
    user_id: int,
    action: str,
    element_uuid: str,
    db_session: Session,
) -> bool:
    """
    DEPRECATED: Use UnifiedPermissionService.check() instead.
    This function is maintained for backward compatibility only.
    """
    warnings.warn(
        "authorization_verify_based_on_roles_and_authorship is deprecated. "
        "Use UnifiedPermissionService.check() instead.",
        DeprecationWarning,
        stacklevel=2,
    )

    # Get user object
    user = db_session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Map old action strings to new Action enum
    action_map = {
        "create": Action.CREATE,
        "read": Action.READ,
        "update": Action.UPDATE,
        "delete": Action.DELETE,
    }

    # Infer resource type from element_uuid
    resource_type = await check_element_type(element_uuid)
    resource_type_map = {
        "courses": ResourceType.COURSE,
        "users": ResourceType.USER,
        # ... etc
    }

    service = get_permission_service(db_session)
    return await service.check(
        user=user,
        action=action_map[action],
        resource=resource_type_map[resource_type],
        resource_id=element_uuid,
    )
```

#### Change 3: Update Role Service

**File**: `apps/api/src/services/roles/roles.py`

**Action**: Remove `rights` checks, use permission service

**Before**:

```python
if user_role.rights and isinstance(user_role.rights, dict):
    roles_rights = user_role.rights.get("roles", {})
    if not roles_rights.get("action_create", False):
        raise HTTPException(status_code=403, detail="...")
elif user_role.id not in [1, 2]:  # Hardcoded!
    raise HTTPException(status_code=403, detail="...")
```

**After**:

```python
permission_service = get_permission_service(db_session)
can_create = await permission_service.check(
    user=current_user,
    action=Action.CREATE,
    resource=ResourceType.ROLE,
    org_id=org_id,
)
if not can_create:
    raise HTTPException(
        status_code=403,
        detail="You don't have permission to create roles in this organization"
    )
```

### 4.2 Frontend Changes

#### Change 4: Remove Session Permission Fallback

**File**: `apps/web/hooks/usePermission.ts`

**Before**:

```typescript
const permissions = useMemo(() => {
  if (permissionsData?.permissions) {
    return permissionsData.permissions;
  }
  // Fallback to session permissions (for backward compatibility)
  return session?.permissions ?? {};
}, [permissionsData?.permissions, session?.permissions]);
```

**After**:

```typescript
const permissions = useMemo(() => {
  // Only use API-fetched permissions
  return permissionsData?.permissions ?? {};
}, [permissionsData?.permissions]);
```

#### Change 5: Add Resource Permission Hook

**File**: `apps/web/hooks/useResourcePermission.ts` (NEW)

```typescript
import useSWR from 'swr';
import { getAPIUrl } from '@/services/config/config';

export function useResourcePermission(
  resourceType: ResourceType,
  resourceId: string,
  accessToken?: string
) {
  const { data, error, isLoading } = useSWR(
    accessToken && resourceId
      ? `${getAPIUrl()}permissions/resource/${resourceType}/${resourceId}`
      : null,
    (url: string) => fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then(r => r.json())
  );

  return {
    permissions: data?.permissions ?? {},
    isLoading,
    error,
  };
}
```

#### Change 6: Improve Permission Denied UX

**File**: `apps/web/components/PermissionDenied.tsx` (NEW)

```typescript
interface PermissionDeniedProps {
  action: Action;
  resource: ResourceType;
  requiredPermission?: string;
  reason?: string;
}

export function PermissionDenied({
  action,
  resource,
  requiredPermission,
  reason
}: PermissionDeniedProps) {
  const { isAdmin } = usePermission();

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-5 w-5 text-red-600" />
        <h3 className="font-semibold text-red-900">Permission Denied</h3>
      </div>
      <p className="mt-2 text-sm text-red-800">
        You don't have permission to {action} {resource}.
      </p>
      {requiredPermission && (
        <p className="mt-1 text-xs text-red-700">
          Required permission: <code>{requiredPermission}</code>
        </p>
      )}
      {reason && (
        <p className="mt-1 text-xs text-red-700">
          Reason: {reason}
        </p>
      )}
      {isAdmin && (
        <Link href="/settings/roles" className="mt-2 text-sm text-blue-600 underline">
          Manage roles and permissions
        </Link>
      )}
    </div>
  );
}
```

---

## 5. Data Migration Checklist

### 5.1 Database Verification

- [ ] Verify all roles have been migrated to `roles` table
- [ ] Verify all permissions exist in `permissions` table
- [ ] Verify `role_permissions` junction table is populated
- [ ] Verify `user_roles` table has all user-role assignments
- [ ] Verify old `role` table `rights` column has been dropped

### 5.2 Data Integrity Checks

**SQL Queries to Run**:

```sql
-- Check for users without roles
SELECT u.id, u.email, u.username
FROM "user" u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL;

-- Check for roles without permissions
SELECT r.id, r.slug, r.name, COUNT(rp.permission_id) as perm_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id
HAVING COUNT(rp.permission_id) = 0;

-- Check for orphaned user_roles (role doesn't exist)
SELECT ur.*
FROM user_roles ur
LEFT JOIN roles r ON ur.role_id = r.id
WHERE r.id IS NULL;

-- Verify permission name format (should be resource:action:scope)
SELECT name FROM permissions
WHERE name NOT LIKE '%:%:%';
```

### 5.3 Session Data Migration

- [ ] Update JWT token generation to include new permission format
- [ ] Clear old Redis cache entries with legacy permission structure
- [ ] Force all users to re-authenticate to get new tokens

---


## 7. Testing Plan

### 7.1 Unit Tests

**Backend**:

- [ ] Test `UnifiedPermissionService.check()` for all resource types
- [ ] Test scope evaluation (ALL, ORG, OWN, ASSIGNED)
- [ ] Test role hierarchy and permission inheritance
- [ ] Test resource permission overrides
- [ ] Test permission caching
- [ ] Test audit logging


## 9. Documentation Updates

### 9.1 Developer Documentation

- [ ] Update RBAC architecture diagram
- [ ] Document `UnifiedPermissionService` API
- [ ] Document permission naming convention
- [ ] Document role hierarchy system
- [ ] Document scope evaluation rules
- [ ] Add code examples for common permission checks

### 9.2 API Documentation

- [ ] Update OpenAPI schema with permission requirements
- [ ] Document all permission-related endpoints
- [ ] Add examples for batch permission checks
- [ ] Document error codes and responses


---

## 10. Timeline & Resources

### 10.1 Estimated Timeline

| Phase                          | Duration    | Dependencies                |
| ------------------------------ | ----------- | --------------------------- |
| Phase 1: Backend Consolidation | 2 weeks     | Database migration complete |
| Phase 2: Frontend Overhaul     | 2 weeks     | Phase 1 complete            |
| Phase 3: API Alignment         | 1 week      | Phase 2 complete            |
| Phase 4: Testing & Validation  | 1 week      | Phase 3 complete            |
| **Total**                      | **6 weeks** |                             |

## 11. Success Criteria

### 11.1 Completion Criteria

- [ ] All backend services use `UnifiedPermissionService`
- [ ] No hardcoded role IDs in codebase
- [ ] Frontend fetches permissions from API only (no session fallback)
- [ ] All permission checks use new format (`resource:action:scope`)
- [ ] Resource-level permissions implemented
- [ ] Role hierarchy visible in UI
- [ ] Permission denied messages are user-friendly
- [ ] All tests passing
- [ ] Documentation updated

### 11.2 Acceptance Criteria

**Functional**:

- User can create/edit/delete resources according to their permissions
- Admin can manage roles and assign permissions
- Permission changes reflect immediately (within 1 minute)
- Users see appropriate UI based on permissions

**Non-Functional**:

- Permission checks complete in <50ms (p95)
- No security vulnerabilities in permission system
- No permission bypass exploits
- System handles 1000 permission checks/second

---

## 12. Risk Assessment

### 12.1 Risks

| Risk                            | Probability | Impact   | Mitigation                                      |
| ------------------------------- | ----------- | -------- | ----------------------------------------------- |
| Permission bypass vulnerability | Low         | Critical | Extensive security testing, code review         |
| Data migration errors           | Medium      | High     | Comprehensive data validation, rollback plan    |
| Performance degradation         | Medium      | Medium   | Load testing, Redis caching, query optimization |
| Frontend breaking changes       | Medium      | Medium   | Backward compatibility layer, phased rollout    |
| User confusion during migration | High        | Low      | Clear communication, user documentation         |

### 12.2 Contingency Plans

**If performance degrades**:

- Increase Redis cache TTL
- Add database indexes on permission tables
- Implement request-level permission caching

**If users are locked out**:

- Emergency admin override endpoint
- Fallback to previous permission system
- Manual role assignment via SQL

**If migration fails**:

- Execute rollback plan (Section 6)
- Investigate root cause
- Fix and retry migration

---

## 14. Post-Migration Tasks

### 14.1 Cleanup

- [ ] Remove deprecated RBAC functions from `rbac.py`
- [ ] Remove old test fixtures
- [ ] Remove backward compatibility code from frontend
- [ ] Clean up migration scripts
- [ ] Remove unused permissions from database

### 14.2 Optimization

- [ ] Analyze permission check patterns, optimize common paths
- [ ] Tune Redis cache configuration based on usage
- [ ] Add database indexes if needed
- [ ] Optimize role hierarchy queries

### 14.3 Future Enhancements

**Planned Features**:

- [ ] Time-based permissions (temporary access)
- [ ] Conditional permissions (ABAC policies)
- [ ] Permission delegation (user can grant subset of permissions)
- [ ] Permission analytics dashboard
- [ ] Permission templates for common roles

---

## 15. Conclusion

This plan provides a comprehensive roadmap for aligning the frontend and backend RBAC systems. The migration will be executed in phases to minimize risk and allow for rollback if issues arise. Success depends on thorough testing, careful data migration, and clear communication with all stakeholders.

**Key Takeaways**:

1. Backend has already migrated to new permission system
2. Frontend needs significant updates to align
3. Old RBAC functions should be deprecated, not removed immediately
