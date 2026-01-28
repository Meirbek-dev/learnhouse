# New RBAC System Documentation

**Date:** January 28, 2026
**Version:** 5.0 (Complete Refactor)

---

## Overview

The new RBAC (Role-Based Access Control) system provides a unified, consistent interface for permission checking across the entire application. It replaces the previous fragmented system that had 9+ different `rbac_check_*` functions.

---

## Key Components

### 1. UnifiedPermissionService

**Location:** `src/services/permissions/unified_permission_service.py`

The central service for all permission checks. Provides:

- Single `check()` method for all resource types
- Built-in caching and audit logging
- Policy pattern for resource-specific logic
- Batch permission checking

**Usage:**

```python
from src.services.permissions import get_permission_service
from src.db.permissions.enums import Action, ResourceType

# Get service
service = get_permission_service(db_session)

# Check permission (raises HTTPException if denied)
await service.check(
    user=current_user,
    action=Action.UPDATE,
    resource=ResourceType.COURSE,
    resource_id="course_abc123",
    org_id=1,
)

# Check without raising (returns bool)
can_delete = await service.can(
    user=current_user,
    action=Action.DELETE,
    resource=ResourceType.COURSE,
    resource_id="course_abc123",
)

# Batch check multiple permissions
results = await service.check_batch(
    user=current_user,
    checks=[
        (Action.READ, ResourceType.COURSE, "course_123", 1),
        (Action.UPDATE, ResourceType.COURSE, "course_123", 1),
        (Action.DELETE, ResourceType.COURSE, "course_123", 1),
    ]
)
```

---

### 2. Resource Policies

**Location:** `src/security/rbac/policies/`

Resource-specific permission logic:

- **CoursePolicy** - Public courses, ownership, UserGroup access
- **OrganizationPolicy** - Org admin checks
- **UserPolicy** - Self-management, user admin

Policies are automatically registered and handle edge cases for each resource type.

**Example - CoursePolicy:**

```python
# Public courses can be read by anyone
if action == Action.READ and self._is_public_course(course_uuid):
    return True

# Course owners can update/delete
if self._is_course_contributor(user_id, course_uuid):
    return True
```

---

### 3. Backward Compatibility Layer

**Location:** `src/security/rbac/compat.py`

Provides drop-in replacements for old `rbac_check_*` functions:

```python
# OLD WAY (still works via compat layer)
await rbac_check(request, resource_uuid, user, "update", db)
await courses_rbac_check(request, course_uuid, user, "read", db)

# NEW WAY (recommended)
service = get_permission_service(db)
await service.check(user, Action.UPDATE, ResourceType.COURSE, course_uuid)
```

**Status:** All old functions are deprecated but still functional during migration.

---

## Migration Guide

### Step 1: Update Imports

**Before:**

```python
from src.security.rbac import courses_rbac_check, rbac_check_org
```

**After:**

```python
from src.services.permissions import get_permission_service
from src.db.permissions.enums import Action, ResourceType
```

### Step 2: Update Permission Checks

**Before:**

```python
await courses_rbac_check(
    request=request,
    course_uuid=course.course_uuid,
    current_user=current_user,
    action="update",
    db_session=db,
)
```

**After:**

```python
service = get_permission_service(db)
await service.check(
    user=current_user,
    action=Action.UPDATE,
    resource=ResourceType.COURSE,
    resource_id=course.course_uuid,
)
```

### Step 3: Use Dependency Injection (Recommended)

```python
from fastapi import Depends
from src.services.permissions import UnifiedPermissionService, get_permission_service

@router.post("/courses")
async def create_course(
    data: CourseCreate,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
    permission_service: Annotated[
        UnifiedPermissionService,
        Depends(get_permission_service)
    ],
):
    await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.COURSE,
        org_id=data.org_id,
    )
    # ... create course
```

---

## Features

### ✅ Single Entry Point

- One service for all resource types
- Consistent API across the entire application
- No more confusion about which function to use

### ✅ Built-in Caching

- Redis-backed permission caching
- Automatic cache invalidation
- Configurable cache TTL
- Can be disabled for testing

### ✅ Comprehensive Audit Logging

- All permission checks logged
- InternalUser access tracked
- Configurable audit levels (ALL, ALL_EXCEPT_READS, DENIED_ONLY, NONE)
- Security compliance ready

### ✅ Policy Pattern

- Resource-specific logic isolated in policy classes
- Easy to add new resource types
- Follows Open/Closed Principle
- Clean separation of concerns

### ✅ Batch Checking

- Check multiple permissions in one call
- More efficient than multiple checks
- Reduced database queries

### ✅ Type Safety

- Full TypeScript/Python type hints
- Enum-based actions and resource types
- IDE autocomplete support

---

## Architecture

```
┌─────────────────────────────────────────┐
│     UnifiedPermissionService            │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │  check(user, action, resource)  │   │
│  └─────────────────────────────────┘   │
│              │                          │
│              ▼                          │
│  ┌──────────────────────┐              │
│  │  Policy Dispatcher    │              │
│  └──────────────────────┘              │
│         │        │         │            │
│         ▼        ▼         ▼            │
│  ┌────────┐ ┌──────┐ ┌──────┐          │
│  │Course  │ │ Org  │ │User  │          │
│  │Policy  │ │Policy│ │Policy│          │
│  └────────┘ └──────┘ └──────┘          │
│              │                          │
│              ▼                          │
│  ┌──────────────────────┐              │
│  │  PolicyEngine        │              │
│  │  (Role-based checks) │              │
│  └──────────────────────┘              │
│              │                          │
│       ┌──────┴──────┐                  │
│       ▼             ▼                   │
│  ┌────────┐   ┌───────────┐            │
│  │ Cache  │   │ AuditLog  │            │
│  └────────┘   └───────────┘            │
└─────────────────────────────────────────┘
```

