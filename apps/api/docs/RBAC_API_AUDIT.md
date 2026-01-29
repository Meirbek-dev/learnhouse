# RBAC API Endpoints Audit

## Overview

This document audits all backend API endpoints to ensure proper permission checks using the
UnifiedPermissionService.

---

## Audit Status Legend

✅ **VERIFIED** - Endpoint uses UnifiedPermissionService correctly ⚠️ **NEEDS_UPDATE** - Endpoint
needs permission metadata in response ❌ **MISSING** - Endpoint lacks proper permission checks 📝
**REVIEW** - Requires manual review

---

## Critical Endpoints Requiring Permission Checks

### 1. Permissions & Roles (`/api/v1/permissions/*`, `/api/v1/roles/*`)

#### Permissions Management

| Endpoint            | Method | Status | Permission Required   | Notes                   |
| ------------------- | ------ | ------ | --------------------- | ----------------------- |
| `/permissions`      | GET    | ✅     | `permission:read:all` | Lists all permissions   |
| `/permissions/{id}` | GET    | ✅     | `permission:read:all` | Get specific permission |
| `/roles`            | GET    | ✅     | `role:read:org`       | List roles              |
| `/roles`            | POST   | ✅     | `role:create:org`     | Create new role         |
| `/roles/{id}`       | GET    | ✅     | `role:read:org`       | Get specific role       |
| `/roles/{id}`       | PUT    | ✅     | `role:update:org`     | Update role             |
| `/roles/{id}`       | DELETE | ✅     | `role:delete:org`     | Delete role             |

**Recommendations:**

- ✅ All endpoints use authentication
- ⚠️ Add `can_update`, `can_delete` fields to role responses
- 📝 Verify org-level permission scoping for multi-org deployments

#### Role Permissions

| Endpoint                                       | Method | Status | Permission Required | Notes                       |
| ---------------------------------------------- | ------ | ------ | ------------------- | --------------------------- |
| `/roles/{role_id}/permissions/{permission_id}` | POST   | ✅     | `role:manage:org`   | Assign permission to role   |
| `/roles/{role_id}/permissions/{permission_id}` | DELETE | ✅     | `role:manage:org`   | Remove permission from role |

#### User Role Assignment

| Endpoint                           | Method | Status | Permission Required | Notes                 |
| ---------------------------------- | ------ | ------ | ------------------- | --------------------- |
| `/users/{user_id}/roles`           | GET    | ✅     | `user:read:org`     | List user's roles     |
| `/users/{user_id}/roles`           | POST   | ✅     | `user:update:org`   | Assign role to user   |
| `/users/{user_id}/roles/{role_id}` | DELETE | ✅     | `user:update:org`   | Remove role from user |

#### Permission Checks

| Endpoint             | Method | Status | Permission Required | Notes                      |
| -------------------- | ------ | ------ | ------------------- | -------------------------- |
| `/me/permissions`    | GET    | ✅     | Authenticated       | Current user's permissions |
| `/permissions/check` | POST   | ✅     | Authenticated       | Batch permission check     |
| `/permissions/check` | GET    | ✅     | Authenticated       | Single permission check    |

---

### 2. Users (`/api/v1/users/*`)

| Endpoint                     | Method | Status | Permission Required   | Notes             |
| ---------------------------- | ------ | ------ | --------------------- | ----------------- |
| `/profile`                   | GET    | ✅     | Authenticated         | Own profile       |
| `/session`                   | GET    | ✅     | Authenticated         | Session info      |
| `/{org_id}`                  | POST   | ❌     | `user:create:org`     | **ADD CHECK**     |
| `/{org_id}/invite/{code}`    | POST   | ✅     | Public                | Invite acceptance |
| `/id/{user_id}`              | GET    | 📝     | `user:read:org`       | **VERIFY SCOPE**  |
| `/uuid/{user_uuid}`          | GET    | 📝     | `user:read:org`       | **VERIFY SCOPE**  |
| `/username/{username}`       | GET    | 📝     | `user:read:org`       | **VERIFY SCOPE**  |
| `/{user_id}`                 | PUT    | ❌     | `user:update:own/org` | **ADD CHECK**     |
| `/update_avatar/{user_id}`   | PUT    | ❌     | `user:update:own`     | **ADD CHECK**     |
| `/change_password/{user_id}` | PUT    | ❌     | `user:update:own`     | **ADD CHECK**     |
| `/user_id/{user_id}`         | DELETE | ❌     | `user:delete:org`     | **ADD CHECK**     |
| `/{user_id}/courses`         | GET    | ✅     | Authenticated         | User's courses    |

**Recommendations:**

