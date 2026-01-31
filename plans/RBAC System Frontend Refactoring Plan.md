# RBAC System Frontend-Backend Alignment & Legacy Code Removal Plan

## Executive Summary

This plan addresses critical frontend-backend misalignments in the RBAC system and eliminates all
legacy, backward compatibility, and fallback code. The refactoring ensures a unified, secure, and
maintainable permission system across the entire application.

---

## Current State Analysis

### ✅ What Works

1. **Backend RBAC System**
   - UnifiedPermissionService with caching and audit logging
   - Role hierarchy and permission inheritance
   - Scope-based permissions (ALL, ORG, OWN, ASSIGNED)
   - Resource-level permission overrides
   - `/api/v1/permissions/*` endpoints functional

2. **Frontend Hooks**
   - `usePermission()` - Basic permission checks
   - `useBatchPermissions()` - Batch permission API calls
   - `useResourcePermission()` - Resource-specific permissions
   - Permission Guards (PermissionGuard, MultiPermissionGuard, RoleGuard)

### ❌ Critical Issues

#### 1. **Legacy User Role Structure** (HIGH PRIORITY)

**Problem:**

```tsx
// Old structure still used in OrgUsers.tsx
user.role.name; // Single role object
user.role.role_uuid; // UUID-based identification
session?.user?.role; // Single role in session
```

**Backend Reality:**

```python
# Users can have MULTIPLE roles
user_roles: list[Role]   # Array of roles
role.slug                # String-based identification
role.is_system           # System role flag
```

**Impact:**

- Frontend assumes single role per user
- Role priority calculations broken
- UI shows only one role when users may have multiple
- Role editing/assignment flows incorrect

#### 2. **Session-Based Permission Fallbacks** (SECURITY CRITICAL)

**Problem:**

```tsx
// Found in multiple files - SECURITY ISSUE
session?.permissions?.['course:create'];
session?.user?.role?.rights?.courses?.action_create;
permissions['organizations:read:org']; // Direct session access
```

**Why This is Dangerous:**

- Session data can be stale
- No real-time permission updates
- Bypasses backend validation
- Inconsistent with backend permission checks

#### 3. **Missing Response Metadata** (CRITICAL)

**Problem:** Backend endpoints don't return permission metadata in responses:

```python
# Current response
{
  "id": 123,
  "name": "My Course",
  "description": "..."
}

# Missing metadata
{
  "can_update": false,
  "can_delete": false,
  "is_owner": true,
  "available_actions": ["read", "update"]
}
```

**Impact:**

- Frontend must make separate API calls to check permissions
- Multiple round-trips for UI state
- Performance degradation
- Inconsistent UI state

#### 4. **Incomplete Permission Checks on Backend** (SECURITY CRITICAL)

From RBAC_API_AUDIT.md:

- ❌ 28 endpoints (41%) missing permission checks
- User CRUD operations unprotected
- Course management unprotected
- Payment/billing endpoints unprotected
- User groups completely lack RBAC

#### 5. **Type Misalignment**

**Frontend:**

```typescript
interface UserPermissionsResponse {
  user_id: number;
  org_id: number | null;
  roles: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
  }[];
  permissions: Record<string, boolean>;
  resource_permissions: any[]; // ❌ 'any' type
}
```

**Backend:**

```python
class ResourcePermission(SQLModel):
    id: int
    user_id: int
    resource_type: ResourceType
    resource_id: str
    permission_id: int
    granted_at: datetime
    granted_by: int | None
    expires_at: datetime | None
```

#### 6. **Hardcoded Role Names** (LOCALIZATION ISSUE)

```tsx
// In OrgUsers.tsx
if (user.role.name === 'Админ')  // ❌ Cyrillic hardcoded
```

Should use role slugs:

```tsx
if (hasRole(RoleSlugs.ORG_ADMIN))  // ✅ Slug-based
```

---

## Refactoring Plan

### Phase 1: Backend API Response Enhancement (Week 1)

**Goal:** Add permission metadata to all resource responses

#### 1.1 Create Response Mixins

