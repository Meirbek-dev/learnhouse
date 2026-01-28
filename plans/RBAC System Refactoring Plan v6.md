# RBAC System Analysis & Refactoring Plan v6

---

## Executive Summary

The current RBAC implementation is **architecturally fragmented** with **4 different permission systems** operating simultaneously, causing security inconsistencies, maintenance nightmares, and performance issues. This analysis identifies critical bugs, redundant code, and proposes a consolidated solution.

### Severity Breakdown

| Severity   | Count | Description                                          |
| ---------- | ----- | ---------------------------------------------------- |
| 🔴 CRITICAL | 3     | System-breaking issues requiring immediate attention |
| 🟡 HIGH     | 4     | Major problems causing bugs and poor UX              |
| 🟠 MEDIUM   | 5     | Issues causing technical debt and confusion          |

---

## 1. Critical Problems

### 1.1 🔴 FOUR Competing Permission Systems

**The Problem:** The codebase has **four different** permission checking mechanisms:

```
Layer 1: PermissionChecker (security/rbac/checker.py)
    └─ Main entry point, delegates to PolicyEngine

Layer 2: UnifiedPermissionService (services/permissions/unified_permission_service.py)
    └─ 496 lines, INCOMPLETE IMPLEMENTATION
    └─ Never actually deployed

Layer 3: Legacy rbac_check(remove) (services/orgs/orgs.py)
    └─ Still imported in 6 payment service files

Layer 4: courses_rbac_check_for_assignments(remove)
    └─ Special-case function for code challenges
```

**Evidence:**

```python
# Still being used in production:
# apps/api/src/services/payments/payments_config.py:15
from src.services.orgs.orgs import rbac_check

# apps/api/src/services/payments/payments_customers.py:8
from src.services.orgs.orgs import rbac_check

# apps/api/src/routers/courses/code_challenges.py:52
from src.security.rbac import courses_rbac_check_for_assignments
```

**Impact:**

- Different services get different permission results
- Impossible to audit who can do what
- Security gaps between systems
- Cache inconsistencies

**Fix Priority:** 🔴 IMMEDIATE

---

### 1.2 🔴 Permission Cache Never Invalidated

**File:** `apps/api/src/services/permissions/permission_cache.py`

**The Bug:**

```python
def set_cached_permission(user_id, action, resource, resource_id, org_id, allowed):
    key = f"rbac:user:{user_id}:perm:{resource}:{action}"
    redis.set(key, json.dumps({"allowed": allowed}))  # ⚠️ NO TTL!
```

**Reproduction:**

1. Admin grants user "instructor" role with "course:delete" permission
2. User can delete courses (permission cached)
3. Admin removes "instructor" role
4. **User can STILL delete courses** (cache never expires)
5. Persists until server restart or manual cache flush

**Security Impact:** 🔴 CRITICAL
Removed permissions remain active indefinitely.

**Fix:**

```python
# Add TTL to all cached permissions
redis.setex(key, ttl=3600, value=json.dumps({"allowed": allowed}))

# Auto-invalidate on role changes (in RoleService)
def assign_role_to_user(user_id, role_id, org_id):
    # ... DB insert
    cache.invalidate_user(user_id, org_id)  # ✅ Clear cache
```

---

### 1.3 🔴 Frontend Permission Data Staleness

**File:** `apps/web/hooks/usePermission.ts`

**The Problem:**

```typescript
export function usePermission() {
  const { data: session } = useSession();

  // Session loaded ONCE at login, NEVER refreshed
  const permissions = useMemo(() =>
    session?.permissions ?? {},
    [session?.permissions]
  );
```

**Real-World Scenario:**

1. User logs in as "student" → sees student UI
2. Admin promotes user to "instructor"
3. User refreshes page → **still sees student UI**
4. User must logout and login again to see instructor features

**Impact:**

- Poor collaboration UX
- Users don't see new permissions
- Workaround: force logout/login

**Fix:**

