# RBAC System Refactoring Plan

## Executive Summary

Redesign and implement a modern, secure, scalable Role-Based Access Control (RBAC) system with fine-grained permissions, proper hierarchy, and clear separation of concerns.

---

## 1. Current System Analysis

### Current Architecture Issues

| Issue                       | Description                                                                                       | Impact                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Magic Numbers**           | Hardcoded role IDs (`role_id == 1`, `role_id == 2`, `role_id == 4`) scattered throughout codebase | Fragile, error-prone, hard to maintain                  |
| **Flat Permission Model**   | Permissions are simple booleans without context                                                   | No conditional permissions, no attribute-based controls |
| **No Permission Hierarchy** | No inheritance between roles                                                                      | Redundant permission definitions                        |
| **Mixed Concerns**          | RBAC logic mixed with business logic in services                                                  | Hard to audit, test, and maintain                       |
| **No Audit Trail**          | No logging of permission checks or changes                                                        | Security/compliance issues                              |
| **Static Roles**            | Default roles (Admin=1, Maintainer=2, Instructor=3, User=4) are hardcoded                         | Limited flexibility                                     |
| **UUID Prefix Routing**     | Element type detection via string prefixes (`course_`, `user_`)                                   | Brittle, not type-safe                                  |
| **Async Everywhere**        | All RBAC functions are async but don't need to be                                                 | Unnecessary complexity                                  |

### Current Permission Structure

```python
# Current Rights model
class Rights:
    courses: PermissionsWithOwn     # CRUD + own variants
    users: Permission               # CRUD
    usergroups: Permission          # CRUD
    collections: Permission         # CRUD
    organizations: Permission       # CRUD
    coursechapters: Permission      # CRUD
    activities: Permission          # CRUD
    roles: Permission               # CRUD
    dashboard: DashboardPermission  # access only
```

---

## 2. Proposed Architecture

### 2.1 Core Design Principles

1. **Principle of Least Privilege** - Default deny, explicit allow
2. **Separation of Concerns** - RBAC as a standalone layer
3. **Type Safety** - Enums and typed permissions everywhere
4. **Hierarchical Roles** - Role inheritance to reduce redundancy
5. **Contextual Permissions** - Permissions with conditions
6. **Audit Everything** - Log all permission checks and changes
7. **Zero Magic Numbers** - Named constants/enums only

### 2.2 New Permission Model

```python
# New permission system with granular controls

class Action(str, Enum):
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    MANAGE = "manage"      # Full control including settings
    MODERATE = "moderate"  # Approve/reject content
    EXPORT = "export"      # Export data
    INVITE = "invite"      # Invite users

class ResourceType(str, Enum):
    ORGANIZATION = "organization"
    COURSE = "course"
    CHAPTER = "chapter"
    ACTIVITY = "activity"
    ASSIGNMENT = "assignment"
    QUIZ = "quiz"
    USER = "user"
    USERGROUP = "usergroup"
    COLLECTION = "collection"
    ROLE = "role"
    CERTIFICATE = "certificate"
    DISCUSSION = "discussion"
    FILE = "file"
    ANALYTICS = "analytics"

class Scope(str, Enum):
    ALL = "all"           # All resources of type
    OWN = "own"           # Only owned resources
    ASSIGNED = "assigned" # Assigned to user
    ORG = "org"           # Within organization

class Permission(BaseModel):
    resource: ResourceType
    action: Action
    scope: Scope = Scope.ALL
    conditions: dict | None = None  # Optional ABAC conditions
```

### 2.3 Role Hierarchy

```
SuperAdmin (Platform-wide)
    └── OrgAdmin (Organization-wide)
            ├── Maintainer (Content management)
            │       └── Instructor (Course-level)
            │               └── Assistant (Limited course access)
            └── Moderator (Community management)

User (Base authenticated user)
Guest (Unauthenticated)
```

### 2.4 New Database Schema

```sql
-- Core RBAC Tables

CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,        -- e.g., "course:create:org"
    resource_type VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    scope VARCHAR(50) NOT NULL DEFAULT 'all',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,        -- e.g., "org-admin", "instructor"
    description TEXT,
    org_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
    parent_role_id INTEGER REFERENCES roles(id), -- For hierarchy
    is_system BOOLEAN DEFAULT FALSE,          -- Built-in vs custom
    priority INTEGER DEFAULT 0,               -- For conflict resolution
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, org_id)
);

CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    conditions JSONB,                         -- ABAC conditions
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES user(id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id INTEGER REFERENCES user(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    org_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES user(id),
    expires_at TIMESTAMPTZ,                   -- Optional expiry
    PRIMARY KEY (user_id, role_id, org_id)
);

-- Resource-level permissions (for specific resource overrides)
CREATE TABLE resource_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user(id) ON DELETE CASCADE,
    resource_type VARCHAR(50) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,        -- UUID of resource
    permission_id INTEGER REFERENCES permissions(id),
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by INTEGER REFERENCES user(id),
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, resource_type, resource_id, permission_id)
);

-- Audit log
CREATE TABLE permission_audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(50) NOT NULL,              -- check, grant, revoke
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    permission_name VARCHAR(100),
    result BOOLEAN,
    context JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permission_audit_user ON permission_audit_log(user_id, created_at);
CREATE INDEX idx_permission_audit_resource ON permission_audit_log(resource_type, resource_id);
```