**File:** `apps/api/src/db/permissions/mixins.py`

```python
from pydantic import BaseModel

class PermissionMetadataMixin(BaseModel):
    """Mixin for adding permission metadata to responses."""

    can_read: bool = True
    can_update: bool = False
    can_delete: bool = False
    can_manage: bool = False
    is_owner: bool = False
    available_actions: list[str] = []


def add_permission_metadata(
    resource: dict,
    user_id: int,
    resource_type: ResourceType,
    resource_id: str,
    permission_service: UnifiedPermissionService,
) -> dict:
    """Add permission metadata to resource response."""

    metadata = {
        "can_read": await permission_service.check(...),
        "can_update": await permission_service.check(...),
        "can_delete": await permission_service.check(...),
        "can_manage": await permission_service.check(...),
        "is_owner": check_ownership(user_id, resource_id),
        "available_actions": get_available_actions(user_id, resource_id),
    }

    return {**resource, **metadata}
```

#### 1.2 Update Response Models

**Files to Update:**

- `apps/api/src/db/courses/courses.py`
- `apps/api/src/db/activities.py`
- `apps/api/src/db/organizations.py`
- `apps/api/src/db/users.py`

**Example:**

```python
class CourseRead(CourseBase):
    id: int
    uuid: str
    created_at: datetime
    # ... other fields

    # Add permission metadata
    can_update: bool = False
    can_delete: bool = False
    can_publish: bool = False
    is_owner: bool = False
    available_actions: list[str] = []
```

#### 1.3 Update Endpoints to Include Metadata

**Pattern:**

```python
@router.get("/courses/{course_id}")
async def get_course(
    course_id: int,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    permission_service: Annotated[UnifiedPermissionService, Depends(get_permission_service)],
):
    course = get_course_from_db(course_id)

    # Add permission metadata if authenticated
    if not isinstance(current_user, AnonymousUser):
        course_dict = course.dict()
        course_dict.update({
            "can_update": await permission_service.check(
                user=current_user,
                action=Action.UPDATE,
                resource=ResourceType.COURSE,
                resource_id=str(course_id),
            ),
            "can_delete": await permission_service.check(
                user=current_user,
                action=Action.DELETE,
                resource=ResourceType.COURSE,
                resource_id=str(course_id),
            ),
            "is_owner": course.owner_id == current_user.id,
            "available_actions": await get_available_actions(
                current_user, course_id, ResourceType.COURSE
            ),
        })
        return course_dict

    return course
```

**Endpoints to Update (68 total):**

- ✅ Courses (7 endpoints)
- ✅ Activities (5 endpoints)
- ✅ Assignments (6 endpoints)
- ✅ Discussions (7 endpoints)
- ✅ Users (9 endpoints)
- ✅ Organizations (6 endpoints)
- ✅ User Groups (5 endpoints)
- ✅ Exams/Quizzes (7 endpoints)
- ✅ Payments (8 endpoints)

#### 1.4 Add Missing Permission Checks

**Priority Order:**

1. **CRITICAL** (Week 1)
   - [ ] User CRUD endpoints
   - [ ] Course CRUD endpoints
   - [ ] Payment/product endpoints
   - [ ] User group endpoints

2. **HIGH** (Week 2)
   - [ ] Activity CRUD endpoints
   - [ ] Assignment grading endpoints
   - [ ] Exam management endpoints
   - [ ] Discussion moderation endpoints

**Implementation Pattern:**

```python
@router.put("/courses/{course_id}")
async def update_course(
    course_id: int,
    course_data: CourseUpdate,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[UnifiedPermissionService, Depends(get_permission_service)],
):
    # Permission check - REQUIRED
    allowed = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.COURSE,
        resource_id=str(course_id),
    )

    if not allowed:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PERMISSION_DENIED",
                "message": "You don't have permission to update this course",
                "required_permission": "course:update:own",
            }
        )

    # Proceed with update
    return update_course_in_db(course_id, course_data)
```

---

### Phase 2: Frontend Type System Cleanup (Week 2)

**Goal:** Fix type misalignments and remove legacy structures