- ❌ Add permission checks to user creation/update/delete endpoints
- 📝 Verify scope checks (own vs org vs all)
- ⚠️ Add `can_update`, `can_delete` to user profile responses

---

### 3. Organizations (`/api/v1/orgs/*`)

| Endpoint            | Method | Status | Permission Required       | Notes                 |
| ------------------- | ------ | ------ | ------------------------- | --------------------- |
| `/`                 | POST   | ✅     | Public                    | Org creation (signup) |
| `/withconfig/`      | POST   | ✅     | Public                    | Org with config       |
| `/{org_id}`         | GET    | ✅     | Public/Member             | Org details           |
| `/{org_id}`         | PUT    | ❌     | `organization:update:own` | **ADD CHECK**         |
| `/{org_id}`         | DELETE | ❌     | `organization:delete:own` | **ADD CHECK**         |
| `/{org_id}/members` | GET    | 📝     | `user:read:org`           | **VERIFY**            |
| `/{org_id}/invite`  | POST   | ❌     | `user:invite:org`         | **ADD CHECK**         |

**Recommendations:**

- ❌ Add permission checks to org update/delete endpoints
- ⚠️ Add `can_update`, `can_delete`, `can_invite` to org responses
- 📝 Review member listing permissions

---

### 4. Courses (`/api/v1/courses/*`)

| Endpoint                | Method | Status | Permission Required      | Notes            |
| ----------------------- | ------ | ------ | ------------------------ | ---------------- |
| `/org/{org_id}`         | GET    | ✅     | Public                   | List org courses |
| `/org/{org_id}`         | POST   | ❌     | `course:create:org`      | **ADD CHECK**    |
| `/{course_id}`          | GET    | ✅     | Public/Member            | Course details   |
| `/{course_id}`          | PUT    | ❌     | `course:update:own/org`  | **ADD CHECK**    |
| `/{course_id}`          | DELETE | ❌     | `course:delete:own/org`  | **ADD CHECK**    |
| `/{course_id}/publish`  | POST   | ❌     | `course:publish:own/org` | **ADD CHECK**    |
| `/{course_id}/chapters` | POST   | ❌     | `course:update:own/org`  | **ADD CHECK**    |

**Recommendations:**

- ❌ **CRITICAL**: Add permission checks to all course modification endpoints
- ⚠️ Add `can_update`, `can_delete`, `can_publish`, `is_owner` to course responses
- 📝 Implement owner vs org-admin vs instructor permission levels
- 📝 Check enrollment-based read access

---

### 5. Activities (`/api/v1/courses/{course_id}/chapters/{chapter_id}/activities/*`)

| Endpoint         | Method | Status | Permission Required       | Notes            |
| ---------------- | ------ | ------ | ------------------------- | ---------------- |
| `/`              | GET    | ✅     | Course Access             | List activities  |
| `/`              | POST   | ❌     | `activity:create:own/org` | **ADD CHECK**    |
| `/{activity_id}` | GET    | ✅     | Course Access             | Activity details |
| `/{activity_id}` | PUT    | ❌     | `activity:update:own/org` | **ADD CHECK**    |
| `/{activity_id}` | DELETE | ❌     | `activity:delete:own/org` | **ADD CHECK**    |

**Recommendations:**

- ❌ Add permission checks for activity CRUD
- ⚠️ Add `can_update`, `can_delete` to activity responses
- 📝 Inherit course ownership for activity permissions

---

### 6. Assignments & Submissions (`/api/v1/assignments/*`)

| Endpoint                             | Method | Status | Permission Required            | Notes              |
| ------------------------------------ | ------ | ------ | ------------------------------ | ------------------ |
| `/{assignment_id}`                   | GET    | ✅     | Course Access                  | Assignment details |
| `/{assignment_id}`                   | PUT    | ❌     | `assignment:update:own/org`    | **ADD CHECK**      |
| `/{assignment_id}/submissions`       | GET    | ❌     | `submission:read:org/assigned` | **ADD CHECK**      |
| `/{assignment_id}/submissions`       | POST   | ✅     | `submission:create:own`        | Student submission |
| `/submissions/{submission_id}`       | GET    | ❌     | `submission:read:own/assigned` | **ADD CHECK**      |
| `/submissions/{submission_id}/grade` | POST   | ❌     | `submission:grade:assigned`    | **ADD CHECK**      |

**Recommendations:**

- ❌ **CRITICAL**: Add permission checks for grading endpoints
- 📝 Implement `assigned` scope for instructors assigned to grade
- ⚠️ Add `can_grade`, `can_update` to assignment responses
- 📝 Students should only see their own submissions

---

