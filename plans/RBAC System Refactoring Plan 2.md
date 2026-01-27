# RBAC System Refactoring Plan v2

## Executive Summary

This document outlines the comprehensive plan to complete, optimize, and finalize the Role-Based Access Control (RBAC) system refactoring. The new system provides fine-grained permissions, proper hierarchy support, resource-level overrides, and clear separation of concerns.

**Current Status**: ~70% complete - Core models, services, and checker are implemented. Needs cleanup, consolidation, and frontend integration.

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Architecture Overview](#2-architecture-overview)
3. [Implementation Phases](#3-implementation-phases)
4. [Database Schema](#4-database-schema)
5. [API Design](#5-api-design)
6. [Frontend Integration](#6-frontend-integration)
7. [Migration Strategy](#7-migration-strategy)
8. [Testing Strategy](#8-testing-strategy)
9. [Security Considerations](#9-security-considerations)

---

## 1. Current State Analysis

### 1.1 What's Implemented ✅

#### Database Layer (`src/db/permissions/`)

- [x] **Enums**: `Action`, `ResourceType`, `Scope`, `AuditAction`
- [x] **Models**: `Permission`, `RoleNew`, `RolePermission`, `UserRole`, `ResourcePermission`, `PermissionAuditLog`
- [x] **Migrations**: Tables created via `69fd16a5d534_rbac_rewrite.py`, `afaf068e905d_rbac_rewrite_2.py`, `seed_rbac_permissions.py`

#### Security Layer (`src/security/rbac/`)

- [x] **PermissionChecker**: Central permission checking with caching and audit
- [x] **PolicyEngine**: Core permission evaluation logic
- [x] **Context**: Permission context tracking (user, org, resource)
- [x] **Dependencies**: FastAPI dependency injection
- [x] **Decorators**: `@require_permission` for route protection
- [x] **Policies**: Base, Course, Organization, User policies

#### Services Layer (`src/services/permissions/`)

- [x] **RoleService**: Role CRUD, hierarchy, permission assignments
- [x] **PermissionService**: Permission CRUD operations
- [x] **AuditService**: Audit logging
- [x] **PolicyEngine**: Permission evaluation
- [x] **PermissionCache**: Redis caching

#### API Layer (`src/routers/permissions.py`)

- [x] Permission management endpoints
- [x] Role management endpoints
- [x] User-role assignment endpoints
- [x] Permission check endpoints

### 1.2 What Needs Work ⚠️

#### Code Duplication Issues

- `courses_security.py` and `service_utils.py` have overlapping functions
- Multiple `rbac_check` variants across services
- Inconsistent function naming (`_is_course_owner` vs `is_resource_owner`)

#### Missing Features

- [ ] Role inheritance not fully utilized in permission checks
- [ ] ABAC conditions not implemented (context field exists but not used)
- [ ] Batch permission checking optimization
- [ ] Permission wildcards (e.g., `course:*:org`)
- [ ] Delegation (user A grants permissions to user B)

#### Frontend Gaps

- [ ] `useAdminStatus.tsx` uses old rights structure
- [ ] `AuthenticatedClientElement.tsx` needs refactoring
- [ ] No real-time permission updates
- [ ] Missing permission-based UI component visibility

#### Technical Debt

- Old `roles.py` model still exists alongside `RoleNew`
- `Rights` JSON column migration incomplete
- Some services still reference old permission system

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                          │
├─────────────────────────────────────────────────────────────────────┤
│  usePermissions()  │  <PermissionGate>  │  useCourseRights()       │
└────────────┬───────────────┬───────────────────┬────────────────────┘
             │               │                   │
             ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API Layer (FastAPI)                            │
├─────────────────────────────────────────────────────────────────────┤
│  /api/permissions/*  │  @require_permission  │  Route Handlers      │
└────────────┬───────────────┬───────────────────┬────────────────────┘
             │               │                   │
             ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Security Layer (RBAC)                           │
├─────────────────────────────────────────────────────────────────────┤
│  PermissionChecker  │  PolicyEngine  │  ResourcePolicies            │
└────────────┬───────────────┬───────────────────┬────────────────────┘
             │               │                   │
             ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Services Layer                                  │
├─────────────────────────────────────────────────────────────────────┤
│  RoleService  │  PermissionService  │  AuditService  │  Cache       │
└────────────┬───────────────┬───────────────────┬────────────────────┘
             │               │                   │
             ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Data Layer (PostgreSQL + Redis)                 │
├─────────────────────────────────────────────────────────────────────┤
│  permissions  │  roles_new  │  role_permissions  │  user_roles      │
│  resource_permissions  │  permission_audit_log  │  Redis Cache      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Permission Evaluation Flow

```
User Request
     │
     ▼
┌─────────────────┐
│ Authentication  │ ──► AnonymousUser (limited access)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Cache     │ ──► Cached Result (fast path)
└────────┬────────┘
         │ Cache Miss
         ▼
┌─────────────────┐
│ Resource-Level  │ ──► ResourcePermission exists → ALLOW
│ Permissions     │
└────────┬────────┘
         │ Not Found
         ▼
┌─────────────────┐
│ Get User Roles  │ ──► Filter expired, get hierarchy
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Ownership │ ──► ResourceAuthor table
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ For each role (including inherited) │
│   - Check RolePermission            │
│   - Evaluate Scope (all/own/org)    │
│   - Check ABAC conditions           │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Resource Policy │ ──► CoursePolicy.check(), etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Cache & Audit   │
└────────┬────────┘
         │
         ▼
    ALLOW / DENY
```

### 2.3 Core Components

#### PermissionChecker

The single entry point for all permission checks:

```python
class PermissionChecker:
    def check(user, action, resource, resource_id?, org_id?, context?) -> bool
    def require(user, action, resource, ...) -> None  # raises HTTPException
    def can(user, action, resource, ...) -> bool      # alias for check
    def get_user_permissions(user, org_id?) -> dict[str, bool]
```

#### PolicyEngine

Evaluates permissions against the database:

```python
class PolicyEngine:
    def evaluate(user_id, action, resource, resource_id?, org_id?, context?) -> bool
    def _check_anonymous_access(action, resource, resource_id?) -> bool
    def _check_resource_permission(user_id, action, resource, resource_id) -> bool
    def _get_user_active_roles(user_id, org_id?) -> list[RoleNew]
    def _check_ownership(user_id, resource_id) -> bool
    def _check_role_permission(role, action, resource, is_owner, context?) -> bool
```

#### Resource Policies

Custom logic per resource type:

```python
class BasePolicy(ABC):
    @abstractmethod
    def check(user, action, resource_id?, context?) -> bool
    def is_owner(user, resource_id) -> bool

class CoursePolicy(BasePolicy):
    # Public courses readable by anyone
    # Course creation requires instructor role
    # Course updates require ownership or admin
```

---

## 3. Implementation Phases

### Phase 1: Consolidation & Cleanup

#### 3.1.1 Unify RBAC Check Functions

**Goal**: Single source of truth for permission checks

**Tasks**:

1. Merge `courses_security.py` into `service_utils.py`
2. Remove duplicate functions with warnings
3. Update all service imports to use unified module
4. Remove old `rights` field references

**Files to Modify**:

- `src/security/rbac/service_utils.py` - Primary location
- `src/security/courses_security.py` - Remove, import from service_utils
- All services using RBAC checks

**Unified API**:

```python
# src/security/rbac/service_utils.py

async def rbac_check(
    request: Request,
    resource_uuid: str,
    current_user: PublicUser | AnonymousUser | InternalUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
    resource_type: ResourceType | None = None,
    require_ownership: bool = False,
    org_id: int | None = None,
) -> bool:
    """Single unified RBAC check for all resources."""
    ...
```

#### 3.1.2 Complete Role Migration

**Goal**: Remove old `Role` model, use only `RoleNew`

**Tasks**:

1. Create migration to rename `roles_new` → `roles`
2. Update all model references
3. Update `setup.py` to use new role model
4. Update `roles.py` service to use new model

**Migration Script**:

```python
def upgrade():
    # Rename roles_new to roles (drop old roles table first if empty)
    # Update foreign key references
    # Copy any remaining data
    pass
```

#### 3.1.3 Clean Up Old Rights System

**Goal**: Remove JSON `rights` field completely

**Tasks**:

1. Verify all roles have been migrated to role_permissions
2. Remove `rights` column from old roles table
3. Update any code still reading rights field
4. Remove `Rights` TypedDict and related code

### Phase 2: Feature Completion (Week 3-4)

#### 3.2.1 Implement Role Hierarchy

**Goal**: Roles inherit permissions from parent roles

**Current State**: `parent_role_id` exists but not used in evaluation

**Implementation**:

```python
def _check_role_permission(self, role: RoleNew, ...) -> bool:
    # Get all roles in hierarchy (role + parents)
    roles_to_check = self._get_role_hierarchy(role)

    for r in roles_to_check:
        perms = self._get_role_permissions(r.id)
        if self._permission_matches(perms, action, resource):
            return True
    return False

def _get_role_hierarchy(self, role: RoleNew) -> list[RoleNew]:
    """Get role and all parent roles."""
    hierarchy = [role]
    current = role
    visited = {role.id}

    while current.parent_role_id and current.parent_role_id not in visited:
        parent = self.db.get(RoleNew, current.parent_role_id)
        if parent:
            hierarchy.append(parent)
            visited.add(parent.id)
            current = parent
        else:
            break

    return hierarchy
```

#### 3.2.2 Implement Scope Evaluation

**Goal**: Properly evaluate `ALL`, `OWN`, `ASSIGNED`, `ORG` scopes

**Implementation**:

```python
def _evaluate_scope(
    self,
    permission: Permission,
    user_id: int,
    resource_id: str | None,
    org_id: int | None,
    is_owner: bool,
) -> bool:
    match permission.scope:
        case Scope.ALL:
            return True
        case Scope.OWN:
            return is_owner
        case Scope.ASSIGNED:
            return self._is_assigned_to_user(user_id, resource_id)
        case Scope.ORG:
            return self._is_in_same_org(user_id, resource_id, org_id)
```

#### 3.2.3 Add ABAC Conditions

**Goal**: Support attribute-based conditions for fine-grained control

**Schema Update**:

```python
class RolePermission(SQLModelStrictBaseModel, table=True):
    # ... existing fields ...
    conditions: dict | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="ABAC conditions: {'time_range': {'start': '09:00', 'end': '17:00'}}"
    )
```

**Condition Evaluator**:

```python
def _evaluate_conditions(self, conditions: dict | None, context: dict | None) -> bool:
    if not conditions:
        return True

    for condition_type, condition_value in conditions.items():
        if not self._check_condition(condition_type, condition_value, context):
            return False
    return True

def _check_condition(self, type: str, value: Any, context: dict | None) -> bool:
    match type:
        case "time_range":
            return self._check_time_range(value)
        case "ip_whitelist":
            return context and context.get("ip") in value
        case "max_daily_requests":
            return self._check_rate_limit(value, context)
        # Add more condition types as needed
```

#### 3.2.4 Batch Permission Checking

**Goal**: Efficiently check multiple permissions in one call

**API**:

```python
@router.post("/permissions/batch-check")
async def batch_check_permissions(
    checks: list[PermissionCheckRequest],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
) -> list[PermissionCheckResult]:
    """Check multiple permissions in a single request."""
    checker = PermissionChecker(db)
    results = []

    for check in checks:
        allowed = checker.check(
            current_user,
            check.action,
            check.resource,
            check.resource_id,
            check.org_id,
        )
        results.append(PermissionCheckResult(
            action=check.action,
            resource=check.resource,
            resource_id=check.resource_id,
            allowed=allowed,
        ))

    return results
```

### Phase 3: Frontend Integration (Week 5-6)

#### 3.3.1 Create React Permission Hooks

**`usePermissions` Hook**:

```typescript
// hooks/usePermissions.ts
export function usePermissions(orgId?: number) {
  const { data: session } = usePlatformSession();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.tokens?.access_token) {
      setLoading(false);
      return;
    }

    fetchUserPermissions(session.tokens.access_token, orgId)
      .then(setPermissions)
      .finally(() => setLoading(false));
  }, [session, orgId]);

  const can = useCallback((action: Action, resource: ResourceType, resourceId?: string) => {
    if (!permissions) return false;
    const key = `${resource}:${action}:${resourceId || 'all'}`;
    return permissions.permissions[key] ?? false;
  }, [permissions]);

  return { permissions, loading, can };
}
```

**`useResourcePermissions` Hook**:

```typescript
// hooks/useResourcePermissions.ts
export function useResourcePermissions(resourceType: ResourceType, resourceId: string) {
  const { can, loading } = usePermissions();

  return {
    canRead: can('read', resourceType, resourceId),
    canUpdate: can('update', resourceType, resourceId),
    canDelete: can('delete', resourceType, resourceId),
    canManage: can('manage', resourceType, resourceId),
    loading,
  };
}
```

#### 3.3.2 Create Permission Gate Component

```typescript
// components/Security/PermissionGate.tsx
interface PermissionGateProps {
  action: Action;
  resource: ResourceType;
  resourceId?: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({
  action,
  resource,
  resourceId,
  fallback = null,
  children,
}: PermissionGateProps) {
  const { can, loading } = usePermissions();

  if (loading) return <Skeleton />;
  if (!can(action, resource, resourceId)) return fallback;
  return children;
}

// Usage
<PermissionGate action="update" resource="course" resourceId={courseId}>
  <EditCourseButton />
</PermissionGate>
```

#### 3.3.3 Update Existing Components

**`useAdminStatus` Refactor**:

```typescript
// components/Hooks/useAdminStatus.tsx
function useAdminStatus(): UseAdminStatusReturn {
  const { permissions, loading, can } = usePermissions();
  const org = useOrg();

  const isAdmin = useMemo(() => {
    if (!permissions?.roles) return false;
    return permissions.roles.some(r =>
      ['admin', 'superadmin', 'org-admin'].includes(r.slug)
    );
  }, [permissions]);

  const isMaintainer = useMemo(() => {
    if (!permissions?.roles) return false;
    return permissions.roles.some(r =>
      ['maintainer', 'admin', 'superadmin'].includes(r.slug)
    );
  }, [permissions]);

  // Convert to old rights format for backward compatibility
  const rights = useMemo(() => {
    if (!permissions) return {};
    return convertPermissionsToRights(permissions);
  }, [permissions]);

  return {
    isAdmin,
    isMaintainer,
    loading,
    userRoles: permissions?.roles ?? [],
    rights,
    can,
  };
}
```

#### 3.3.4 Real-time Permission Updates

**WebSocket Integration**:

```typescript
// hooks/usePermissionUpdates.ts
export function usePermissionUpdates(userId: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const ws = new WebSocket(`${WS_URL}/permissions/updates/${userId}`);

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'permission_change') {
        queryClient.invalidateQueries(['permissions', userId]);
      }
    };

    return () => ws.close();
  }, [userId, queryClient]);
}
```

### Phase 4: Optimization & Polish (Week 7-8)

#### 3.4.1 Performance Optimization

**Cache Strategy**:

```python
# Permission cache keys
CACHE_KEYS = {
    "user_roles": "rbac:user:{user_id}:roles:{org_id}",
    "role_permissions": "rbac:role:{role_id}:permissions",
    "permission_check": "rbac:check:{user_id}:{action}:{resource}:{resource_id}:{org_id}",
}

# TTL configuration
CACHE_TTL = {
    "user_roles": 300,        # 5 minutes
    "role_permissions": 600,  # 10 minutes
    "permission_check": 60,   # 1 minute
}
```

**Cache Invalidation**:

```python
async def invalidate_user_permissions(user_id: int):
    """Invalidate all cached permissions for a user."""
    pattern = f"rbac:user:{user_id}:*"
    await delete_keys_by_pattern(pattern)

async def invalidate_role_permissions(role_id: int):
    """Invalidate cached permissions for a role and all users with that role."""
    # Delete role cache
    await delete_keys_by_pattern(f"rbac:role:{role_id}:*")

    # Get all users with this role and invalidate their caches
    user_ids = await get_users_with_role(role_id)
    for user_id in user_ids:
        await invalidate_user_permissions(user_id)
```

#### 3.4.2 Audit Log Improvements

**Enhanced Audit Schema**:

```python
class PermissionAuditLogCreate(SQLModelStrictBaseModel):
    user_id: int | None
    action: AuditAction
    permission_action: Action
    resource_type: ResourceType
    resource_id: str | None
    org_id: int | None
    result: bool
    ip_address: str | None
    user_agent: str | None
    request_path: str | None
    request_method: str | None
    duration_ms: int | None
    context: dict | None  # Additional context data
```

**Audit Query API**:

```python
@router.get("/audit/permissions")
async def get_permission_audit_logs(
    user_id: int | None = None,
    action: Action | None = None,
    resource_type: ResourceType | None = None,
    result: bool | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = 1,
    limit: int = 50,
):
    """Query permission audit logs with filtering."""
    ...
```

#### 3.4.3 Admin UI Improvements

**Role Management UI**:

- Drag-and-drop permission assignment
- Visual role hierarchy editor
- Bulk user-role assignment
- Permission templates for common use cases

**Audit Dashboard**:

- Real-time permission check visualization
- Failed access attempt alerts
- Permission usage analytics
- Role comparison tool

---

## 4. Database Schema

### 4.1 Final Schema

```sql
-- Core permission definitions
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    scope VARCHAR(20) DEFAULT 'all',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(resource_type, action, scope)
);

-- Role definitions with hierarchy
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    org_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
    parent_role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    is_system BOOLEAN DEFAULT FALSE,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(slug, org_id)
);

-- Role-permission junction
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    conditions JSONB,  -- ABAC conditions
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES "user"(id),
    UNIQUE(role_id, permission_id)
);

-- User-role assignments
CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    org_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by INTEGER REFERENCES "user"(id),
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, role_id, org_id)
);

-- Resource-level permission overrides
CREATE TABLE resource_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES "user"(id),
    expires_at TIMESTAMPTZ
);

-- Audit logging
CREATE TABLE permission_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    audit_action VARCHAR(20) NOT NULL,
    permission_action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100),
    org_id INTEGER,
    result BOOLEAN NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    request_path TEXT,
    duration_ms INTEGER,
    context JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX ix_permissions_resource_action ON permissions(resource_type, action);
CREATE INDEX ix_roles_org_id ON roles(org_id);
CREATE INDEX ix_roles_slug ON roles(slug);
CREATE INDEX ix_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX ix_user_roles_user_id ON user_roles(user_id);
CREATE INDEX ix_user_roles_org_id ON user_roles(org_id);
CREATE INDEX ix_resource_permissions_user_resource ON resource_permissions(user_id, resource_type, resource_id);
CREATE INDEX ix_audit_log_user_id ON permission_audit_log(user_id);
CREATE INDEX ix_audit_log_created_at ON permission_audit_log(created_at);
```

### 4.2 Default Permissions

```python
DEFAULT_PERMISSIONS = [
    # Organization
    {"name": "organization:read:all", "resource_type": "organization", "action": "read", "scope": "all"},
    {"name": "organization:update:org", "resource_type": "organization", "action": "update", "scope": "org"},
    {"name": "organization:manage:org", "resource_type": "organization", "action": "manage", "scope": "org"},
    {"name": "organization:invite:org", "resource_type": "organization", "action": "invite", "scope": "org"},

    # Courses
    {"name": "course:create:org", "resource_type": "course", "action": "create", "scope": "org"},
    {"name": "course:read:all", "resource_type": "course", "action": "read", "scope": "all"},
    {"name": "course:update:own", "resource_type": "course", "action": "update", "scope": "own"},
    {"name": "course:update:all", "resource_type": "course", "action": "update", "scope": "all"},
    {"name": "course:delete:own", "resource_type": "course", "action": "delete", "scope": "own"},
    {"name": "course:delete:all", "resource_type": "course", "action": "delete", "scope": "all"},
    {"name": "course:manage:own", "resource_type": "course", "action": "manage", "scope": "own"},

    # Activities
    {"name": "activity:create:own", "resource_type": "activity", "action": "create", "scope": "own"},
    {"name": "activity:read:all", "resource_type": "activity", "action": "read", "scope": "all"},
    {"name": "activity:update:own", "resource_type": "activity", "action": "update", "scope": "own"},
    {"name": "activity:delete:own", "resource_type": "activity", "action": "delete", "scope": "own"},
    {"name": "activity:submit:all", "resource_type": "activity", "action": "submit", "scope": "all"},

    # Users
    {"name": "user:read:all", "resource_type": "user", "action": "read", "scope": "all"},
    {"name": "user:update:own", "resource_type": "user", "action": "update", "scope": "own"},
    {"name": "user:update:org", "resource_type": "user", "action": "update", "scope": "org"},
    {"name": "user:manage:org", "resource_type": "user", "action": "manage", "scope": "org"},

    # Roles
    {"name": "role:create:org", "resource_type": "role", "action": "create", "scope": "org"},
    {"name": "role:read:org", "resource_type": "role", "action": "read", "scope": "org"},
    {"name": "role:update:org", "resource_type": "role", "action": "update", "scope": "org"},
    {"name": "role:delete:org", "resource_type": "role", "action": "delete", "scope": "org"},
    {"name": "role:manage:org", "resource_type": "role", "action": "manage", "scope": "org"},

    # Analytics
    {"name": "analytics:read:org", "resource_type": "analytics", "action": "read", "scope": "org"},
    {"name": "analytics:export:org", "resource_type": "analytics", "action": "export", "scope": "org"},

    # Payments
    {"name": "payment:read:org", "resource_type": "payment", "action": "read", "scope": "org"},
    {"name": "payment:manage:org", "resource_type": "payment", "action": "manage", "scope": "org"},
]
```

### 4.3 Default Roles

```python
DEFAULT_ROLES = {
    "admin": {
        "name": "Admin",
        "slug": "admin",
        "description": "Full access to all organization resources",
        "is_system": True,
        "priority": 100,
        "permissions": ["*"],  # All permissions
    },
    "maintainer": {
        "name": "Maintainer",
        "slug": "maintainer",
        "description": "Can manage content and moderate users",
        "is_system": True,
        "priority": 80,
        "parent": "admin",
        "permissions": [
            "organization:read:all",
            "course:*:all",
            "activity:*:all",
            "user:read:org",
            "user:update:org",
            "analytics:read:org",
        ],
    },
    "instructor": {
        "name": "Instructor",
        "slug": "instructor",
        "description": "Can create and manage own courses",
        "is_system": True,
        "priority": 60,
        "parent": "maintainer",
        "permissions": [
            "organization:read:all",
            "course:create:org",
            "course:read:all",
            "course:update:own",
            "course:delete:own",
            "course:manage:own",
            "activity:*:own",
            "user:read:all",
            "analytics:read:own",
        ],
    },
    "user": {
        "name": "User",
        "slug": "user",
        "description": "Standard user with basic access",
        "is_system": True,
        "priority": 20,
        "parent": "instructor",
        "permissions": [
            "organization:read:all",
            "course:read:all",
            "activity:read:all",
            "activity:submit:all",
            "user:read:own",
            "user:update:own",
        ],
    },
}
```

---

## 5. API Design

### 5.1 Permission Endpoints

```
GET    /api/permissions                  # List all permissions
GET    /api/permissions/{id}             # Get permission by ID
POST   /api/permissions                  # Create permission (admin only)
PUT    /api/permissions/{id}             # Update permission (admin only)
DELETE /api/permissions/{id}             # Delete permission (admin only)

GET    /api/permissions/check            # Check single permission
POST   /api/permissions/batch-check      # Check multiple permissions
GET    /api/permissions/user/{user_id}   # Get user's effective permissions
```

### 5.2 Role Endpoints

```
GET    /api/roles                        # List roles (filtered by org)
GET    /api/roles/{id}                   # Get role with permissions
POST   /api/roles                        # Create custom role
PUT    /api/roles/{id}                   # Update role
DELETE /api/roles/{id}                   # Delete role (non-system only)

GET    /api/roles/{id}/permissions       # Get role permissions
POST   /api/roles/{id}/permissions       # Add permission to role
DELETE /api/roles/{id}/permissions/{pid} # Remove permission from role
```

### 5.3 User Role Endpoints

```
GET    /api/users/{id}/roles             # Get user's roles
POST   /api/users/{id}/roles             # Assign role to user
DELETE /api/users/{id}/roles/{role_id}   # Remove role from user
```

### 5.4 Audit Endpoints

```
GET    /api/audit/permissions            # Query audit logs
GET    /api/audit/permissions/stats      # Get audit statistics
GET    /api/audit/permissions/export     # Export audit logs
```

---

## 6. Frontend Integration

### 6.1 Type Definitions

```typescript
// types/permissions.ts

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

export const ResourceTypes = {
  ORGANIZATION: 'organization',
  COURSE: 'course',
  CHAPTER: 'chapter',
  ACTIVITY: 'activity',
  ASSIGNMENT: 'assignment',
  QUIZ: 'quiz',
  USER: 'user',
  USERGROUP: 'usergroup',
  COLLECTION: 'collection',
  ROLE: 'role',
  CERTIFICATE: 'certificate',
  DISCUSSION: 'discussion',
  FILE: 'file',
  ANALYTICS: 'analytics',
  TRAIL: 'trail',
  EXAM: 'exam',
  PAYMENT: 'payment',
  API_TOKEN: 'api_token',
} as const;

export interface Permission {
  id: number;
  name: string;
  resource_type: ResourceType;
  action: Action;
  scope: Scope;
  description?: string;
}

export interface Role {
  id: number;
  name: string;
  slug: string;
  description?: string;
  org_id?: number;
  parent_role_id?: number;
  is_system: boolean;
  priority: number;
  permissions?: Permission[];
}

export interface UserPermissions {
  user_id: number;
  org_id?: number;
  roles: Role[];
  permissions: Record<string, boolean>;  // permission_name -> allowed
  is_admin: boolean;
  is_anonymous: boolean;
}
```

### 6.2 Service Functions

```typescript
// services/permissions/permissions.ts

export async function fetchUserPermissions(
  accessToken: string,
  orgId?: number
): Promise<UserPermissions> {
  const params = new URLSearchParams();
  if (orgId) params.set('org_id', orgId.toString());

  const response = await fetch(`${API_URL}/permissions/me?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new Error('Failed to fetch permissions');
  return response.json();
}

export async function checkPermission(
  accessToken: string,
  action: Action,
  resource: ResourceType,
  resourceId?: string,
  orgId?: number
): Promise<boolean> {
  const params = new URLSearchParams({
    action,
    resource,
    ...(resourceId && { resource_id: resourceId }),
    ...(orgId && { org_id: orgId.toString() }),
  });

  const response = await fetch(`${API_URL}/permissions/check?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();
  return data.allowed;
}

export async function batchCheckPermissions(
  accessToken: string,
  checks: PermissionCheck[]
): Promise<Record<string, boolean>> {
  const response = await fetch(`${API_URL}/permissions/batch-check`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ checks }),
  });

  const results = await response.json();
  return results.reduce((acc, r) => {
    acc[`${r.resource}:${r.action}:${r.resource_id || 'all'}`] = r.allowed;
    return acc;
  }, {});
}
```

### 6.3 Context Provider

```typescript
// components/providers/PermissionProvider.tsx

interface PermissionContextValue {
  permissions: UserPermissions | null;
  loading: boolean;
  error: Error | null;
  can: (action: Action, resource: ResourceType, resourceId?: string) => boolean;
  refresh: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { data: session } = usePlatformSession();
  const org = useOrg();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPermissions = useCallback(async () => {
    if (!session?.tokens?.access_token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const perms = await fetchUserPermissions(
        session.tokens.access_token,
        org?.id
      );
      setPermissions(perms);
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [session, org?.id]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const can = useCallback(
    (action: Action, resource: ResourceType, resourceId?: string) => {
      if (!permissions) return false;
      if (permissions.is_admin) return true;

      const key = `${resource}:${action}:${resourceId || 'all'}`;
      return permissions.permissions[key] ?? false;
    },
    [permissions]
  );

  return (
    <PermissionContext.Provider
      value={{ permissions, loading, error, can, refresh: fetchPermissions }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within PermissionProvider');
  }
  return context;
}
```

---

## 7. Migration Strategy

### 7.1 Data Migration Steps

1. **Verify migration**

   ```python
   # Check that all roles have permissions
   def verify_migration():
       roles = db.exec(select(RoleNew)).all()
       for role in roles:
           perms = db.exec(
               select(RolePermission).where(RolePermission.role_id == role.id)
           ).all()
           assert len(perms) > 0, f"Role {role.slug} has no permissions"
   ```

2. **Switch to new system**
   - Update all service imports
   - Enable new permission checker
   - Monitor for errors

3. **Cleanup**
   - Remove old `roles` table
   - Remove `rights` column
   - Archive old migration files

### 7.2 Rollback Plan

```python
def rollback_to_old_system():
    """Emergency rollback procedure."""
    # 1. Disable new permission checker
    # 2. Restore old roles table from backup
    # 3. Re-enable old RBAC code
    # 4. Clear Redis cache
    pass
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

```python
# tests/security/test_rbac_new.py

class TestPermissionChecker:
    def test_anonymous_can_read_public_course(self):
        checker = PermissionChecker(db)
        result = checker.check(
            AnonymousUser(),
            Action.READ,
            ResourceType.COURSE,
            "course_public123"
        )
        assert result is True

    def test_anonymous_cannot_create_course(self):
        checker = PermissionChecker(db)
        with pytest.raises(HTTPException) as exc:
            checker.require(
                AnonymousUser(),
                Action.CREATE,
                ResourceType.COURSE
            )
        assert exc.value.status_code == 401

    def test_instructor_can_create_course(self):
        user = create_user_with_role("instructor")
        checker = PermissionChecker(db)
        result = checker.check(user, Action.CREATE, ResourceType.COURSE)
        assert result is True

    def test_user_cannot_delete_others_course(self):
        owner = create_user_with_role("instructor")
        other = create_user_with_role("user")
        course = create_course(owner)

        checker = PermissionChecker(db)
        result = checker.check(other, Action.DELETE, ResourceType.COURSE, course.course_uuid)
        assert result is False

    def test_admin_can_do_anything(self):
        admin = create_user_with_role("admin")
        checker = PermissionChecker(db)

        for action in Action:
            for resource in ResourceType:
                result = checker.check(admin, action, resource)
                assert result is True
```

### 8.2 Integration Tests

```python
# tests/integration/test_rbac_api.py

async def test_permission_check_endpoint():
    async with AsyncClient(app, base_url="http://test") as client:
        # Login as instructor
        token = await login("instructor@test.com")

        # Check course create permission
        response = await client.get(
            "/api/permissions/check",
            params={"action": "create", "resource": "course"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        assert response.json()["allowed"] is True

async def test_role_assignment():
    async with AsyncClient(app, base_url="http://test") as client:
        admin_token = await login("admin@test.com")

        # Assign instructor role to user
        response = await client.post(
            "/api/users/123/roles",
            json={"role_slug": "instructor", "org_id": 1},
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200

        # Verify user now has instructor permissions
        user_token = await login("user123@test.com")
        response = await client.get(
            "/api/permissions/check",
            params={"action": "create", "resource": "course"},
            headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.json()["allowed"] is True
```

---

## 9. Security Considerations

### 9.1 Security Best Practices

1. **Defense in Depth**
   - Check permissions at API layer AND service layer
   - Never trust client-side permission checks alone
   - Validate resource ownership on every mutation

2. **Least Privilege**
   - Users start with minimal permissions
   - Require explicit grants for elevated access
   - Time-limit elevated permissions when possible

3. **Audit Everything**
   - Log all permission checks
   - Track who granted/revoked permissions
   - Maintain audit trail for compliance

4. **Fail Secure**
   - Default to DENY on errors
   - Never cache permission denials indefinitely
   - Handle cache failures gracefully

### 9.2 Common Attack Vectors

| Attack                                  | Mitigation                                               |
| --------------------------------------- | -------------------------------------------------------- |
| IDOR (Insecure Direct Object Reference) | Always verify ownership/access before returning data     |
| Privilege Escalation                    | Prevent users from assigning roles higher than their own |
| Cache Poisoning                         | Use secure cache keys, validate on cache miss            |
| Session Hijacking                       | Short TTLs, re-validate on sensitive operations          |
| Mass Assignment                         | Explicit allow-lists for updatable fields                |

### 9.3 Rate Limiting

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

@router.get("/permissions/check")
@limiter.limit("100/minute")  # 100 checks per minute per user
async def check_permission(...):
    ...

@router.post("/roles")
@limiter.limit("10/minute")  # 10 role creates per minute
async def create_role(...):
    ...
```

---

## Appendix A: Permission Matrix

| Role       | Course Create | Course Read | Course Update | Course Delete | User Manage | Role Manage |
| ---------- | ------------- | ----------- | ------------- | ------------- | ----------- | ----------- |
| Admin      | ✅ all         | ✅ all       | ✅ all         | ✅ all         | ✅ org       | ✅ org       |
| Maintainer | ✅ org         | ✅ all       | ✅ all         | ✅ all         | ✅ org       | ❌           |
| Instructor | ✅ org         | ✅ all       | ✅ own         | ✅ own         | ❌           | ❌           |
| User       | ❌             | ✅ all       | ❌             | ❌             | ❌           | ❌           |
| Anonymous  | ❌             | ✅ public    | ❌             | ❌             | ❌           | ❌           |

---

## Appendix B: API Error Codes

| Code       | Status | Description                 |
| ---------- | ------ | --------------------------- |
| `PERM_001` | 401    | Authentication required     |
| `PERM_002` | 403    | Permission denied           |
| `PERM_003` | 403    | Insufficient role level     |
| `PERM_004` | 404    | Permission not found        |
| `PERM_005` | 404    | Role not found              |
| `PERM_006` | 409    | Role already exists         |
| `PERM_007` | 409    | Permission already assigned |
| `PERM_008` | 422    | Cannot modify system role   |

---

## Appendix C: Glossary

- **RBAC**: Role-Based Access Control
- **ABAC**: Attribute-Based Access Control
- **Permission**: A specific action on a resource type (e.g., `course:create`)
- **Role**: A collection of permissions (e.g., `instructor`)
- **Scope**: The extent of a permission (`all`, `own`, `org`, `assigned`)
- **Resource**: An entity in the system (course, user, organization, etc.)
- **Policy**: Custom logic for resource-specific permission checks
- **Audit**: Record of permission checks and changes