#### 2.1 Update Permission Types

**File:** `apps/web/types/permissions.ts`

**Remove Legacy Types:**

```typescript
// ❌ REMOVE - Single role assumption
interface User {
  role: Role; // Single role
}

// ❌ REMOVE - Nested rights structure
interface Role {
  rights: {
    courses: {
      action_create: boolean;
      action_update: boolean;
    };
  };
}
```

**Add Correct Types:**

```typescript
// ✅ ADD - Multiple roles support
interface User {
  roles: Role[]; // Multiple roles
}

// ✅ ADD - Resource permission metadata
interface ResourcePermissionMetadata {
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_manage: boolean;
  is_owner: boolean;
  available_actions: Action[];
}

// ✅ ADD - Properly typed resource permission
export interface ResourcePermission {
  id: number;
  user_id: number;
  resource_type: ResourceType;
  resource_id: string;
  permission_id: number;
  granted_at: string;
  granted_by?: number | null;
  expires_at?: string | null;
}

// ✅ UPDATE - No more 'any' types
export interface UserPermissionsResponse {
  user_id: number;
  org_id?: number | null;
  roles: Role[];
  permissions: Record<string, boolean>;
  resource_permissions: ResourcePermission[]; // Properly typed
}

// ✅ ADD - Course with metadata
export interface CourseWithMetadata extends Course {
  can_update: boolean;
  can_delete: boolean;
  can_publish: boolean;
  is_owner: boolean;
  available_actions: Action[];
}
```

#### 2.2 Remove Session Permission Fallbacks

**Files to Update:**

1. **`apps/web/components/Dashboard/Menus/DashMobileMenu.tsx`**

   ```typescript
   // ❌ REMOVE
   const permissions = session?.data?.permissions ?? {};
   const canManageOrganization =
     permissions['organizations:read:org'] === true ||
     permissions['organizations:update:org'] === true;

   // ✅ REPLACE WITH
   const { can } = usePermission();
   const canManageOrganization = can(Actions.MANAGE, ResourceTypes.ORGANIZATION);
   ```

2. **Search and Replace All Occurrences:**

   ```bash
   # Find all session permission accesses
   grep -r "session?.permissions" apps/web/
   grep -r "session?.user?.role" apps/web/
   grep -r "session.permissions" apps/web/
   ```

**Remove Patterns:**

- `session?.permissions?.[...]`
- `session?.user?.role?.rights`
- `session?.data?.permissions`
- Direct session permission access

**Replace With:**

- `usePermission()` hook
- `useBatchPermissions()` for multiple checks
- `useResourcePermission()` for resource-specific checks

#### 2.3 Fix Multi-Role Support

**File:** `apps/web/components/Dashboard/Pages/Users/OrgUsers/OrgUsers.tsx`

**Current (WRONG):**

```typescript
// ❌ Assumes single role
user.role.name;
user.role.role_uuid;

const getRolePriority = (roleObj: any) => {
  const roleName = roleObj?.name || roleObj?.role?.name || '';
  // ...
};
```

**Fixed:**

```typescript
// ✅ Multiple roles support
user.roles: Role[]  // Array of roles

const getUserHighestRole = (roles: Role[]): Role | null => {
  if (!roles || roles.length === 0) return null;

  // Sort by role priority (admin > instructor > student)
  const sorted = [...roles].sort((a, b) => {
    const priorityA = getRolePriority(a.slug);
    const priorityB = getRolePriority(b.slug);
    return priorityB - priorityA;
  });

  return sorted[0];
};

const getRolePriority = (slug: string): number => {
  const priorities: Record<string, number> = {
    [RoleSlugs.SUPER_ADMIN]: 1000,
    [RoleSlugs.ORG_ADMIN]: 900,
    [RoleSlugs.MAINTAINER]: 800,
    [RoleSlugs.INSTRUCTOR]: 700,
    [RoleSlugs.STUDENT]: 100,
  };
  return priorities[slug] ?? 0;
};

// Display all roles, not just one
const RoleBadges = ({ roles }: { roles: Role[] }) => (
  <div className="flex gap-1 flex-wrap">
    {roles.map(role => (
      <Badge key={role.id} variant={getRoleBadgeVariant(role.slug)}>
        {role.name}
      </Badge>
    ))}
  </div>
);
```