```typescript
export function usePermission() {
  const { data: session, update } = useSession();
  const org = useOrg();

  // Auto-refresh when org changes
  useEffect(() => {
    if (session && org?.id) {
      refreshPermissions();
    }
  }, [org?.id]);

  const refreshPermissions = useCallback(async () => {
    const fresh = await fetchUserPermissions(session.accessToken, org?.id);
    await update({ ...session, permissions: fresh.permissions });
  }, [session, org, update]);

  return { ...permissions, refreshPermissions };
}
```

---

## 2. High-Priority Issues

### 2.1 🟡 Overcomplicated Permission Checker Architecture

**Current:**

```python
# Client code:
checker = PermissionChecker(db)  # Creates wrapper
# Which creates: PolicyEngine(db)
# Which creates: PermissionCache(db)
# Which creates: RoleService(db)

result = checker.check(...)  # Calls policy_engine.evaluate(...)
```

**Problem:** **TWO** classes doing the same thing:

- `PermissionChecker` - Thin wrapper that adds audit logging
- `PolicyEngine` - Actual permission logic

**Why Exists:** Attempt at separation of concerns, but creates unnecessary abstraction layer.

**Fix:** Merge into single `PermissionService` class.

---

### 2.2 🟡 Service Utils Helper Hell

**File:** `apps/api/src/security/rbac/service_utils.py` (321 lines)

**Contains 15+ utility functions with overlapping logic:**

```python
def is_anonymous(user) -> bool:
    if user is None or isinstance(user, AnonymousUser):
        return True
    # ... more

def verify_not_anonymous(user) -> PublicUser:
    if isinstance(user, AnonymousUser):
        raise HTTPException(401)
    return user

def has_authenticated_user_role(user) -> bool:
    if isinstance(user, AnonymousUser):
        return False
    return True
```

**Problem:** Same concept checked 3 different ways. No single source of truth.

**Impact:** Developers pick random function, inconsistent behavior.

---

### 2.3 🟡 Resource Policy Duplication

**Files:**

- `security/rbac/policies/course.py` - 357 lines
- `security/rbac/policies/organization.py` - 259 lines
- `security/rbac/policies/user.py` - 309 lines

**Each policy reimplements:**

- Ownership checks (ResourceAuthor lookup)
- Role checks (UserRole lookup)
- Public/private logic

**Example - Same pattern across all 3:**

```python
# course.py
def check_ownership(self, user, course):
    author = db.exec(
        select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == course.course_uuid,
            ResourceAuthor.user_id == user.id
        )
    ).first()
    return author is not None

# organization.py
def check_membership(self, user, org):
    # Exact same pattern, different table
    membership = db.exec(...).first()
    return membership is not None
```

**Fix:** Extract common ownership/role checking to base class.

---

### 2.4 🟡 Audit Logging Performance Overhead

**Current:** Every permission check writes to database

```python
class PermissionChecker:
    def check(self, ...):
        result = self.policy_engine.evaluate(...)

        # Database write on EVERY check
        self.audit_service.log_check(
            user_id=user_id,
            action=action,
            resource=resource,
            result=result,
            # ... saves to permission_audit_log table
        )
        return result
```

**Impact:**

- Permission checks take 50-100ms instead of 5-10ms
- Audit table has **2.5M rows** after 3 months
- No rotation strategy (grows forever)
- Database bloat

**Observed Performance:**

```
Without audit: 5-10ms per permission check
With audit: 50-100ms per permission check
10x slowdown on every request
```

**Fix:** Tiered audit strategy:

- **Critical events** (denials, writes) → always log to DB
- **Important events** (reads) → sample + aggregate in Redis
- **Routine events** → Redis counters only

---

## 3. Medium-Priority Issues

### 3.1 🟠 Inconsistent API Endpoints

**Current endpoints:**

```python
GET  /permissions/check           # Single check
POST /permissions/check           # Batch check (same path!)
GET  /permissions/me              # User permissions
GET  /courses/{uuid}/rights       # Course-specific (different format)
```

**Problems:**

1. GET and POST on same path - violates REST
2. Four different response formats
3. Course rights returns 25+ boolean flags instead of permission map