---

## Best Practices

### 1. Always Use Enums

**Don't:**

```python
await service.check(user, "update", "course", course_id)  # ❌ Strings
```

**Do:**

```python
await service.check(
    user=user,
    action=Action.UPDATE,
    resource=ResourceType.COURSE,
    resource_id=course_id
)  # ✅ Enums
```

### 2. Batch Related Checks

**Don't:**

```python
# ❌ Multiple calls
can_read = await service.can(user, Action.READ, ResourceType.COURSE, course_id)
can_update = await service.can(user, Action.UPDATE, ResourceType.COURSE, course_id)
can_delete = await service.can(user, Action.DELETE, ResourceType.COURSE, course_id)
```

**Do:**

```python
# ✅ Single batch call
results = await service.check_batch(
    user=user,
    checks=[
        (Action.READ, ResourceType.COURSE, course_id, None),
        (Action.UPDATE, ResourceType.COURSE, course_id, None),
        (Action.DELETE, ResourceType.COURSE, course_id, None),
    ]
)
can_read = results[(Action.READ, ResourceType.COURSE, course_id, None)]
```

### 3. Use Dependency Injection

**Don't:**

```python
# ❌ Creating service in every function
async def my_endpoint(db: Session = Depends(get_db_session)):
    service = get_permission_service(db)
    await service.check(...)
```

**Do:**

```python
# ✅ Inject service via Depends
async def my_endpoint(
    db: Session = Depends(get_db_session),
    permission_service: UnifiedPermissionService = Depends(get_permission_service),
):
    await permission_service.check(...)
```

### 4. Specify org_id When Available

**Don't:**

```python
await service.check(user, Action.UPDATE, ResourceType.COURSE, course_id)
# ❌ Missing org_id - less efficient
```

**Do:**

```python
await service.check(
    user=user,
    action=Action.UPDATE,
    resource=ResourceType.COURSE,
    resource_id=course_id,
    org_id=course.org_id  # ✅ Includes org context
)
```

---

## Testing

### Unit Tests

```python
from src.services.permissions import get_permission_service
from src.db.permissions.enums import Action, ResourceType

def test_permission_check(db_session, public_user):
    service = get_permission_service(db_session)

    result = await service.can(
        user=public_user,
        action=Action.READ,
        resource=ResourceType.COURSE,
        resource_id="course_123",
    )

    assert isinstance(result, bool)
```

### Integration Tests

```python
@pytest.mark.asyncio
async def test_course_update_requires_ownership(client, db, course, non_owner_user):
    service = get_permission_service(db)

    # Non-owner should be denied
    with pytest.raises(HTTPException) as exc:
        await service.check(
            user=non_owner_user,
            action=Action.UPDATE,
            resource=ResourceType.COURSE,
            resource_id=course.course_uuid,
        )

    assert exc.value.status_code == 403
```

---

## Troubleshooting

### Permission Denied Unexpectedly

1. **Check user roles:**

   ```python
   from src.services.permissions.role_service import RoleService
   role_service = RoleService(db)
   user_roles = role_service.get_user_roles(user.id)
   print([r.role.slug for r in user_roles if r.role])
   ```

2. **Check cache:**

   ```python
   # Disable cache for testing
   service = get_permission_service(db, use_cache=False)
   ```

3. **Check audit log:**

   ```sql
   SELECT * FROM permission_audit_log
   WHERE user_id = :user_id
   ORDER BY logged_at DESC
   LIMIT 10;
   ```

### Performance Issues

1. **Enable caching:**

   ```python
   service = get_permission_service(db, use_cache=True)  # Default
   ```

2. **Use batch checking:**

   ```python
   # Instead of 10 separate checks, batch them
   results = await service.check_batch(user, checks)
   ```

3. **Provide org_id:**

   ```python
   # Helps with cache key generation
   await service.check(user, action, resource, resource_id, org_id=org.id)
   ```

---

## Deprecation Timeline

| Phase | Status | Old Functions | New Approach |
|-------|--------|---------------|--------------|
| **Phase 1** | ✅ Complete | Still work via compat layer | UnifiedPermissionService created |
| **Phase 2** | 🔄 In Progress | Marked as deprecated | Gradual migration |
| **Phase 3** | ⏳ Planned | Warnings logged | All code migrated |
| **Phase 4** | ⏳ Planned | Removed | Compat layer deleted |

**Recommendation:** Migrate to new system now to avoid breaking changes in Phase 4.

---

## Support

For questions or issues with the new RBAC system:

1. Check this documentation
2. Review the test files in `src/tests/security/`
3. Examine the policy implementations in `src/security/rbac/policies/`
4. Create an issue with the `rbac` label

---

## Changelog

### v5.0 (2026-01-28)

- ✅ Created UnifiedPermissionService
- ✅ Implemented Policy Pattern
- ✅ Added batch permission checking
- ✅ Comprehensive audit logging
- ✅ Backward compatibility layer
- ✅ Full test coverage
- ✅ Updated documentation

### v4.0 (2026-01-27)

- Multiple RBAC rewrites (abandoned approach)

### v3.0 and earlier

- Legacy system with 9+ rbac_check functions