#### 2.4 Remove Hardcoded Role Names

**Find and Replace:**

```typescript
// ❌ REMOVE
if (user.role.name === 'Админ')
if (role.name === 'Admin')
if (roleName === 'Instructor')

// ✅ REPLACE WITH
if (hasRole(RoleSlugs.ORG_ADMIN))
if (hasRole(RoleSlugs.INSTRUCTOR))
if (roles.some(r => r.slug === RoleSlugs.MAINTAINER))
```

**Files to Update:**

- `apps/web/components/Dashboard/Pages/Users/OrgUsers/OrgUsers.tsx`
- `apps/web/components/Security/HeaderProfileBox.tsx`
- Any component with role name comparisons

---

### Phase 3: Remove Backward Compatibility Code (Week 3)

**Goal:** Eliminate all legacy/fallback/compatibility code

#### 3.1 Remove Legacy API Endpoints

**Backend - Delete These Files/Routes:**

- [ ] Any `/roles-new` endpoints → Use `/roles`
- [ ] Any `/permissions-new` endpoints → Use `/permissions`
- [ ] Old rights-based endpoints
- [ ] Legacy role UUID-based lookups

**Verify No Usage:**

```bash
# Search frontend for old endpoints
grep -r "roles-new" apps/web/
grep -r "permissions-new" apps/web/
grep -r "role_uuid" apps/web/
```

#### 3.2 Remove Session Permission Storage

**File:** `apps/web/auth.ts`

**Remove:**

```typescript
// ❌ REMOVE - Don't store permissions in session
session.user.permissions = await fetchUserPermissions();
session.user.role = await fetchUserRole();

// Session should ONLY contain:
// - user.id
// - user.email
// - user.name
// - tokens (access_token, refresh_token)
```

**Why:**

- Permissions should be fetched fresh from API
- Prevents stale permission data
- Reduces session payload size
- Enables real-time permission updates

#### 3.3 Remove Fallback Permission Checks

**Pattern to Find:**

```typescript
// ❌ REMOVE all instances
const permissions = data?.permissions ?? session?.permissions ?? {};
const canDo = permissions[key] ?? fallbackCheck() ?? false;

// ✅ REPLACE with single source of truth
const { can } = usePermission();
const canDo = can(action, resource);
```

#### 3.4 Clean Up Hook Implementations

**File:** `apps/web/hooks/usePermission.ts`

**Remove:**

- [ ] Any session fallback logic
- [ ] Local permission caching beyond SWR
- [ ] Compatibility shims for old structures

**Keep:**

- ✅ SWR caching (60s deduplication)
- ✅ Backend API as single source of truth
- ✅ Anonymous user handling (read-only public content)

#### 3.5 Remove Backward Compatibility Comments

**Search and Remove:**

```bash
# Find all backward compatibility comments
grep -r "backward compat" apps/
grep -r "fallback" apps/
grep -r "legacy" apps/
grep -r "TODO.*remove" apps/
grep -r "FIXME.*remove" apps/
```

**Review Each:**

- Remove code marked as "legacy"
- Remove code marked as "backward compatible"
- Remove "fallback" logic that references old systems
- Keep legitimate error fallbacks (network errors, etc.)

---

### Phase 4: UI/UX Improvements (Week 4)

**Goal:** Use permission metadata for better UX

#### 4.1 Disable Buttons Based on Metadata

**Before:**

```tsx
<Button onClick={handleDelete}>Delete Course</Button>
```

**After:**

```tsx
const course = useCourseWithMetadata(courseId);

<Button
  onClick={handleDelete}
  disabled={!course.can_delete}
  title={!course.can_delete ? "You don't have permission to delete this course" : undefined}
>
  Delete Course
</Button>;
```

#### 4.2 Conditional Rendering with Guards

**Use PermissionGuard:**