---

## 3. Implementation Plan

### Phase 1: Foundation

#### 1.1 Create New Permission Models

```
apps/api/src/db/
├── permissions/
│   ├── __init__.py
│   ├── models.py          # Permission, Role, UserRole, etc.
│   ├── enums.py           # Action, ResourceType, Scope enums
│   └── audit.py           # Audit log models
```

#### 1.2 Create Permission Service Layer

```
apps/api/src/services/
├── permissions/
│   ├── __init__.py
│   ├── permission_service.py   # Core permission operations
│   ├── role_service.py         # Role management
│   ├── policy_engine.py        # Permission evaluation
│   └── audit_service.py        # Audit logging
```

#### 1.3 Create New RBAC Module

```
apps/api/src/security/
├── rbac/
│   ├── __init__.py
│   ├── checker.py         # Main PermissionChecker class
│   ├── decorators.py      # @require_permission decorator
│   ├── dependencies.py    # FastAPI dependencies
│   ├── context.py         # Permission context (user, org, resource)
│   └── policies/          # Resource-specific policies
│       ├── __init__.py
│       ├── base.py
│       ├── course.py
│       ├── organization.py
│       └── user.py
```

### Phase 2: Core Implementation

#### 2.1 Permission Checker Class

```python
class PermissionChecker:
    """Central permission checking with caching and audit"""

    def __init__(self, db: Session, cache: Redis | None = None):
        self.db = db
        self.cache = cache
        self.audit = AuditService(db)

    async def check(
        self,
        user: PublicUser,
        action: Action,
        resource: ResourceType,
        resource_id: str | None = None,
        org_id: int | None = None,
        context: dict | None = None,
    ) -> bool:
        """
        Check if user has permission to perform action on resource.

        1. Check cache
        2. Load user roles (with inheritance)
        3. Evaluate role permissions
        4. Check resource-specific permissions
        5. Evaluate ABAC conditions
        6. Log to audit
        7. Cache result
        """
        ...

    def require(self, ...) -> None:
        """Check and raise HTTPException if denied"""
        if not await self.check(...):
            self.audit.log_denied(...)
            raise HTTPException(403, "Permission denied")
```

#### 2.2 FastAPI Dependencies

```python
# Dependency injection for routes
def get_permission_checker(
    db: Session = Depends(get_db_session),
) -> PermissionChecker:
    return PermissionChecker(db)

# Decorator for routes
def require_permission(
    action: Action,
    resource: ResourceType,
    resource_id_param: str | None = None,  # Path param name
):
    def decorator(func):
        @wraps(func)
        async def wrapper(
            *args,
            checker: PermissionChecker = Depends(get_permission_checker),
            current_user: PublicUser = Depends(get_current_user),
            **kwargs
        ):
            resource_id = kwargs.get(resource_id_param) if resource_id_param else None
            checker.require(current_user, action, resource, resource_id)
            return await func(*args, **kwargs)
        return wrapper
    return decorator

# Usage in routes:
@router.put("/courses/{course_uuid}")
@require_permission(Action.UPDATE, ResourceType.COURSE, "course_uuid")
async def update_course(...):
    ...
```

### Phase 3: Migration

#### 3.1 Database Migration

1. Create new tables alongside old ones
2. Migrate existing roles to new schema
3. Map old permissions to new permission system
4. Migrate user_organizations to user_roles
5. Validate data integrity

#### 3.2 Seed Default Permissions

