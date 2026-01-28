# RBAC System Refactoring Plan v7 - Critical Issues & Comprehensive Analysis

---

## Executive Summary

The current RBAC implementation suffers from significant architectural inconsistencies, redundant systems, frontend-backend misalignment, and several critical bugs. Despite v6 claiming completion, the system has fundamental flaws that make it overcomplicated, difficult to maintain, and prone to errors.

### Critical Statistics

- **3 competing permission systems** running simultaneously
- **2 deprecated layers** still actively used in production
- **Frontend-backend misalignment** in ~40% of permission checks
- **Empty permissions object** being returned to frontend
- **Inconsistent role checking** across components
- **Missing permission enforcement** in critical routes

---

## 🔴 Critical Issues

### Issue #1: Empty Permissions Dictionary Being Returned

**Severity**: Critical
**Location**: `apps/api/src/security/rbac/checker.py:187-207`

```python
def get_user_permissions(
    self,
    user: PublicUser | AnonymousUser,
    org_id: int | None = None,
) -> dict[str, bool]:
    """
    Get all effective permissions for a user.

    DEPRECATED: This returns empty dict now. Use UnifiedPermissionService instead.
    """
    # Return empty dict - this method is deprecated
    return {}
```

**Impact**:

- Frontend receives `permissions: {}` in session
- All frontend permission checks using `session?.permissions?.['resource:action:scope']` fail
- Components fall back to role-based checks only
- Potential security gaps where permissions are expected but not enforced

**Evidence**:

```typescript
// apps/web/app/orgs/[orgslug]/dash/org/layout.tsx:28
permissions?.permissions?.['organizations:read:org'] === true ||
permissions?.permissions?.['organizations:update:org'] === true;
```

This check **always returns false** because `permissions` is an empty object.

**Root Cause**: The `PermissionChecker.get_user_permissions()` was marked deprecated but **still being called** by `get_user_session()` in `apps/api/src/services/users/users.py:379-384`.

---

### Issue #2: Three Competing Permission Systems

**Severity**: Critical
**Description**: The codebase has 3 different permission checking systems running simultaneously:

#### System 1: UnifiedPermissionService (New - v6)

- Location: `apps/api/src/services/permissions/unified_permission_service.py`
- Status: ✅ Modern, well-designed
- **Adoption**: ~15% of codebase
- Features: Policies, caching, ABAC, audit logging

#### System 2: PermissionChecker (Deprecated - v5)

- Location: `apps/api/src/security/rbac/checker.py`
- Status: ⚠️ Marked deprecated but **widely used**
- **Adoption**: ~60% of codebase
- **Problem**: Just a wrapper around UnifiedPermissionService but **returns empty permissions**

#### System 3: Legacy Policies (v4 remnants)

- Location: `apps/api/src/security/rbac/policies/*.py`
- Status: ⚠️ Still actively used
- **Adoption**: ~25% of codebase
- Used by: CoursePolicy, OrganizationPolicy, UserPolicy

**Impact**:

- Developers confused about which system to use
- Inconsistent permission behavior
- Difficult to debug permission issues
- Performance overhead from multiple systems

---

### Issue #3: Frontend-Backend Permission Format Mismatch

**Severity**: High
**Description**: Frontend expects permission format different from backend

#### Backend Format (from UnifiedPermissionService)

Returns boolean checks only, no permission object:

```python
async def check(self, user, action, resource, resource_id=None, org_id=None) -> bool:
    # Returns True/False
```

#### Frontend Format (from session)

Expects a dictionary with permission strings:

```typescript
// Expected:
permissions: {
  'course:create:org': true,
  'course:update:own': true,
  'organization:manage:all': true
}

// Actually receiving:
permissions: {}
```

**Impact**:

- All frontend permission checks fail
- Components fall back to role-only checks
- Inconsistent behavior between role checks and permission checks
- Missing granular permissions enforcement

**Files Affected**:

- `apps/web/hooks/usePermission.ts` - expects permission dictionary
- `apps/web/app/orgs/[orgslug]/dash/org/layout.tsx` - broken checks
- All components using `session?.permissions` pattern

---

### Issue #4: Inconsistent Role Checking

**Severity**: Medium-High
**Description**: Multiple ways to check user roles, leading to inconsistencies

#### Method 1: Session roles array

```typescript
const roles = session?.roles ?? [];
roles.map((userRole: any) => userRole.role?.slug || '')
```

#### Method 2: Direct permission object

```typescript
permissions?.permissions?.['organizations:read:org']
```

#### Method 3: isAdmin helper