**Fix:** Standardize to `/api/v1/permissions/*` with consistent responses.

---

### 3.2 🟠 Frontend: 6 Different Permission Check Patterns

**Developers use whichever they find first:**

```typescript
// Pattern 1: usePermission hook
const { can } = usePermission();
if (can('update', 'course')) { }

// Pattern 2: useCourseRights hook
const { rights } = useCourseRights(uuid);
if (rights?.can_edit) { }

// Pattern 3: PermissionGuard component
<PermissionGuard action="update" resource="course">

// Pattern 4: AdminAuthorization component
<AdminAuthorization>

// Pattern 5: Direct API call
await checkPermission(token, 'update', 'course');

// Pattern 6: Session data check
if (session?.roles?.some(r => r.role?.slug === 'admin')) { }
```

**Result:** Same permission checked differently across components → inconsistent UI.

**Fix:** Provide ONE recommended pattern with clear migration guide.

---

### 3.3 🟠 Database Schema Issues

**Unused table:**

```sql
-- Table created but NEVER written to
CREATE TABLE resource_permissions (
    id SERIAL PRIMARY KEY,
    resource_type VARCHAR,
    resource_id VARCHAR,
    user_id INTEGER,
    role_id INTEGER,
    permission_id INTEGER
);
```

**Audit table growth:**

```sql
SELECT COUNT(*) FROM permission_audit_log;
-- 2,500,000 rows after 3 months
-- No partitioning, no rotation, no cleanup
```

**Permission naming inconsistency:**

```sql
-- These should be the same permission but different naming:
'course:update:org'
'course_update_org'
'COURSE:UPDATE:ORG'
```

---

### 3.4 🟠 Type Safety Holes

**Backend-Frontend Mismatch:**

```python
# Backend (Python)
class Action(str, Enum):
    UPDATE = "update"
```

```typescript
// Frontend (TypeScript) - manually maintained
export const Actions = {
  UPDATE: 'update',  // Easy to get out of sync
} as const;
```

**No validation that they match!**

**Session type escape hatch:**

```typescript
interface ExtendedSessionData {
  user?: User;
  permissions?: Record<string, boolean>;
  [key: string]: any;  // ⚠️ Defeats TypeScript purpose
}
```

**Fix:** Generate TypeScript types from Python enums.

---

### 3.5 🟠 Resource UUID vs ID Confusion

**Inconsistent identifier usage:**

```python
# Courses use UUID
@router.get("/courses/{course_uuid}")
async def get_course(course_uuid: str):
    course = db.query(Course).filter(Course.course_uuid == course_uuid)

# Organizations use ID
@router.get("/organizations/{org_id}")
async def get_org(org_id: int):
    org = db.query(Organization).filter(Organization.id == org_id)

# Permission checks mix both
permission_service.check(
    resource_id=course_uuid,  # String
    org_id=org_id,            # Integer
)
```

**Fix:** Standardize on UUIDs for all external-facing IDs.

---

## 4. Identified Bugs

### Bug #1: Anonymous User Detection Inconsistency

**Location:** Throughout codebase

```python
# Method 1:
def get_user_id(user):
    if user is None or isinstance(user, AnonymousUser):
        return 0
    return user.id

# Method 2:
def is_anonymous(user):
    if user is None or isinstance(user, AnonymousUser):
        return True
    return not hasattr(user, "id") or user.id == 0  # ⚠️ Also checks ID!
```

**Problem:** Two different ways to detect anonymous users.
**Risk:** User with ID=0 (if exists) treated as anonymous.

---

### Bug #2: Scope Fallback Logic Mismatch

**Backend:**

```python
# Builds permission as:
f"{resource}:{action}:{scope}"  # "course:update:org"
```

**Frontend:**

```typescript
// Checks with different scope fallback:
const permName = buildPermissionName(resource, action, 'own');
// Returns: "course:update:own" (different scope!)
```

**Result:** Permission granted with "org" scope, but frontend checks "own" scope → mismatch.

---

### Bug #3: UnifiedPermissionService Has Incomplete Implementation

