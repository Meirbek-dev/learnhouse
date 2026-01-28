# RBAC System Analysis, Refactor & Improvement Plan v5

---

## Executive Summary

The current RBAC (Role-Based Access Control) implementation suffers from severe architectural inconsistencies, code duplication, and over-engineering. After comprehensive analysis, **27 critical issues** have been identified that impact security, maintainability, performance, and developer experience.

**Key Problems:**

- 🔴 **Dual Permission Systems**: Two competing permission checkers (PolicyEngine + PermissionChecker)
- 🔴 **9 Different RBAC Check Functions**: Massive code duplication across resource types
- 🔴 **Inconsistent Permission Patterns**: Frontend and backend use different permission models
- 🔴 **Circular Import Dependencies**: Multiple TYPE_CHECKING guards indicate architectural problems
- 🔴 **Incomplete Migration**: Legacy code mixed with new RBAC v4 system

---

## Table of Contents

1. [Critical Issues](#critical-issues)
2. [Architecture Problems](#architecture-problems)
3. [Code Quality Issues](#code-quality-issues)
4. [Security Concerns](#security-concerns)
5. [Performance Problems](#performance-problems)
6. [Frontend-Backend Inconsistencies](#frontend-backend-inconsistencies)
7. [Recommended Refactoring Plan](#recommended-refactoring-plan)
8. [Migration Strategy](#migration-strategy)

---

## Critical Issues

### 🔴 Issue #1: Dual Permission Evaluation Systems

**Problem:** Two separate systems exist for checking permissions:

- `PolicyEngine` (in `src/services/permissions/policy_engine.py`)
- `PermissionChecker` (in `src/security/rbac/checker.py`)

**Evidence:**

```python
# PermissionChecker creates PolicyEngine internally
class PermissionChecker:
    def __init__(self, db: Session, audit_level: AuditLevel = DEFAULT_AUDIT_LEVEL):
        self.db = db
        self.policy_engine = PolicyEngine(db)  # Creates another engine
        self.audit_service = AuditService(db)
```

**Impact:**

- Confusion about which system to use
- Duplicate permission evaluation logic
- Inconsistent behavior between systems
- Difficult to maintain

**Root Cause:** Incomplete migration from RBAC v3 to v4

---

### 🔴 Issue #2: Nine Different RBAC Check Functions

**Problem:** Nine resource-specific RBAC check functions with 80% duplicated code:

1. `rbac_check()` - Generic check
2. `rbac_check_org()` - Organization resources
3. `rbac_check_user()` - User resources
4. `rbac_check_role()` - Role resources
5. `rbac_check_usergroup()` - UserGroup resources
6. `courses_rbac_check()` - Course resources
7. `courses_rbac_check_for_activities()` - Activity resources
8. `courses_rbac_check_for_assignments()` - Assignment resources
9. `courses_rbac_check_for_chapters()` - Chapter resources
10. `courses_rbac_check_for_certifications()` - Certification resources
11. `courses_rbac_check_for_collections()` - Collection resources

**Evidence:**

```python
# All these functions have nearly identical structure:
async def rbac_check_org(...):
    if isinstance(current_user, InternalUser):
        return True
    if action == "read":
        return True
    user_id = current_user.id if hasattr(current_user, "id") else 0
    verify_not_anonymous(user_id)
    if is_admin_or_maintainer(db_session, user_id):
        return True
    raise HTTPException(...)

async def rbac_check_user(...):
    user_id = current_user.id if hasattr(current_user, "id") else 0
    if action in ("create", "read"):
        return True
    verify_not_anonymous(user_id)
    if current_user.user_uuid == user_uuid:
        return True
    if is_admin_or_maintainer(db_session, user_id):
        return True
    # ... more duplicate logic
```

**Impact:**

- **500+ lines of duplicated code**
- Inconsistent permission logic across resources
- Bugs fixed in one function may not be fixed in others
- Extremely difficult to maintain
- Performance overhead from duplicate checks

---

### 🔴 Issue #3: Circular Import Dependencies

**Problem:** Multiple `TYPE_CHECKING` guards to avoid circular imports:

**Evidence:**

```python
# In service_utils.py
if TYPE_CHECKING:
    from src.security.rbac.checker import PermissionChecker

# Then later in the SAME file:
from src.security.rbac.checker import PermissionChecker  # Import inside function
```

This pattern appears **8 times** in `service_utils.py` alone:

- Line 27-29
- Line 213
- Line 331
- Line 353
- Line 378
- Line 447
- Line 498
- Line 718

**Impact:**

- Indicates poor module separation
- Hidden dependencies
- Difficult to refactor
- IDE autocomplete breaks
- Maintenance nightmare

**Root Cause:** `service_utils.py` and `checker.py` depend on each other

---

### 🔴 Issue #4: Inconsistent Permission Naming

**Problem:** Three different permission naming conventions:

**Backend (PolicyEngine):**

```python
# Format: "resource:action:scope"
"courses:create:org"
"courses:read:all"
"users:update:own"
```

**Frontend (usePermission):**

```typescript
// Format: "resource:action:scope"
buildPermissionName(resource, action, scope)
// Returns: "course:create:org" (singular!)
```

**Legacy System:**

```python
# Old RBAC v3 format (still in database)
permissions = {
    "organizations:read:org": True,
    "organizations:update:org": True,
}
```

**Evidence of Confusion:**

```typescript
// Frontend checks both formats
permissions['dashboard:access:all']
permissions['courses:create:org']
permissions['organizations:read:org']  // Uses plural!
```

**Impact:**

- Frontend and backend permissions don't match
- Permission checks fail silently
- Developers confused about correct format
- Security vulnerabilities from incorrect checks

---

### 🔴 Issue #5: Inconsistent User Type Handling

**Problem:** Three different user types with inconsistent handling:

**User Types:**

```python
PublicUser      # Authenticated user
AnonymousUser   # Unauthenticated user
InternalUser    # System/service account
```

**Inconsistent Checks:**

```python
# Pattern 1: Type checking
if isinstance(user, AnonymousUser):
    return False

# Pattern 2: ID checking
if user.id == 0:
    return False

# Pattern 3: hasattr checking
user_id = user.id if hasattr(user, "id") else 0

# Pattern 4: is_anonymous helper (NEW)
if is_anonymous(user):
    return False

# Pattern 5: get_user_id helper (NEW)
user_id = get_user_id(user)
```

**Found in:**

- `service_utils.py`: All 5 patterns
- `checker.py`: Patterns 1, 2, 4
- `policy_engine.py`: Patterns 2, 3
- Various service files: Mixed patterns

**Impact:**

- No single source of truth
- Easy to introduce bugs
- Inconsistent behavior
- Hard to maintain

---

### 🔴 Issue #6: Resource Ownership Checks Scattered

**Problem:** Resource ownership logic duplicated in multiple places:

**Locations:**

1. `is_resource_owner()` in `service_utils.py`
2. `check_is_resource_author()` in `service_utils.py`
3. `PolicyEngine._check_resource_ownership()` in `policy_engine.py`
4. Inline checks in various service files

**Example Duplication:**

```python
# service_utils.py
def is_resource_owner(db_session, user_id, resource_uuid):
    statement = select(ResourceAuthor).where(
        ResourceAuthor.resource_uuid == resource_uuid,
        ResourceAuthor.user_id == user_id,
    )
    resource_author = db_session.exec(statement).first()
    return (
        resource_author.authorship in (
            ResourceAuthorshipEnum.CREATOR,
            ResourceAuthorshipEnum.MAINTAINER,
            ResourceAuthorshipEnum.CONTRIBUTOR,
        )
        and resource_author.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE
    )

# policy_engine.py (similar logic, different implementation)
def _check_resource_ownership(self, user_id, resource_id):
    stmt = select(ResourceAuthor).where(
        ResourceAuthor.resource_uuid == resource_id,
        ResourceAuthor.user_id == user_id,
    )
    author = self.db.exec(stmt).first()
    # Different logic here...
```

**Impact:**

- Inconsistent ownership rules
- Bugs in one place but not others
- Performance impact from duplicate queries

---

### 🔴 Issue #7: Over-Engineered Course Permission System

**Problem:** Course permissions have their own parallel universe of checks:

**Special Course Functions (400+ LOC):**

```python
courses_rbac_check()                          # 120 lines
courses_rbac_check_with_course_lookup()       # 15 lines
courses_rbac_check_for_activities()           # 10 lines
courses_rbac_check_for_assignments()          # 10 lines
courses_rbac_check_for_chapters()             # 10 lines
courses_rbac_check_for_certifications()       # 10 lines
courses_rbac_check_for_collections()          # 70 lines
```

**Plus special course rights system on frontend:**

```typescript
useCourseRights(courseuuid: string)  // Returns 15 different permission flags
```

**Why is this bad?**

- Courses should use the same RBAC system as everything else
- Creates maintenance burden
- Inconsistent with other resources
- Frontend has to fetch separate course rights

---

### 🔴 Issue #8: Missing Centralized Policy Classes

**Problem:** Policy classes exist but aren't used:

**Files exist:**

```python
src/security/rbac/policies/
├── __init__.py
├── base.py          # BasePolicy class
├── course.py        # CoursePolicy
├── organization.py  # OrganizationPolicy
└── user.py         # UserPolicy
```

**But PermissionChecker doesn't use them!**

```python
# checker.py - SHOULD use policies but doesn't
def check(self, user, action, resource, resource_id, org_id, context):
    # Calls PolicyEngine directly
    result = self.policy_engine.evaluate(...)
    # Policies are never consulted!
```

**Impact:**

- Policy classes are dead code
- Resource-specific logic scattered in service_utils
- Violates Open/Closed Principle
- Can't add new resource types cleanly

---

## Architecture Problems

### Issue #9: No Clear Separation of Concerns

**Current Architecture:**

```
service_utils.py (773 lines)
├── Helper functions (is_anonymous, get_user_id)
├── Action/Resource mapping
├── Ownership checks
├── Admin/Role checks
├── 9 different rbac_check functions
└── Import PermissionChecker dynamically

checker.py (311 lines)
├── PermissionChecker class
├── Creates PolicyEngine
├── Calls AuditService
└── Main check() method

policy_engine.py (654 lines)
├── PolicyEngine class
├── Role evaluation
├── Permission evaluation
├── Caching logic
└── ABAC evaluation
```

**Problems:**

- `service_utils.py` is a god object (773 lines doing everything)
- No clear entry point for permission checks
- Circular dependencies
- Mixed concerns (utils + business logic + HTTP handlers)

---

### Issue #10: Inconsistent Caching Strategy

**Problem:** Caching logic split across multiple files:

**Cache Locations:**

1. `permission_cache.py` - Redis caching functions
2. `policy_engine.py` - Uses cache in `evaluate()`
3. `PermissionChecker` - Has `use_cache` parameter but doesn't control it
4. `RoleService` - Has its own caching

**Evidence:**

```python
# PolicyEngine uses cache
if self.use_cache and context is None:
    cached = get_cached_permission(...)

# But PermissionChecker doesn't control this
class PermissionChecker:
    def __init__(self, db: Session, audit_level: AuditLevel):
        # No cache control!
        self.policy_engine = PolicyEngine(db)  # Uses cache by default
```

**Impact:**

- Can't disable caching for testing
- Cache invalidation unclear
- Performance unpredictable

---

### Issue #11: Audit Logging Inconsistency

**Problem:** Audit logs only happen through PermissionChecker:

**Works:**

```python
checker = PermissionChecker(db)
checker.check(user, action, resource)  # ✅ Logs to audit
```

**Doesn't work:**

```python
engine = PolicyEngine(db)
engine.evaluate(user_id, action, resource)  # ❌ No audit log!
```

**Also bypassed:**

```python
# Direct RBAC checks don't audit
await courses_rbac_check(...)  # ❌ No audit log!
await rbac_check_org(...)      # ❌ No audit log!
```

**Impact:**

- Incomplete audit trail
- Security compliance issues
- Can't track who accessed what

---

## Code Quality Issues

### Issue #12: Excessive Code Duplication

**Measured Duplication:**

- `service_utils.py`: **~400 lines duplicated** across 9 rbac_check functions
- Ownership checks: **3 implementations**
- User type checks: **5 different patterns**
- Permission name building: **2 implementations** (frontend + backend)

---

### Issue #13: Poor Function Naming

**Confusing Names:**

```python
# Which one should I use?
rbac_check()                          # Generic
courses_rbac_check()                  # Course-specific
courses_rbac_check_for_activities()   # Activity-specific
check_user_permission()               # Doesn't use PermissionChecker!
is_admin_or_maintainer()             # Role check
has_instructor_role()                # Role check
has_authenticated_user_role()        # Always returns True!
```

**Problem:** No naming convention for:

- When to use `check_` vs `rbac_check` vs `has_` vs `is_`
- When to use `_check` vs `_verify` vs `_require`

---

### Issue #14: Inconsistent Return Types

**Different RBAC functions return different types:**

```python
# Some return bool
async def rbac_check() -> bool:
    return True

# Some raise exceptions and return bool
async def rbac_check_org() -> bool:
    if not authorized:
        raise HTTPException(...)
    return True

# Some return None and raise exceptions
async def rbac_check_role() -> None:
    if not authorized:
        raise HTTPException(...)
    # No return!

# Some return the resource
async def courses_rbac_check_with_course_lookup() -> Course:
    # Returns Course object!
```

**Impact:**

- Developers don't know what to expect
- Easy to misuse
- Can't be used interchangeably

---

### Issue #15: Magic Strings Everywhere

**Examples:**

```python
# String literals for actions
action in ("create", "read", "update", "delete")

# String literals for resource types
if resource_uuid.split("_")[0] == "course":
    resource_type = "course"

# String literals for roles
if role.slug == "super-admin":
    return True

# String literals in frontend
permissions['dashboard:access:all']
permissions['courses:create:org']
```

**Should use enums but doesn't:**

```python
# These exist but aren't used consistently
class Action(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
```

---

### Issue #16: Incomplete Type Hints

**Examples:**

```python
# Missing type hints
def check_is_resource_author(db_session, user_id, resource_uuid):  # No types!
    ...

# Any types
def get_permission_context(request: Request) -> Any:  # Too broad
    ...

# Inconsistent optional handling
def rbac_check(
    resource_uuid: str,  # Required
    org_id: int | None = None,  # Optional
    context: dict | None = None,  # Optional
):
```

---

## Security Concerns

### 🔒 Issue #17: Inconsistent Anonymous User Handling

**Problem:** Anonymous users handled differently across the codebase:

**Sometimes allowed:**

```python
# Courses - anonymous can read public
if is_resource_public(db_session, course_uuid, ResourceType.COURSE):
    return True  # Even if user_id == 0
```

**Sometimes blocked:**

```python
# Organizations - anonymous blocked early
if user_id == 0:
    raise HTTPException(status_code=401, ...)
```

**Sometimes bypassed:**

```python
# Direct public check without RBAC
if course.public:
    # Anyone can access - no audit log!
```

**Security Risk:** Inconsistent enforcement could allow unauthorized access

---

### 🔒 Issue #18: InternalUser Bypasses All Checks

**Problem:** InternalUser bypasses RBAC without audit:

```python
if isinstance(current_user, InternalUser):
    return True  # No audit log, no permission check!
```

**Found in:**

- `rbac_check()`
- `rbac_check_org()`
- `rbac_check_usergroup()`
- `courses_rbac_check()`

**Security Risk:**

- No audit trail for system actions
- If InternalUser credentials leaked, full access
- Can't revoke InternalUser access
- No way to track what system did

---

### 🔒 Issue #19: Resource UUID Inference is Unsafe

**Problem:** Inferring resource type from UUID prefix:

```python
def infer_resource_type(resource_uuid: str) -> ResourceType:
    prefix = resource_uuid.split("_")[0].lower()
    return RESOURCE_PREFIX_MAP.get(prefix, ResourceType.COURSE)  # Defaults to COURSE!
```

**Security Risks:**

1. **Wrong default:** Unknown UUIDs treated as courses
2. **Collision risk:** `courseupdate_xxx` maps to COURSE (not COURSE_UPDATE)
3. **No validation:** Accepts any string
4. **Silent failures:** Wrong type = wrong permissions

**Example Attack:**

```python
# Attacker passes malformed UUID
await rbac_check(request, "attacker_123", current_user, "delete", db)
# Gets inferred as COURSE and checked with course permissions!
```

---

### 🔒 Issue #20: Permission Check Bypass via Ownership

**Problem:** Resource owners bypass all permission checks:

```python
# In courses_rbac_check
if is_resource_owner(db_session, user_id, course_uuid):
    return True  # Bypasses role-based permissions!
```

**Scenario:**

1. User creates a course (becomes owner)
2. Admin revokes user's "instructor" role
3. User can still edit course because they're the owner
4. **Expected:** User should lose access when role revoked
5. **Actual:** Ownership trumps roles

**Problem:** Ownership and roles should work together, not bypass each other

---

## Performance Problems

### ⚡ Issue #21: N+1 Query Problem in Role Checks

**Problem:** Role checks trigger database queries per request:

```python
def is_admin_or_maintainer(db_session: Session, user_id: int) -> bool:
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)  # Database query!
    return any(ur.role and ur.role.slug in ADMIN_OR_MAINTAINER_SLUGS for ur in user_roles)
```

**Called from:**

- Every `rbac_check()` call
- Every `courses_rbac_check()` call
- Multiple times per request

**Impact:**

- 5-10 extra database queries per request
- Cache helps but not always used
- Performance degradation under load

---

### ⚡ Issue #22: Redundant Permission Checks

**Problem:** Same permission checked multiple times:

**Example flow for creating course content:**

```python
# 1. Check course read permission
await courses_rbac_check(request, course_uuid, user, "read", db)

# 2. Check course update permission
await courses_rbac_check(request, course_uuid, user, "update", db)

# 3. Check activity create permission
await courses_rbac_check_for_activities(request, course_uuid, user, "create", db)

# Each call:
#   - Fetches user roles (DB query)
#   - Checks if admin (DB query)
#   - Checks ownership (DB query)
#   - Checks permissions (DB query)
```

**Result:** 12+ database queries for a single operation

---

### ⚡ Issue #23: Cache Key Inconsistency

**Problem:** Cache keys don't match between systems:

**PolicyEngine cache key:**

```python
cache_key = f"rbac:user:{user_id}:action:{action_str}:resource:{resource_str}"
if resource_id:
    cache_key += f":id:{resource_id}"
if org_id:
    cache_key += f":org:{org_id}"
```

**Frontend session cache:**

```typescript
// Session includes:
session.permissions = {
  "courses:create:org": true,
  "courses:read:all": true,
}
```

**Impact:**

- Cache misses when keys don't match
- Duplicate data in Redis
- Increased memory usage

---

## Frontend-Backend Inconsistencies

### Issue #24: Dual Permission Models

**Backend sends:**

```json
{
  "permissions": {
    "courses:create:org": true,
    "courses:read:all": true,
    "users:update:own": true
  },
  "roles": [
    {
      "role": {
        "id": 1,
        "slug": "instructor",
        "name": "Instructor"
      },
      "org": {
        "id": 1,
        "slug": "my-org"
      }
    }
  ]
}
```

**Frontend expects:**

```typescript
interface UserPermissionsResponse {
  user_id: number;
  org_id?: number;
  roles: string[];  // Just slugs!
  permissions: Record<string, boolean>;
  is_super_admin: boolean;
}
```

**Problem:** Data transformation required, easy to break

---

### Issue #25: Frontend useCourseRights vs Backend courses_rbac_check

**Frontend:**

```typescript
const { hasPermission, isLoading } = useCourseRights(courseuuid);

// Returns:
{
  permissions: {
    read: boolean,
    create: boolean,
    update: boolean,
    delete: boolean,
    create_content: boolean,
    update_content: boolean,
    delete_content: boolean,
    manage_contributors: boolean,
    manage_access: boolean,
    grade_assignments: boolean,
    mark_activities_done: boolean,
    create_certifications: boolean,
  }
}
```

**Backend:**

```python
await courses_rbac_check(request, course_uuid, user, "update", db)
# Just returns True/False or raises
```

**Problem:**

- Frontend has 12 different permission flags
- Backend has 4 actions
- Mapping is unclear
- Easy to desync

---

### Issue #26: Session Bloat

**Problem:** User session includes massive permission object:

```typescript
// Session includes ALL permissions for ALL resources
session = {
  permissions: {
    "courses:create:org": true,
    "courses:read:all": true,
    "courses:update:own": true,
    "courses:delete:own": true,
    "activities:create:org": true,
    "activities:read:all": true,
    // ... 50+ more permissions
  },
  roles: [...],  // All roles
  user: {...},   // User data
}
```

**Impact:**

- Large JWT tokens (>4KB)
- Slow session serialization
- Bandwidth waste
- Cookie size limits

---

## Missing Features

### Issue #27: No Permission Delegation

**Missing:**

- Can't delegate permissions to other users
- Can't create temporary access tokens
- Can't share resources with time-limited access
- Can't audit delegated permissions

**Use cases:**

- Teacher delegates grading to TA
- Admin gives temp access to support staff
- User shares course with collaborator for 7 days

---

## Recommended Refactoring Plan

### Phase 1: Consolidate Permission Checking

**Goal:** Single entry point for all permission checks

**Actions:**

1. **Create unified `PermissionService`:**

   ```python
   class PermissionService:
       def __init__(self, db: Session):
           self.db = db
           self.cache = PermissionCache(db)
           self.audit = AuditService(db)

       def check(
           self,
           user: PublicUser | AnonymousUser,
           action: Action,
           resource: ResourceType,
           resource_id: str | None = None,
           org_id: int | None = None,
       ) -> PermissionResult:
           """Single method for all permission checks"""
           ...
   ```

2. **Delete redundant functions:**
   - Remove 9 `rbac_check_*` functions
   - Remove `courses_rbac_check_*` functions
   - Consolidate into `PermissionService.check()`

3. **Update all callers:**
   - Replace `await rbac_check(...)` with `permission_service.check(...)`
   - Use dependency injection for `PermissionService`

**Benefits:**

- 500+ lines of code removed
- Single source of truth
- Consistent behavior
- Easier to test

---

### Phase 2: Fix User Type Handling

**Goal:** Consistent user type checking

**Actions:**

1. **Standardize user utilities:**

   ```python
   # Keep ONLY these two functions
   def is_anonymous(user: User | AnonymousUser | InternalUser | None) -> bool:
       """Single function to check if user is anonymous"""
       ...

   def get_user_id(user: User | AnonymousUser | InternalUser | None) -> int:
       """Single function to get user ID (0 for anonymous)"""
       ...
   ```

2. **Remove all other patterns:**
   - Delete `isinstance(user, AnonymousUser)` checks
   - Delete `user.id == 0` checks
   - Delete `hasattr(user, "id")` checks
   - Replace with `is_anonymous()` and `get_user_id()`

3. **Add InternalUser audit:**

   ```python
   def check(...):
       if isinstance(user, InternalUser):
           self.audit.log_internal_user_access(...)  # Add audit!
           return True
   ```

---

### Phase 3: Implement Policy Pattern

**Goal:** Resource-specific logic in policy classes

**Actions:**

1. **Make PermissionService use policies:**

   ```python
   class PermissionService:
       def __init__(self, db: Session):
           self.policies = {
               ResourceType.COURSE: CoursePolicy(db),
               ResourceType.ORGANIZATION: OrganizationPolicy(db),
               ResourceType.USER: UserPolicy(db),
               # ... more policies
           }

       def check(self, user, action, resource, resource_id, org_id):
           policy = self.policies.get(resource)
           if policy:
               return policy.check(user, action, resource_id, org_id)
           return self._default_check(user, action, resource, resource_id, org_id)
   ```

2. **Implement CoursePolicy:**

   ```python
   class CoursePolicy(BasePolicy):
       def check(self, user, action, resource_id, org_id):
           # Course-specific logic (public courses, etc.)
           if action == Action.READ and self._is_public(resource_id):
               return True
           return super().check(user, action, resource_id, org_id)
   ```

3. **Benefits:**
   - Resource-specific logic isolated
   - Easy to add new resource types
   - Follows Open/Closed Principle
   - Testable in isolation

---

### Phase 4: Fix Frontend-Backend Sync

**Goal:** Consistent permission model across stack

**Actions:**

1. **Standardize permission format:**

   ```typescript
   // Both use same format
   type PermissionKey = `${ResourceType}:${Action}:${Scope}`;

   // Backend sends:
   {
     "permissions": {
       "course:create:org": true,  // Singular!
       "course:read:all": true,
     }
   }

   // Frontend uses:
   const canCreate = can(Actions.CREATE, ResourceTypes.COURSE, Scopes.ORG);
   // Builds: "course:create:org" ✅ Matches!
   ```

2. **Remove useCourseRights:**

   ```typescript
   // DELETE: useCourseRights hook

   // REPLACE WITH:
   const { can } = usePermission();
   const canUpdate = can(Actions.UPDATE, ResourceTypes.COURSE, Scopes.OWN);
   const canCreateContent = can(Actions.CREATE, ResourceTypes.ACTIVITY, Scopes.ORG);
   ```

3. **Slim down session:**

   ```typescript
   // Only include user roles, fetch permissions on demand
   session = {
     user: {...},
     roles: ["instructor"],  // Just role slugs
     org_id: 1,
   }

   // Fetch permissions when needed
   const { permissions } = usePermissions(session.org_id);
   ```

---

### Phase 5: Performance Optimization

**Goal:** Reduce database queries and improve cache

**Actions:**

1. **Batch permission checks:**

   ```python
   def check_batch(
       self,
       user: PublicUser,
       checks: list[tuple[Action, ResourceType, str | None]],
   ) -> dict[tuple, bool]:
       """Check multiple permissions in one DB query"""
       ...
   ```

2. **Eager load user roles in middleware:**

   ```python
   @app.middleware("http")
   async def load_user_roles(request: Request, call_next):
       if request.state.user:
           # Fetch roles once per request
           request.state.user_roles = role_service.get_user_roles(request.state.user.id)
       return await call_next(request)
   ```

3. **Optimize cache keys:**

   ```python
   # Use consistent, compact keys
   cache_key = f"perm:{user_id}:{action}:{resource}:{resource_id or ''}:{org_id or ''}"
   ```

---

### Phase 6: Security Hardening

**Goal:** Fix security issues

**Actions:**

1. **Remove resource type inference:**

   ```python
   # BEFORE: Unsafe inference
   resource_type = infer_resource_type(uuid)  # ❌

   # AFTER: Explicit type required
   def check(
       self,
       user: PublicUser,
       action: Action,
       resource: ResourceType,  # Must be provided!
       resource_id: str | None = None,
   ):
       ...
   ```

2. **Add InternalUser audit:**

   ```python
   if isinstance(user, InternalUser):
       self.audit.log_internal_access(user, action, resource, resource_id)
       return True
   ```

3. **Require explicit public access:**

   ```python
   # Don't bypass RBAC for public resources
   if resource.is_public:
       # Still check if user has READ permission
       if action != Action.READ:
           return False
       # Log public access
       self.audit.log_public_access(resource_id, action)
   return True
   ```

---

## Migration Strategy

create alembic migrations in 831861f725e2_rbac_5th_rewrite.py file

### Step 1

- Remove old system, all the legacy and compat code, migrate to the new systems

### Step 2: Remove Old Code

- Delete old `rbac_check_*` functions
- Delete `courses_rbac_check_*` functions
- Delete unused policies
- Remove feature flag
- Remove all duplication
- Make sure all inconsistencies are fixed

---

## Success Metrics

**Code Quality:**

- ✅ Reduce `service_utils.py` from 773 lines to <200 lines
- ✅ Remove 500+ lines of duplicated code
- ✅ Consolidate 9 functions into 1
- ✅ Zero circular imports

**Performance:**

- ✅ Reduce DB queries per request by 50%
- ✅ Improve permission check latency by 30%
- ✅ Reduce cache misses by 40%

**Security:**

- ✅ 100% audit coverage
- ✅ Zero permission bypasses
- ✅ Consistent anonymous user handling

**Developer Experience:**

- ✅ Single entry point for permission checks
- ✅ Consistent naming and return types
- ✅ Clear documentation
- ✅ Easy to add new resources

---

## Conclusion

The current RBAC implementation is a result of **incremental changes without architectural oversight**. Multiple rewrites (v2, v3, v4) have left legacy code mixed with new code, creating an unmaintainable mess.