```tsx
<PermissionGuard
  action={Actions.DELETE}
  resource={ResourceTypes.COURSE}
  fallback={<DisabledDeleteButton />}
>
  <DeleteButton />
</PermissionGuard>
```

#### 4.3 Show Owner Badges

```tsx
{
  course.is_owner && <Badge variant="success">Owner</Badge>;
}
{
  !course.is_owner && course.can_update && <Badge variant="secondary">Editor</Badge>;
}
```

#### 4.4 Dynamic Action Menus

```tsx
const availableActions = course.available_actions;

<DropdownMenu>
  {availableActions.includes(Actions.UPDATE) && (
    <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
  )}
  {availableActions.includes(Actions.DELETE) && (
    <DropdownMenuItem onClick={handleDelete}>Delete</DropdownMenuItem>
  )}
  {availableActions.includes(Actions.PUBLISH) && (
    <DropdownMenuItem onClick={handlePublish}>Publish</DropdownMenuItem>
  )}
</DropdownMenu>;
```

---

### Phase 5: Testing & Validation (Week 5)

#### 5.2 Integration Tests

**Test Permission Flow:**

```python
# test_permissions_integration.py
async def test_course_update_permission_flow():
    # Create course as instructor
    course = await create_course(instructor_token)

    # Get course as student
    response = await client.get(f"/courses/{course.id}", headers=student_auth)
    course_data = response.json()

    # Verify permission metadata
    assert course_data["can_update"] == False
    assert course_data["can_delete"] == False
    assert course_data["is_owner"] == False
    assert Actions.READ in course_data["available_actions"]
    assert Actions.UPDATE not in course_data["available_actions"]

    # Verify permission enforcement
    update_response = await client.put(
        f"/courses/{course.id}",
        json={"name": "Hacked"},
        headers=student_auth
    )
    assert update_response.status_code == 403
```

#### 5.3 Security Audit

**Verify No Permission Bypasses:**

```bash
# Run security scan
python scripts/verify_rbac_refactoring.py

# Check for:
# ✓ No session.permissions access
# ✓ No session.user.role access
# ✓ All endpoints have permission checks
# ✓ No hardcoded role names
# ✓ No legacy API endpoints accessible
```

---

### Phase 6: Documentation Updates (Week 6)

#### 6.1 Update Developer Guide

**File:** `apps/web/docs/RBAC_DEVELOPER_GUIDE.md`

**Add Sections:**

- ✅ Using Response Metadata
- ✅ Multi-Role Support
- ✅ Permission Guard Best Practices
- ❌ Remove Legacy System References

**Example:**

````markdown
## Using Response Metadata

All resource responses now include permission metadata:

```tsx
const { data: course } = useCourse(courseId);

// Access permission metadata
if (course.can_update) {
  // Show edit UI
}

if (course.is_owner) {
  // Show owner badge
}

// Use available actions for dynamic menus
course.available_actions.forEach((action) => {
  // Render menu item
});
```
````

````

#### 6.2 Update Migration Guide

**File:** `apps/web/docs/RBAC_MIGRATION_GUIDE.md`

**Mark as Complete:**
- ✅ All migration steps completed
- ✅ No backward compatibility needed
- ✅ Legacy system fully deprecated