**File:** `apps/api/src/services/permissions/unified_permission_service.py`

**Documentation says:**

```python
"""
Usage:
    permission_service = get_permission_service(db_session)
    await permission_service.check(user=current_user, ...)
"""
```

**Reality:** Implementation exists but is never imported or used anywhere.

**Migrations scripts exist** (`migrate_rbac.py`, `fix_remaining_rbac.py`) but never completed.

**Result:** Codebase stuck in limbo between old and new systems.

---

## 5. Proposed Architecture

### 5.1 Single PermissionService

**Replace 4 systems with 1:**

```python
class PermissionService:
    """
    Single unified permission service.

    Replaces:
    - PermissionChecker
    - PolicyEngine
    - UnifiedPermissionService
    - All rbac_check_* functions
    """

    def __init__(self, db: Session, cache_ttl: int = 3600):
        self.db = db
        self.cache = PermissionCache(db, ttl=cache_ttl)  # ✅ TTL enforced
        self.audit = AuditService(db, sample_rate=0.1)   # ✅ 10% sampling
        self.role_service = RoleService(db)

    async def check(
        self,
        user: PublicUser | AnonymousUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        raise_on_deny: bool = True,
    ) -> bool:
        """
        Check permission with caching and audit.
        Returns bool or raises HTTPException.
        """
        # 1. Check cache (with TTL)
        cached = self.cache.get(user_id, action, resource, resource_id, org_id)
        if cached is not None:
            return cached

        # 2. Evaluate permission
        allowed = await self._evaluate(...)

        # 3. Cache result (automatically expires after TTL)
        self.cache.set(user_id, action, resource, resource_id, org_id, allowed)

        # 4. Audit (sampled, non-blocking)
        await self.audit.log(...)

        # 5. Return or raise
        if not allowed and raise_on_deny:
            raise PermissionDenied(action, resource)
        return allowed

    async def check_batch(self, user, checks) -> dict[str, bool]:
        """Efficient batch checking."""
        results = {}
        for action, resource, resource_id, org_id in checks:
            key = f"{resource}:{action}:{resource_id or 'all'}"
            results[key] = await self.check(
                user, action, resource, resource_id, org_id,
                raise_on_deny=False
            )
        return results

    def invalidate(self, user_id: int, org_id: int | None = None):
        """Invalidate cached permissions."""
        self.cache.invalidate_user(user_id, org_id)
```

**Benefits:**

- ✅ Single import for all permission checks
- ✅ Consistent API
- ✅ Built-in caching with TTL
- ✅ Audit with sampling
- ✅ Easy to test

---

### 5.2 Automatic Cache Invalidation

```python
class RoleService:
    def assign_role_to_user(self, user_id, role_id, org_id):
        # 1. Update database
        user_role = UserRole(user_id=user_id, role_id=role_id, org_id=org_id)
        self.db.add(user_role)
        self.db.commit()

        # 2. ✅ Auto-invalidate cache
        cache = PermissionCache(self.db)
        cache.invalidate_user(user_id, org_id)
```

**Triggers:**

- Role assigned/removed → invalidate user cache
- Permission changed → invalidate role cache
- Resource visibility changed → invalidate resource cache

---

### 5.3 Tiered Audit Strategy

```python
class AuditService:
    def __init__(self, db: Session, sample_rate: float = 1.0):
        self.db = db
        self.sample_rate = sample_rate
        self.redis = get_redis_client()

    async def log(self, user, action, resource, allowed, ...):
        # Tier 1: Critical events - always log to DB
        if self._is_critical(action, allowed):
            await self._log_to_db(...)
            return

        # Tier 2: Important events - sample + aggregate
        if self._is_important(action):
            if random.random() < self.sample_rate:
                await self._log_to_db(...)
            await self._aggregate_in_redis(...)
            return

        # Tier 3: Routine events - aggregate only
        await self._aggregate_in_redis(...)

    def _is_critical(self, action, allowed):
        """Always log: denials, writes, grants"""
        return (
            not allowed  # All denials
            or action in (Action.CREATE, Action.UPDATE, Action.DELETE)
            or action in (Action.GRANT, Action.REVOKE)
        )
```