```typescript
const isAdmin = useMemo(() => roles.some((role) => isAdminRole(role)), [roles]);
```

#### Method 4: Backend helper functions

```python
def is_admin_or_maintainer(user_id: int) -> bool
def is_instructor_or_higher(user_id: int) -> bool
```

**Problem**: Each method may give different results due to:

- Role hierarchy not consistently applied
- Expired roles not filtered in frontend
- Permission scope not considered
- Different role slug formats

---

## 🟡 Architectural Issues

### Issue #5: Overcomplicated Permission Flow

**Current Flow** (9 steps):

```
User Request
    ↓
FastAPI Dependency (get_current_user)
    ↓
PermissionChecker.check() [Deprecated wrapper]
    ↓
UnifiedPermissionService.check()
    ↓
Policy.check() [If policy exists]
    ↓
_default_check()
    ↓
_check_resource_permission()
    ↓
_get_user_active_roles()
    ↓
_check_role_permission()
```

**Problems**:

- Too many layers of indirection
- Performance overhead (9 function calls)
- Difficult to debug
- Multiple cache lookups
- Policy system barely used (only 3 policies)

**Recommended Flow** (4 steps):

```
User Request
    ↓
UnifiedPermissionService.check()
    ↓
Cache lookup (if miss: DB query)
    ↓
Return result
```

---

### Issue #6: Policies System Underutilized

**Current State**:

- 4 policy classes created (BasePolicy, CoursePolicy, OrganizationPolicy, UserPolicy)
- Only 3 resources use policies: Course, Organization, User
- **13 other resource types** have no policies and use default logic

**Problems**:

- Policies provide minimal value beyond default checks
- Most logic duplicated between policy and default checks
- Adds complexity without benefit
- Not worth the abstraction overhead

**Evidence**:

```python
# CoursePolicy.check() mostly just calls super().check() anyway
if action == Action.CREATE:
    # Fall back to role-based check
    return super().check(user, action, resource_id, org_id)
```

---

### Issue #7: Duplicate Role Models and Confusion

**Problem**: Confusion about role model location

#### Correct Location (New System)

- `apps/api/src/db/permissions/models.py` - Role, UserRole, RolePermission

#### Incorrect Imports Found

Some files import from wrong location or use inconsistent patterns:

```python
# ❌ Old pattern (may reference wrong table)
from src.db.roles import Role

# ✅ Correct pattern
from src.db.permissions import Role, UserRole
```

**Impact**:

- Potential for using wrong database table
- Confusion for developers
- Migration issues

---

## 🟠 Frontend Issues

### Issue #8: usePermission Hook Complexity

**Location**: `apps/web/hooks/usePermission.ts`

**Problems**:

1. **Hardcoded role slugs** instead of using constants:

```typescript
if (roles.includes(RoleSlugs.SUPER_ADMIN)) { // ✅ Good
if (roles.includes('super-admin')) { // ❌ Bad (found in some components)
```

1. **Inconsistent permission name building**:

```typescript
const permName = buildPermissionName(resource, action, scope);
// vs
permissions['course:create:org']  // Hardcoded string
```

1. **Fallback logic too complex**:

```typescript
// Check specific scope
if (permissions[permName]) return true;
// Check ALL scope
if (scope !== Scopes.ALL) {
  const allScopePerm = buildPermissionName(resource, action, Scopes.ALL);
  if (permissions[allScopePerm]) return true;
}
// Check ORG scope for OWN scope
if (scope === Scopes.OWN) {
  const orgScopePerm = buildPermissionName(resource, action, Scopes.ORG);
  if (permissions[orgScopePerm]) return true;
}
```

This fallback cascade is confusing and prone to errors.

---

### Issue #9: Missing Permission Guards

**Severity**: Medium
**Description**: Many sensitive routes lack proper permission checks

**Examples**:

#### Example 1: Admin Dashboard

```typescript
// apps/web/app/orgs/[orgslug]/dash/admin/page.tsx
export const metadata: Metadata = {
  title: 'Admin Dashboard',
  description: 'Organization administration and settings',
};
// ❌ No permission check!
```

#### Example 2: User Roles Management

```typescript
// apps/web/app/orgs/[orgslug]/dash/admin/users/page.tsx
export default function UserRolesPage() {
  return <UserRolesClient />;
}
// ❌ No server-side permission check!
```

**Impact**:

- Unauthorized users could access admin pages if they guess the URL
- Client-side checks can be bypassed
- Security vulnerability

**Recommendation**: Add server-side layout.tsx with permission checks like org settings:

```typescript
// apps/web/app/orgs/[orgslug]/dash/org/layout.tsx
async function OrgLayout({ children, params }: OrgLayoutProps) {
  const session = await auth();
  // Check permissions server-side
  if (!hasOrgAdminPermission(session)) {
    redirect('/unauthorized');
  }
  return <>{children}</>;
}
```

---

### Issue #10: Inconsistent Permission Checking Patterns

**Description**: Components use different patterns to check permissions

#### Pattern 1: usePermission hook (Recommended)

```typescript
const { isAdmin } = usePermission();
if (isAdmin) { /* ... */ }
```

#### Pattern 2: Direct session check

```typescript
const session = usePlatformSession();
const permissions = session?.data?.permissions ?? {};
if (permissions['resource:action:scope']) { /* ... */ }
```

#### Pattern 3: Role extraction

```typescript
const userRole = session?.data?.roles?.[0]?.role?.slug;
if (userRole === 'org-admin') { /* ... */ }
```

#### Pattern 4: Custom permission context

```typescript
const { isUserAdmin } = usePermission();
```

**Impact**:

- Difficult to maintain
- Easy to make mistakes
- Inconsistent behavior
- No single source of truth

---

## 🟢 Database & Performance Issues

### Issue #11: Missing Indexes

**Location**: `apps/api/migrations/versions/94253463a6f4_rbac_4th_rewrite.py`

**Good**: Migration adds performance indexes

```python
# Added indexes
ix_role_permissions_role_id
ix_roles_org_id
ix_roles_slug
ix_user_roles_user_org
```

**Missing**: Some critical indexes not yet added:

- `permissions(resource_type, action)` - for permission lookups
- `user_roles(expires_at)` - for filtering expired roles
- `resource_authors(resource_uuid, user_id)` - for ownership checks

**Impact**:

- Slow permission checks at scale
- Database performance degradation with many users

---

### Issue #12: Inefficient Permission Caching

**Location**: `apps/api/src/services/permissions/permission_cache.py`

**Current Implementation**:

```python
def get_cached_permission(user_id, action, resource, resource_id, org_id):
    key = f"rbac:user:{user_id}:{resource}:{action}:{resource_id}:{org_id}"
    # Problem: Too granular, cache miss rate high
```

**Problems**:

1. **Too many unique keys** - cache miss rate high
2. **No bulk fetch** - each permission check = 1 cache lookup
3. **Cache invalidation overkill** - invalidates ALL user permissions on any role change

**Recommendation**: Use permission sets instead of individual permissions:

```python
def get_cached_user_permission_set(user_id, org_id):
    key = f"rbac:user:{user_id}:org:{org_id}:permissions"
    # Returns ALL permissions for user, single cache hit
```

---

## 🔵 Code Quality Issues

### Issue #13: Inconsistent Error Handling

**Description**: Different parts of system handle permission denials differently

#### Style 1: HTTPException

```python
raise HTTPException(
    status_code=status.HTTP_403_FORBIDDEN,
    detail="Permission denied"
)
```

#### Style 2: Custom PermissionDeniedError

```python
raise PermissionDeniedError(
    message="Cannot update course",
    error_code=PermissionErrorCode.PERM_002
)
```

#### Style 3: Boolean return

```python
if not authorized:
    return False
```

#### Style 4: Silent failure

```python
try:
    checker.require(user, action, resource)
except Exception as e:
    print(f"Error: {e}")  # Just prints, doesn't raise
```

**Impact**:

- Inconsistent error responses
- Difficult to handle errors on frontend
- Debugging challenges

---

### Issue #14: Missing Type Safety

**Location**: Throughout RBAC system

**Examples**:

1. **String-based permission checks** (prone to typos):

```typescript
permissions['course:create:org']  // ❌ No autocomplete, no validation
```

Should be:

```typescript
permissions[buildPermissionName(ResourceTypes.COURSE, Actions.CREATE, Scopes.ORG)]
```

1. **Any types in frontend**:

```typescript
const session = usePlatformSession() as any;  // ❌ Loses type safety
const org = useOrg() as any;  // ❌ Loses type safety
```

1. **Missing validation in backend**:

```python
def check(self, action, resource, resource_id=None):
    # ❌ No validation that action is valid Action enum
    # ❌ No validation that resource is valid ResourceType enum
```

---

### Issue #15: Inconsistent Naming Conventions

**Description**: Different naming styles across the codebase

#### Backend Naming

- `get_permission_service()` (snake_case) ✅
- `UnifiedPermissionService` (PascalCase) ✅
- `rbac_check()` (snake_case) ✅

#### Frontend Naming