**Add Deprecation Notice:**
```markdown
## Deprecated APIs (DO NOT USE)

The following APIs have been removed:

- ❌ `session.permissions` - Use `usePermission()` hook
- ❌ `session.user.role` - Use `usePermission().roles`
- ❌ `/api/v1/roles-new` - Use `/api/v1/roles`
- ❌ `user.role` (single) - Use `user.roles` (array)
- ❌ `role.role_uuid` - Use `role.slug`
````

---

## Migration Checklist

### Backend

- [ ] Add `PermissionMetadataMixin` to response models
- [ ] Update 68 endpoints to include permission metadata
- [ ] Add missing permission checks (28 endpoints)
- [ ] Remove legacy `/roles-new` and `/permissions-new` endpoints
- [ ] Remove backward compatibility code
- [ ] Update OpenAPI documentation
- [ ] Add integration tests for metadata

### Frontend

- [ ] Fix `ResourcePermission` type (remove `any`)
- [ ] Update `User` type to support multiple roles
- [ ] Remove `session.permissions` fallbacks (all files)
- [ ] Remove `session.user.role` single role access
- [ ] Fix `OrgUsers.tsx` multi-role support
- [ ] Remove hardcoded role names (use slugs)
- [ ] Update all components to use response metadata
- [ ] Add `useResourceMetadata()` hook if needed
- [ ] Remove legacy API endpoint calls
- [ ] Update permission guards to use metadata

### Testing

- [ ] Unit tests for hooks (no session fallbacks)

### Documentation

- [ ] Update RBAC Developer Guide
- [ ] Mark Migration Guide as complete
- [ ] Add deprecation notices
- [ ] Update OpenAPI specs
- [ ] Create troubleshooting guide
- [ ] Document breaking changes

---

## Breaking Changes

### For Frontend Developers

1. **No More Session Permissions**
   - `session.permissions` is removed
   - Must use `usePermission()` hook

2. **Multiple Roles Per User**
   - `user.role` → `user.roles` (array)
   - Update UI to handle multiple roles

3. **Role Slugs Required**
   - `role.role_uuid` → `role.slug`
   - No more UUID-based role checks

4. **Response Metadata Required**
   - All resource responses now include permission metadata
   - Update TypeScript types accordingly

### For Backend Developers

1. **Permission Checks Mandatory**
   - All modification endpoints must check permissions
   - Use `UnifiedPermissionService.check()`

2. **Response Metadata Required**
   - All GET endpoints must include permission metadata
   - Use `add_permission_metadata()` helper

3. **Legacy Endpoints Removed**

---

## Success Criteria

### Functionality

- ✅ All endpoints have permission checks
- ✅ All responses include permission metadata
- ✅ Frontend uses single source of truth (API)
- ✅ Multi-role support works correctly
- ✅ No session-based permission fallbacks

### Security

- ✅ No permission bypasses possible
- ✅ All modifications require proper permissions
- ✅ Resource ownership correctly validated
- ✅ Role hierarchy properly enforced

### Performance

- ✅ <100ms permission check latency
- ✅ 50% reduction in API calls
- ✅ Effective caching (60s SWR)

### Code Quality

- ✅ No `any` types in permission system
- ✅ No hardcoded role names
- ✅ No backward compatibility code
- ✅ TypeScript strict mode passes
- ✅ All tests passing

---

## Rollout Strategy

### Phase A: Backend

1. Deploy permission metadata in responses
2. Add missing permission checks
3. Remove legacy endpoints
4. Remove duplications and fully migrate to new system and approaches
5. Monitor for errors

### Phase B: Frontend

1. Update types and hooks
2. Remove session fallbacks
3. Update components to use metadata
4. Test thoroughly in staging

### Phase C: Cleanup

1. Remove legacy endpoints
2. Remove backward compatibility code
3. Remove legacy fallbacks
4. Final security audit
5. Performance validation

### Phase D: Documentation

1. Update all documentation
2. Create migration examples
3. Announce breaking changes
4. Deploy to production

---

## Open Questions

1. **Should we batch permission checks on page load?**: Yes
   - Pro: Fewer API calls, better performance
   - Con: More complex implementation
   - Decision: Yes, implement in Phase 4

2. **How to handle permission changes in real-time?**
   - Options: WebSocket updates, polling, SWR revalidation
   - Decision: SWR revalidation every 60s + manual refresh

3. **Should anonymous users get metadata?**
   - Decision: Yes, but all `can_*` flags false except `can_read`

---

## Conclusion

This refactoring plan eliminates all frontend-backend misalignments in the RBAC system and removes
legacy/compatibility code. The result will be:

- **More Secure:** All endpoints properly protected
- **More Performant:** Fewer API calls, better caching
- **More Maintainable:** Single source of truth, clear patterns
- **Better UX:** Real-time permission updates, disabled buttons, clear feedback