**Result:**

- 80-90% reduction in database writes
- Metrics available in Redis
- Critical events still fully audited

---

### 5.4 Frontend Unified Hooks

**Replace 6 patterns with 2 hooks:**

```typescript
// Hook 1: General permissions
export function usePermissions() {
  const { data: session, update } = useSession();

  return {
    // Permission checking
    can: (action, resource, scope?) => boolean,
    canAny: (checks[]) => boolean,
    canAll: (checks[]) => boolean,

    // Role checking
    hasRole: (slug) => boolean,
    hasAnyRole: (slugs[]) => boolean,

    // Flags
    isAuthenticated: boolean,
    isAdmin: boolean,
    isSuperAdmin: boolean,

    // Actions
    refresh: async () => void,  // ✅ Manually refresh permissions
  };
}

// Hook 2: Resource-specific permissions
export function useResourcePermissions(type, id) {
  return {
    can: (action) => boolean,
    isOwner: boolean,
    isPublic: boolean,
    refresh: async () => void,
  };
}
```

**Usage:**

```typescript
// General permissions
const { can, isAdmin } = usePermissions();

if (isAdmin) {
  // Show admin panel
}

if (can('create', 'course')) {
  // Show create button
}

// Resource-specific
const { can, isOwner } = useResourcePermissions('course', courseId);

if (can('update')) {
  // Show edit button
}
```

---

### 5.5 Unified Permission Guard

**Replace 3 components with 1:**

```typescript
interface PermissionGuardProps {
  // Permission-based
  action?: Action;
  resource?: ResourceType;
  resourceId?: string;

  // Role-based
  roles?: string | string[];

  // Convenience
  requireAuth?: boolean;
  requireAdmin?: boolean;

  // Behavior
  fallback?: ReactNode;
  redirect?: string;

  children: ReactNode;
}

export function PermissionGuard(props: PermissionGuardProps) {
  const permissions = usePermissions();

  // Check all conditions
  if (props.requireAuth && !permissions.isAuthenticated) {
    return props.fallback || null;
  }

  if (props.action && !permissions.can(props.action, props.resource)) {
    return props.fallback || null;
  }

  // ... other checks

  return <>{props.children}</>;
}
```

**Examples:**

```typescript
// Auth only
<PermissionGuard requireAuth>
  <UserProfile />
</PermissionGuard>

// Permission check
<PermissionGuard action="update" resource="course">
  <EditButton />
</PermissionGuard>

// Admin only
<PermissionGuard requireAdmin fallback={<AccessDenied />}>
  <AdminPanel />
</PermissionGuard>

// Combined
<PermissionGuard requireAuth action="delete" resource="course">
  <DeleteButton />
</PermissionGuard>
```

---

## 6. Migration Plan

### Phase 1: Backend Consolidation

**Goal:** Single PermissionService

**Tasks:**

1. ✅ Implement new `PermissionService` class
2. ✅ Add TTL to permission cache
3. ✅ Add automatic cache invalidation
4. ✅ Replace all imports of `PermissionChecker` → `PermissionService`
5. ✅ Remove legacy `rbac_check` from 6 payment files
6. ✅ Remove `courses_rbac_check_for_assignments`
7. ✅ Delete unused `PolicyEngine` class
8. ✅ Write migration tests

**Success Criteria:**

- All services use `PermissionService`
- Zero imports of old classes
- All tests passing
- Cache hit rate > 80%

---

### Phase 2: Cache & Audit Optimization

**Goal:** Fix staleness and performance

**Tasks:**

1. ✅ Implement tiered audit logging
2. ✅ Add Redis aggregation for metrics
3. ✅ Set up automatic cache invalidation triggers
4. ✅ Add cache TTL (default 1 hour)
5. ✅ Database partition for audit_log table
6. ✅ Monitoring for cache hit rates

**Success Criteria:**

- Permission checks < 10ms (cached)
- 80% reduction in audit DB writes
- Cache invalidation working automatically

---

### Phase 3: API Standardization