```python
DEFAULT_PERMISSIONS = [
    # Organization
    Permission(resource=ResourceType.ORGANIZATION, action=Action.READ, scope=Scope.OWN),
    Permission(resource=ResourceType.ORGANIZATION, action=Action.UPDATE, scope=Scope.OWN),
    Permission(resource=ResourceType.ORGANIZATION, action=Action.MANAGE, scope=Scope.OWN),

    # Course
    Permission(resource=ResourceType.COURSE, action=Action.CREATE, scope=Scope.ORG),
    Permission(resource=ResourceType.COURSE, action=Action.READ, scope=Scope.ALL),
    Permission(resource=ResourceType.COURSE, action=Action.UPDATE, scope=Scope.OWN),
    Permission(resource=ResourceType.COURSE, action=Action.DELETE, scope=Scope.OWN),
    Permission(resource=ResourceType.COURSE, action=Action.MANAGE, scope=Scope.OWN),
    # ... more
]

DEFAULT_ROLES = {
    "super-admin": {
        "permissions": ["*:*:*"],  # All permissions
        "is_system": True,
        "priority": 100,
    },
    "org-admin": {
        "permissions": [
            "organization:manage:own",
            "course:*:org",
            "user:*:org",
            "role:*:org",
            # ...
        ],
        "is_system": True,
        "priority": 90,
    },
    "instructor": {
        "permissions": [
            "course:create:org",
            "course:update:own",
            "course:delete:own",
            "chapter:*:own",
            "activity:*:own",
            # ...
        ],
        "is_system": True,
        "priority": 50,
    },
    "user": {
        "permissions": [
            "course:read:all",
            "profile:update:own",
            # ...
        ],
        "is_system": True,
        "priority": 10,
    },
}
```

#### 3.3 Gradual Route Migration

```python
# Old approach (to be replaced):
async def courses_rbac_check(request, course_uuid, current_user, action, db_session, ...):
    ...

# New approach:
@router.post("/courses")
async def create_course(
    checker: PermissionChecker = Depends(get_permission_checker),
    current_user: PublicUser = Depends(get_current_user),
    org_id: int = ...,
):
    checker.require(current_user, Action.CREATE, ResourceType.COURSE, org_id=org_id)
    ...
```

### Phase 4: Frontend Integration

#### 4.1 Permission Types

```typescript
// apps/web/types/permissions.ts
export enum Action {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MANAGE = 'manage',
  MODERATE = 'moderate',
}

export enum ResourceType {
  ORGANIZATION = 'organization',
  COURSE = 'course',
  // ...
}

export interface Permission {
  resource: ResourceType;
  action: Action;
  scope: 'all' | 'own' | 'org';
}

export interface UserPermissions {
  roles: string[];
  permissions: Permission[];
  effectivePermissions: Map<string, boolean>; // Cached checks
}
```

#### 4.2 Permission Hook

```typescript
// apps/web/hooks/usePermission.ts
export function usePermission() {
  const { data: session } = useSession();

  const can = useCallback((
    action: Action,
    resource: ResourceType,
    resourceId?: string,
  ): boolean => {
    // Check against session.user.permissions
    ...
  }, [session]);

  return { can, permissions: session?.user?.permissions };
}

// Usage:
const { can } = usePermission();
if (can(Action.UPDATE, ResourceType.COURSE, courseId)) {
  // Show edit button
}
```

#### 4.3 Permission Guard Component

```tsx
// apps/web/components/Security/PermissionGuard.tsx
export function PermissionGuard({
  action,
  resource,
  resourceId,
  fallback = null,
  children,
}: {
  action: Action;
  resource: ResourceType;
  resourceId?: string;
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { can } = usePermission();

  if (!can(action, resource, resourceId)) {
    return fallback;
  }

  return children;
}

// Usage:
<PermissionGuard action={Action.DELETE} resource={ResourceType.COURSE} resourceId={courseId}>
  <DeleteButton />
</PermissionGuard>
```

### Phase 5: Cleanup & Testing

#### 5.1 Remove Legacy Code

- [x] Remove `authorization_verify_*` functions (completed — replaced by PermissionChecker and `src.security.rbac.service_utils`)
- [x] Remove hardcoded role IDs (replaced with checks via Role UUID / `is_admin_or_maintainer` / `check_user_permission`)
- [x] Remove `courses_rbac_check` functions (legacy copies removed; routes/services use `src.security.courses_security`)
- [x] Clean up `user_organizations.role_id` references (replaced hardcoded checks with role_uuid lookup / role-service lookups)
- [ ] Remove old `Rights` model (blocked: requires data migration to `permissions` and `roles_new` tables; plan: write migration to convert `roles.rights` -> `role_permissions` and `role_new` seed)

#### 5.2 Testing Strategy

```
apps/api/src/tests/security/
├── test_permission_checker.py
├── test_role_hierarchy.py
├── test_policies/
│   ├── test_course_policy.py
│   ├── test_org_policy.py
│   └── ...
├── test_audit.py
└── fixtures/
    └── permission_fixtures.py
```

---

## 4. API Changes

### 4.1 New Endpoints