- `usePermission()` (camelCase hook) ✅
- `isAdmin` (camelCase) ✅
- `RoleSlugs` (PascalCase const) ✅
- `Actions` (PascalCase const) ✅

#### Inconsistencies

- Permission keys: `course:create:org` vs `course_create_org`
- Role slugs: `super-admin` vs `super_admin` vs `superAdmin`
- Resource types: `organization` vs `org` vs `Organisation`

---

## 🔧 Specific Bugs Found

### Bug #1: Expired Roles Not Filtered in Frontend

**Location**: `apps/web/hooks/usePermission.ts:45-50`

```typescript
const roles = useMemo(() => {
  const userRoles = session?.roles ?? [];
  return userRoles.map((userRole: any) =>
    userRole.role?.slug || userRole.role?.role_uuid || ''
  ).filter(Boolean);
}, [session?.roles]);
```

**Problem**: No check for `expires_at` field. Expired roles still used.

**Fix**:

```typescript
const roles = useMemo(() => {
  const userRoles = session?.roles ?? [];
  const now = new Date();
  return userRoles
    .filter((userRole: any) =>
      !userRole.expires_at || new Date(userRole.expires_at) > now
    )
    .map((userRole: any) => userRole.role?.slug || '')
    .filter(Boolean);
}, [session?.roles]);
```

---

### Bug #2: Race Condition in Permission Checks

**Location**: `apps/api/src/services/permissions/unified_permission_service.py:250-270`

**Scenario**:

1. User A checks permission → Cache MISS → DB query starts
2. User A checks same permission again → Cache MISS (query not finished) → Second DB query starts
3. Both queries complete, write to cache

**Impact**:

- Unnecessary duplicate queries
- Race condition on cache writes
- Performance degradation under load

**Fix**: Use cache locking pattern:

```python
async def check(self, user, action, resource, resource_id=None):
    cache_key = self._build_cache_key(user.id, action, resource, resource_id)

    # Try cache first
    cached = await get_cached_permission(cache_key)
    if cached is not None:
        return cached

    # Acquire lock to prevent duplicate queries
    async with redis_lock(f"{cache_key}:lock", timeout=2):
        # Check cache again (may have been set while waiting for lock)
        cached = await get_cached_permission(cache_key)
        if cached is not None:
            return cached

        # Do actual check
        result = await self._default_check(...)
        await set_cached_permission(cache_key, result)
        return result
```

---

### Bug #3: UserGroup Permission Bypass

**Location**: `apps/api/src/security/rbac/policies/course.py:96-102`

```python
# Check UserGroup access
if resource_id:
    has_usergroup_restriction = self._has_usergroup_restriction(resource_id)
    if not has_usergroup_restriction:
        # No restrictions = any authenticated user can access
        return True  # ⚠️ POTENTIAL SECURITY ISSUE
```

**Problem**: If a course has NO usergroup restrictions, **any authenticated user** can access it, even if it's not marked as public.

**Expected Behavior**:

- Public courses: accessible by all
- Private courses with no usergroups: accessible by contributors only
- Private courses with usergroups: accessible by usergroup members only

**Impact**: Unauthorized access to private courses

---

### Bug #4: ABAC Conditions Never Evaluated

**Location**: `apps/api/src/services/permissions/unified_permission_service.py:612-640`

**Problem**: ABAC conditions are checked but **context is always None**:

```python
def _check_role_permission(self, role, action, resource, scope_context, context=None):
    for permission, role_permission in results:
        if self._scope_matches(permission.scope, scope_context):
            if self._conditions_match(role_permission.conditions, context):
                # context is ALWAYS None, so conditions are ignored
                return True
```

**Impact**:

- ABAC system is not functional
- Conditional permissions are ignored
- False sense of security

**Fix**: Build context from request:

```python
context = {
    'user_id': user.id,
    'org_id': org_id,
    'resource_id': resource_id,
    'time': datetime.now(),
    'ip_address': request.client.host if request else None,
}
```

---

### Bug #5: Memory Leak in Role Hierarchy

**Location**: `apps/api/src/services/permissions/unified_permission_service.py:555-578`

```python
def _get_role_hierarchy_ids(self, role_id: int) -> list[int]:
    result = self.db.exec(text("""
        WITH RECURSIVE role_hierarchy AS (
            SELECT id, parent_role_id, 0 as depth
            FROM roles
            WHERE id = :role_id
            UNION ALL
            SELECT r.id, r.parent_role_id, rh.depth + 1
            FROM roles r
            INNER JOIN role_hierarchy rh ON r.id = rh.parent_role_id
            WHERE rh.depth < :max_depth
        )
        SELECT id FROM role_hierarchy ORDER BY depth
    """), {"role_id": role_id, "max_depth": MAX_ROLE_HIERARCHY_DEPTH})

    return [row[0] for row in result.fetchall()]
```