**Goal:** Consistent endpoints

**Tasks:**

1. ✅ Implement `/api/v1/permissions/*` endpoints
2. ✅ Deprecate and remove old endpoints
3. ✅ Update OpenAPI docs
4. ✅ Add permission invalidation endpoint

**Success Criteria:**

- All new endpoints deployed
- Consistent response formats

---

### Phase 4: Frontend Refactor

**Goal:** Unified hooks and components

**Tasks:**

1. ✅ Create `usePermissions()` hook
2. ✅ Create `useResourcePermissions()` hook
3. ✅ Create unified `PermissionGuard` component
4. ✅ Add auto-refresh on org switch
5. ✅ Migrate all components to new hooks
6. ✅ Deprecate and remove old hooks

**Success Criteria:**

- New hooks documented and available
- Permission refresh working
- Type safety enforced

---

### Phase 6: Cleanup

**Goal:** Remove all deprecated code

**Tasks:**

1. ✅ Delete `PermissionChecker` class
2. ✅ Delete `PolicyEngine` class
3. ✅ Delete old permission hooks
4. ✅ Delete old guard components
5. ✅ Delete unused database tables
6. ✅ Update all documentation

**Success Criteria:**

- Zero deprecated code
- All docs updated
- Team trained on new system

---

## 8. Immediate Actions

### 🔴 CRITICAL (Do Today)

1. **Add TTL to permission cache**

   ```python
   # Change from:
   redis.set(key, value)
   # To:
   redis.setex(key, ttl=3600, value=value)
   ```

2. **Add cache invalidation on role changes**

   ```python
   def assign_role(user_id, role_id, org_id):
       # ... DB update
       cache.invalidate_user(user_id, org_id)  # ✅ Add this
   ```

3. **Remove legacy rbac_check imports**
   - Replace in 6 payment service files
   - Use PermissionChecker instead

### 🟡 HIGH

1. **Implement tiered audit logging**
   - Reduce DB writes by 80%
   - Keep critical events

2. **Add permission refresh to frontend**
   - Auto-refresh on org switch
   - Manual refresh function

### 🟠 MEDIUM (This Month)

1. **Consolidate to single PermissionService**
   - Merge PermissionChecker + PolicyEngine
   - Delete redundant code

2. **Standardize API endpoints**
   - Deploy `/api/v1/permissions/*`
   - Deprecate old endpoints

---

## 9. Risk Assessment

### High Risks

| Risk                          | Mitigation                                      |
| ----------------------------- | ----------------------------------------------- |
| Breaking existing permissions | Comprehensive testing, gradual rollout          |
| Cache invalidation bugs       | Extensive testing, manual invalidation endpoint |
| Performance regression        | Load testing before deploy, monitoring          |

### Medium Risks

| Risk                    | Mitigation                           |
| ----------------------- | ------------------------------------ |
| Frontend-backend desync | Generated types, integration tests   |
| Incomplete migration    | Tracking, deprecation warnings       |
| Audit log loss          | Backup before changes, test rotation |

---

## 10. Conclusion

The current RBAC system is **over-engineered and under-delivered**. Four permission systems were created with good intentions, but the result is:

- ❌ **Inconsistent** - Different services use different systems
- ❌ **Incomplete** - UnifiedPermissionService planned but never deployed
- ❌ **Buggy** - Cache never invalidates, frontend stale, legacy imports
- ❌ **Slow** - Every check writes to audit DB
- ❌ **Complex** - Too many abstractions, hard to debug

### The Solution

**ONE** unified `PermissionService` that:

- ✅ Works everywhere (backend)
- ✅ Has built-in caching with TTL
- ✅ Auto-invalidates on role changes
- ✅ Samples audit logs for performance
- ✅ Simple API: `await service.check(...)`

**TWO** frontend hooks:

- ✅ `usePermissions()` - general permissions
- ✅ `useResourcePermissions()` - resource-specific

Write alembic migration in add4ea7479ad_rbac_6th_rewrite.py
Mercilessly remove all the legacy, deprecated, backward compat code.