### 7. Exams & Quizzes (`/api/v1/exams/*`, `/api/v1/quizzes/*`)

| Endpoint             | Method | Status | Permission Required      | Notes              |
| -------------------- | ------ | ------ | ------------------------ | ------------------ |
| `/{exam_id}`         | GET    | ✅     | Course Access            | Exam details       |
| `/{exam_id}`         | PUT    | ❌     | `exam:update:own/org`    | **ADD CHECK**      |
| `/{exam_id}/start`   | POST   | ✅     | Course Access            | Start exam attempt |
| `/{exam_id}/submit`  | POST   | ✅     | Course Access            | Submit exam        |
| `/{exam_id}/results` | GET    | ❌     | `exam:read:own/assigned` | **ADD CHECK**      |

**Recommendations:**

- ❌ Add permission checks for exam management
- 📝 Verify students can only see their own results
- ⚠️ Add `can_update`, `can_delete`, `can_view_results` to exam responses

---

### 8. Discussions (`/api/v1/discussions/*`)

| Endpoint                    | Method | Status | Permission Required         | Notes              |
| --------------------------- | ------ | ------ | --------------------------- | ------------------ |
| `/`                         | GET    | ✅     | Course Access               | List discussions   |
| `/`                         | POST   | ✅     | `discussion:create:org`     | Create discussion  |
| `/{discussion_id}`          | GET    | ✅     | Course Access               | Discussion details |
| `/{discussion_id}`          | PUT    | ❌     | `discussion:update:own`     | **ADD CHECK**      |
| `/{discussion_id}`          | DELETE | ❌     | `discussion:delete:own/org` | **ADD CHECK**      |
| `/{discussion_id}/comments` | POST   | ✅     | Course Access               | Add comment        |
| `/comments/{comment_id}`    | DELETE | ❌     | `comment:delete:own/org`    | **ADD CHECK**      |

**Recommendations:**

- ❌ Add owner checks for discussion/comment updates
- 📝 Allow instructors to delete any comments (moderation)
- ⚠️ Add `can_update`, `can_delete`, `is_owner` to discussion responses

---

### 9. User Groups (`/api/v1/usergroups/*`)

| Endpoint                    | Method | Status | Permission Required    | Notes         |
| --------------------------- | ------ | ------ | ---------------------- | ------------- |
| `/`                         | POST   | ❌     | `usergroup:create:org` | **ADD CHECK** |
| `/{usergroup_id}`           | GET    | ❌     | `usergroup:read:org`   | **ADD CHECK** |
| `/{usergroup_id}`           | PUT    | ❌     | `usergroup:update:org` | **ADD CHECK** |
| `/{usergroup_id}`           | DELETE | ❌     | `usergroup:delete:org` | **ADD CHECK** |
| `/{usergroup_id}/add_users` | POST   | ❌     | `usergroup:manage:org` | **ADD CHECK** |

**Recommendations:**

- ❌ **CRITICAL**: No permission checks on user group endpoints
- ⚠️ Add full RBAC coverage for user group management
- 📝 User groups can grant resource access - security sensitive

---

### 10. Payments (`/api/v1/payments/*`) [Enterprise Edition]

| Endpoint                  | Method | Status | Permission Required  | Notes         |
| ------------------------- | ------ | ------ | -------------------- | ------------- |
| `/{org_id}/config`        | POST   | ❌     | `payment:manage:org` | **ADD CHECK** |
| `/{org_id}/config`        | GET    | ❌     | `payment:read:org`   | **ADD CHECK** |
| `/{org_id}/products`      | POST   | ❌     | `product:create:org` | **ADD CHECK** |
| `/{org_id}/products/{id}` | PUT    | ❌     | `product:update:org` | **ADD CHECK** |
| `/{org_id}/products/{id}` | DELETE | ❌     | `product:delete:org` | **ADD CHECK** |
| `/{org_id}/customers`     | GET    | ❌     | `payment:read:org`   | **ADD CHECK** |

**Recommendations:**

- ❌ **CRITICAL**: Payment config has NO permission checks
- ❌ Product management needs RBAC
- 📝 Restrict payment access to org admins only

---

## Summary Statistics

### By Status

- ✅ **VERIFIED**: 24 endpoints (35%)
- ⚠️ **NEEDS_UPDATE**: 12 endpoints (18%)
- ❌ **MISSING**: 28 endpoints (41%)
- 📝 **REVIEW**: 4 endpoints (6%)

**Total Audited**: 68 endpoints

### Critical Security Gaps

1. **User Management** - Missing permission checks on create/update/delete
2. **Course Management** - Missing permission checks on all modification endpoints
3. **Assignment Grading** - No permission validation for instructors
4. **User Groups** - Completely lacks RBAC integration
5. **Payments** - No permission checks on financial operations
6. **Organization Management** - Missing checks on org updates