```
# Permission Management
GET    /api/v1/permissions                    # List all permissions
GET    /api/v1/permissions/{permission_id}    # Get permission details

# Role Management (enhanced)
GET    /api/v1/roles                          # List roles (with inheritance info)
POST   /api/v1/roles                          # Create role
GET    /api/v1/roles/{role_id}                # Get role with permissions
PUT    /api/v1/roles/{role_id}                # Update role
DELETE /api/v1/roles/{role_id}                # Delete role
POST   /api/v1/roles/{role_id}/permissions    # Add permission to role
DELETE /api/v1/roles/{role_id}/permissions/{permission_id}  # Remove permission

# User Role Assignment
GET    /api/v1/users/{user_id}/roles          # Get user roles
POST   /api/v1/users/{user_id}/roles          # Assign role
DELETE /api/v1/users/{user_id}/roles/{role_id} # Remove role

# Permission Check (for frontend)
POST   /api/v1/permissions/check              # Batch permission check
GET    /api/v1/me/permissions                 # Get current user's effective permissions

# Audit
GET    /api/v1/audit/permissions              # Permission audit log (admin only)
```

### 4.2 Enhanced `/me/permissions` Response

```json
{
  "user_id": 123,
  "org_id": 1,
  "roles": [
    {
      "id": 3,
      "slug": "instructor",
      "name": "Instructor",
      "inherited_from": null
    }
  ],
  "permissions": {
    "course:create:org": true,
    "course:update:own": true,
    "course:delete:own": true,
    "course:manage:all": false,
    "organization:manage:own": false
  },
  "resource_permissions": [
    {
      "resource_type": "course",
      "resource_id": "course_abc123",
      "permissions": ["update", "delete"]
    }
  ]
}
```

---

## 5. Security Considerations

### 5.1 Security Requirements

- [ ] All permission checks must be server-side
- [ ] Frontend permissions are for UI only, never trust client
- [ ] Rate limit permission check endpoints
- [ ] Log all permission denials with context
- [ ] Implement permission caching with proper invalidation
- [ ] Role changes must immediately invalidate sessions/cache
- [ ] Cannot escalate own permissions
- [ ] Cannot create roles with more permissions than own

### 5.2 Attack Vectors to Address

- Privilege escalation via role modification
- Permission bypass via direct API access
- Session fixation after role changes
- IDOR (Insecure Direct Object Reference)
- Mass assignment of permissions

---

## 6. Migration Checklist

### Backend

- [ ] Create new permission models and migrations
- [ ] Implement PermissionChecker class
- [ ] Create FastAPI dependencies and decorators
- [ ] Implement policy engine
- [ ] Add audit logging
- [ ] Migrate each router to new system
- [ ] Remove legacy RBAC code
- [ ] Update tests

### Frontend

- [ ] Add permission types
- [ ] Implement usePermission hook
- [ ] Create PermissionGuard component
- [ ] Update all permission checks in UI
- [ ] Update role management UI

### Database

- [ ] Create new tables
- [ ] Migrate existing roles
- [ ] Migrate user-role assignments
- [ ] Verify data integrity
- [ ] Remove old columns/tables

---

## 7. Files to Modify/Create

### New Files

```
apps/api/src/db/permissions/
├── __init__.py
├── models.py
├── enums.py
└── audit.py

apps/api/src/services/permissions/
├── __init__.py
├── permission_service.py
├── role_service.py
├── policy_engine.py
└── audit_service.py

apps/api/src/security/rbac/
├── __init__.py (update)
├── checker.py
├── decorators.py
├── dependencies.py
├── context.py
└── policies/
    ├── __init__.py
    ├── base.py
    ├── course.py
    ├── organization.py
    └── user.py

apps/api/migrations/versions/
└── xxxx_rbac_refactor.py

apps/web/types/permissions.ts
apps/web/hooks/usePermission.ts
apps/web/components/Security/PermissionGuard.tsx
```

### Files to Modify

```
apps/api/src/db/roles.py                    # Deprecate Rights model
apps/api/src/db/user_organizations.py       # Remove role_id
apps/api/src/security/rbac/rbac.py          # Replace entirely
apps/api/src/security/rbac/utils.py         # Replace entirely
apps/api/src/security/courses_security.py   # Replace entirely
apps/api/src/routers/roles.py               # Update endpoints
apps/api/src/services/roles/roles.py        # Rewrite
apps/web/services/roles/roles.ts            # Update API calls
apps/web/types/next-auth.d.ts               # Add permissions
```

### Files to Delete (after migration)

```
apps/api/src/security/rbac/rbac.py          # Old implementation
apps/api/src/security/courses_security.py   # Legacy security
```

---

### Migration

create alembic migration in 69fd16a5d534_rbac_rewrite

## References

- [OWASP Access Control Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)
- [Casbin](https://casbin.org/) - For policy engine inspiration
- [Permit.io RBAC Guide](https://www.permit.io/blog/rbac-with-domains)