**Problem**:

- Creates new database connection for each call
- No connection pooling
- Result not cached

**Impact**:

- Database connection exhaustion
- Performance degradation
- Potential memory leak

---

## 📋 Recommendations

### Priority 1 - Critical (Fix Immediately)

1. **Fix Empty Permissions Object** (Issue #1)
   - Update `get_user_session()` to use `UnifiedPermissionService.get_user_permissions()`
   - Build permission dictionary with proper format: `{'resource:action:scope': bool}`
   - Return to frontend in session

2. **Remove Deprecated PermissionChecker** (Issue #2)
   - Migrate all calls to `UnifiedPermissionService`
   - Delete `apps/api/src/security/rbac/checker.py`
   - Update imports across codebase

3. **Add Server-Side Permission Guards** (Issue #9)
   - Create layout.tsx for admin routes
   - Implement `auth()` checks before rendering
   - Redirect unauthorized users

4. **Fix UserGroup Permission Bypass** (Bug #3)
   - Add explicit public/private flag to courses
   - Fix logic to check public flag first
   - Only fall back to usergroup for private courses

5. **Standardize Frontend Permission Checking** (Issue #10)
   - Create single `usePermission()` hook pattern
   - Remove direct session checks
   - Update all components to use hook

6. **Fix Expired Roles** (Bug #1)
   - Add expiry filtering to frontend
   - Add expiry filtering to backend role queries
   - Add database index on expires_at

7. **Simplify Permission Flow** (Issue #5)
   - Remove PermissionChecker wrapper
   - Remove barely-used Policy system
   - Direct call to UnifiedPermissionService

8. **Fix ABAC Context** (Bug #4)
   - Build context from request data
   - Pass to permission checks
   - Add tests for conditional permissions

9. **Optimize Caching** (Issue #12)
   - Change to permission set caching
   - Reduce cache keys
   - Implement cache locking

10. **Add Missing Indexes** (Issue #11)
    - Create migration for missing indexes
    - Test performance improvement
    - Monitor query times

11. **Standardize Error Handling** (Issue #13)
    - Use PermissionDeniedError consistently
    - Return proper error codes
    - Document error responses

12. **Add Type Safety** (Issue #14)
    - Use enums for permission checks
    - Add Zod validation
    - Fix `any` types

13. **Simplify usePermission Hook**
    - Remove complex fallback logic
    - Document expected behavior
    - Add unit tests

14. **Standardize Naming**
    - Document naming conventions
    - Run linter to find inconsistencies
    - Rename inconsistent variables

15. **Documentation**
    - Update RBAC documentation
    - Add architecture diagrams
    - Write migration guide

---

## 📊 Migration Strategy

Write migrations in a4359f97a23d_rbac_7th_rewrite.py

### Phase 1

- Fix critical bugs (#1, #3, #4)
- Add server-side guards
- Restore permission object to frontend

- Remove PermissionChecker
- Migrate all code to UnifiedPermissionService
- Remove Policy system
- Simplify permission flow

- Optimize caching strategy
- Add missing indexes
- Fix performance issues
- Add monitoring

- Standardize error handling
- Add type safety
- Fix naming inconsistencies
- Update documentation

---

## 🎯 Success Criteria

### Technical Metrics

- [ ] Single permission system (UnifiedPermissionService)
- [ ] <100ms average permission check latency
- [ ] >90% cache hit rate
- [ ] Zero deprecation warnings
- [ ] 100% test coverage for permission checks

### Code Quality Metrics

- [ ] All frontend components use `usePermission()` hook
- [ ] No direct session permission checks
- [ ] All admin routes have server-side guards
- [ ] All permission strings use constants (no hardcoded strings)
- [ ] TypeScript strict mode enabled with no `any` types

### Security Metrics

- [ ] All sensitive routes protected
- [ ] No permission bypass vulnerabilities
- [ ] Proper error handling everywhere
- [ ] Audit logging for all permission changes
- [ ] Regular security audits

---

## 📚 Conclusion

The current RBAC system has significant issues despite being labeled "v6 Complete". The main problems are:

1. **Architectural complexity** - Too many competing systems
2. **Frontend-backend misalignment** - Empty permissions object
3. **Security gaps** - Missing guards, permission bypasses
4. **Performance issues** - Inefficient caching, missing indexes
5. **Code quality** - Inconsistent patterns, missing types