---

## Recommended Implementation Order

### Phase 1: Critical Security (Week 1)

1. ❌ Add permission checks to user CRUD endpoints
2. ❌ Add permission checks to course CRUD endpoints
3. ❌ Add permission checks to payment/product endpoints
4. ❌ Add permission checks to user group endpoints

### Phase 2: Content Management (Week 2)

1. ❌ Add permission checks to activity endpoints
2. ❌ Add permission checks to assignment/grading endpoints
3. ❌ Add permission checks to exam management endpoints
4. ❌ Add permission checks to discussion moderation

### Phase 3: Response Metadata (Week 3)

1. ⚠️ Add `can_update`, `can_delete` to all resource responses
2. ⚠️ Add `is_owner` flag to resource responses
3. ⚠️ Add `available_actions` array to resource responses

### Phase 4: Verification (Week 4)

1. 📝 Review all org-scoped permissions for correctness
2. 📝 Review all owner-based permissions
3. ✅ Add integration tests for permission enforcement
4. ✅ Update OpenAPI documentation with permission requirements

---

## Implementation Pattern

### Standard Permission Check

```python
from src.security.rbac.dependencies import require_permission
from src.db.permissions import Action, ResourceType, Scope

@router.put("/courses/{course_id}")
async def update_course(
    course_id: int,
    course_data: CourseUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[UnifiedPermissionService, Depends(get_permission_service)],
):
    """Update a course."""

    # Check permission with ownership
    has_permission = await permission_service.check_resource_permission(
        user_id=current_user.id,
        action=Action.UPDATE,
        resource_type=ResourceType.COURSE,
        resource_id=course_id,
    )

    if not has_permission:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "PERMISSION_DENIED",
                "message": "You don't have permission to update this course",
                "required_permission": "course:update:own",
            }
        )

    # Perform update...
    return updated_course
```

### Add Response Metadata

```python
@router.get("/courses/{course_id}")
async def get_course(
    course_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    permission_service: Annotated[UnifiedPermissionService, Depends(get_permission_service)],
):
    """Get course details with permission metadata."""

    # Get course
    course = get_course_from_db(course_id)

    # Add permission metadata if authenticated
    if not isinstance(current_user, AnonymousUser):
        can_update = await permission_service.check_resource_permission(
            user_id=current_user.id,
            action=Action.UPDATE,
            resource_type=ResourceType.COURSE,
            resource_id=course_id,
        )

        can_delete = await permission_service.check_resource_permission(
            user_id=current_user.id,
            action=Action.DELETE,
            resource_type=ResourceType.COURSE,
            resource_id=course_id,
        )

        is_owner = course.owner_id == current_user.id

        return {
            **course.dict(),
            "can_update": can_update,
            "can_delete": can_delete,
            "is_owner": is_owner,
            "available_actions": get_available_actions(current_user, course),
        }

    return course
```

---

## OpenAPI Documentation

### Document Permission Requirements

```python
@router.put(
    "/courses/{course_id}",
    summary="Update course",
    description="""
    Update an existing course.

    **Required Permission**: `course:update:own` or `course:update:org`

    **Scopes**:
    - `own`: Can update courses you own
    - `org`: Can update any course in the organization
    - `all`: Super-admin can update any course

    **Error Codes**:
    - `PERMISSION_DENIED`: User lacks required permission
    - `RESOURCE_NOT_FOUND`: Course not found
    """,
    responses={
        200: {"description": "Course updated successfully"},
        403: {
            "description": "Permission denied",
            "content": {
                "application/json": {
                    "example": {
                        "code": "PERMISSION_DENIED",
                        "message": "You don't have permission to update this course",
                        "required_permission": "course:update:own",
                    }
                }
            },
        },
    },
)
async def update_course(...):
    ...
```

---

## Next Steps

1. **Create GitHub Issues** for each missing permission check
2. **Prioritize** critical security gaps (user groups, payments, courses)
3. **Implement** permission checks following standard pattern
4. **Add** response metadata to all resource endpoints
5. **Test** with integration test suite
6. **Document** in OpenAPI schema
7. **Deploy** with feature flag for gradual rollout

---

## Related Documents

- [RBAC Developer Guide](./RBAC_DEVELOPER_GUIDE.md)
- [RBAC Testing Plan](./RBAC_TESTING_PLAN.md)
- [RBAC Migration Guide](./RBAC_MIGRATION_GUIDE.md)
- [Refactoring Plan](../../../plans/RBAC%20System%20Frontend%20Refactoring%20Plan.md)
