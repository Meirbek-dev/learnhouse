"""
API endpoints for the new RBAC permission system.

This module provides REST API endpoints for:
- Permission management
- Role management (new system)
- User-role assignments
- Permission checks
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session, select

from src.core.events.database import get_db_session
from src.db.permissions import (
    Action,
    BatchPermissionCheckRequest,
    BatchPermissionCheckResponse,
    PermissionCheckRequest,
    PermissionCheckResult,
    PermissionRead,
    ResourcePermission,
    ResourceType,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    RoleWithPermissions,
    UserPermissionsResponse,
    UserRoleCreate,
    UserRoleRead,
)
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.security.rbac.checker import PermissionChecker
from src.security.rbac.dependencies import get_permission_checker
from src.services.permissions.permission_service import PermissionService
from src.services.permissions.role_service import RoleService

router = APIRouter()


# ---------------------------------------------------------------------------
# Permission Endpoints
# ---------------------------------------------------------------------------


@router.get("/permissions")
async def api_list_permissions(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    resource_type: ResourceType | None = None,
) -> list[PermissionRead]:
    """
    List all available permissions.

    Optionally filter by resource type.
    """
    if isinstance(current_user, AnonymousUser) or current_user.id == 0:
        raise HTTPException(status_code=401, detail="Authentication required")

    service = PermissionService(db_session)
    return service.list_all(resource_type)


@router.get("/permissions/{permission_id}")
async def api_get_permission(
    permission_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
) -> PermissionRead:
    """
    Get a specific permission by ID.
    """
    if isinstance(current_user, AnonymousUser) or current_user.id == 0:
        raise HTTPException(status_code=401, detail="Authentication required")

    service = PermissionService(db_session)
    permission = service.get_by_id(permission_id)
    if not permission:
        raise HTTPException(status_code=404, detail="Permission not found")
    return PermissionRead.model_validate(permission)


# ---------------------------------------------------------------------------
# Role Endpoints (New System)
# ---------------------------------------------------------------------------


@router.get("/roles-new")
async def api_list_roles_new(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    org_id: int | None = None,
    include_global: bool = True,
) -> list[RoleRead]:
    """
    List all roles in the new system.

    Args:
        org_id: Optional organization ID filter
        include_global: Whether to include global/system roles
    """
    if isinstance(current_user, AnonymousUser) or current_user.id == 0:
        raise HTTPException(status_code=401, detail="Authentication required")

    service = RoleService(db_session)
    return service.list_all(org_id, include_global)


@router.post("/roles-new")
async def api_create_role_new(
    role_data: RoleCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
) -> RoleRead:
    """
    Create a new role.

    Requires role:create:org permission.
    """
    checker.require(
        current_user, Action.CREATE, ResourceType.ROLE, org_id=role_data.org_id
    )

    service = RoleService(db_session)
    try:
        role = service.create(role_data, created_by=current_user.id)
        return RoleRead.model_validate(role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/roles-new/{role_id}")
async def api_get_role_new(
    role_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
) -> RoleWithPermissions:
    """
    Get a role with all its permissions.
    """
    if isinstance(current_user, AnonymousUser) or current_user.id == 0:
        raise HTTPException(status_code=401, detail="Authentication required")

    service = RoleService(db_session)
    role = service.get_role_with_permissions(role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


@router.put("/roles-new/{role_id}")
async def api_update_role_new(
    role_id: int,
    role_data: RoleUpdate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
) -> RoleRead:
    """
    Update a role.

    Requires role:update:org permission.
    """
    service = RoleService(db_session)
    existing = service.get_by_id(role_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")

    checker.require(
        current_user, Action.UPDATE, ResourceType.ROLE, org_id=existing.org_id
    )

    try:
        role = service.update(role_id, role_data)
        return RoleRead.model_validate(role)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/roles-new/{role_id}")
async def api_delete_role_new(
    role_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
):
    """
    Delete a role.

    Requires role:delete:org permission.
    Cannot delete system roles.
    """
    service = RoleService(db_session)
    existing = service.get_by_id(role_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")

    checker.require(
        current_user, Action.DELETE, ResourceType.ROLE, org_id=existing.org_id
    )

    try:
        service.delete(role_id)
        return {"message": "Role deleted successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------------------------------------------------------------------------
# Role-Permission Endpoints
# ---------------------------------------------------------------------------


@router.post("/roles-new/{role_id}/permissions/{permission_id}")
async def api_add_permission_to_role(
    role_id: int,
    permission_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
):
    """
    Add a permission to a role.

    Requires role:update:org permission.
    """
    service = RoleService(db_session)
    existing = service.get_by_id(role_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")

    checker.require(
        current_user, Action.UPDATE, ResourceType.ROLE, org_id=existing.org_id
    )

    try:
        service.add_permission_to_role(
            role_id, permission_id, granted_by=current_user.id
        )
        return {"message": "Permission added to role"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/roles-new/{role_id}/permissions/{permission_id}")
async def api_remove_permission_from_role(
    role_id: int,
    permission_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
):
    """
    Remove a permission from a role.

    Requires role:update:org permission.
    """
    service = RoleService(db_session)
    existing = service.get_by_id(role_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Role not found")

    checker.require(
        current_user, Action.UPDATE, ResourceType.ROLE, org_id=existing.org_id
    )

    if not service.remove_permission_from_role(role_id, permission_id):
        raise HTTPException(status_code=404, detail="Permission not assigned to role")

    return {"message": "Permission removed from role"}


# ---------------------------------------------------------------------------
# User-Role Endpoints
# ---------------------------------------------------------------------------


@router.get("/users/{user_id}/roles")
async def api_get_user_roles(
    user_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    org_id: int | None = None,
) -> list[UserRoleRead]:
    """
    Get all roles assigned to a user.

    Users can view their own roles.
    Org admins can view roles of users in their org.
    """
    if isinstance(current_user, AnonymousUser) or current_user.id == 0:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Users can always view their own roles
    if current_user.id != user_id:
        # For viewing other users' roles, need read permission on users
        checker = PermissionChecker(db_session)
        checker.require(current_user, Action.READ, ResourceType.USER, org_id=org_id)

    service = RoleService(db_session)
    return service.get_user_roles(user_id, org_id)


@router.post("/users/{user_id}/roles")
async def api_assign_role_to_user(
    user_id: int,
    role_data: UserRoleCreate,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
):
    """
    Assign a role to a user in an organization.

    Requires role:update:org permission.
    """
    checker.require(
        current_user, Action.UPDATE, ResourceType.ROLE, org_id=role_data.org_id
    )

    service = RoleService(db_session)
    try:
        service.assign_role_to_user(
            user_id=user_id,
            role_id=role_data.role_id,
            org_id=role_data.org_id,
            granted_by=current_user.id,
            expires_at=role_data.expires_at,
        )
        return {"message": "Role assigned to user"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/users/{user_id}/roles/{role_id}")
async def api_remove_role_from_user(
    user_id: int,
    role_id: int,
    org_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
):
    """
    Remove a role from a user in an organization.

    Requires role:update:org permission.
    """
    checker.require(current_user, Action.UPDATE, ResourceType.ROLE, org_id=org_id)

    service = RoleService(db_session)
    if not service.remove_role_from_user(user_id, role_id, org_id):
        raise HTTPException(status_code=404, detail="Role not assigned to user")

    return {"message": "Role removed from user"}


# ---------------------------------------------------------------------------
# Permission Check Endpoints
# ---------------------------------------------------------------------------


@router.get("/me/permissions")
async def api_get_my_permissions(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
    org_id: int | None = None,
) -> UserPermissionsResponse:
    """
    Get the current user's effective permissions.

    This endpoint returns all permissions the user has, useful for
    frontend permission checks.
    """
    user_id = current_user.id if hasattr(current_user, "id") else 0

    if user_id == 0:
        # Anonymous user
        return UserPermissionsResponse(
            user_id=0,
            org_id=None,
            roles=[],
            permissions={
                "course:read:all": True,
                "collection:read:all": True,
            },
            resource_permissions=[],
        )

    # Get user's permissions
    permissions = checker.get_user_permissions(current_user, org_id)

    # Get user's roles
    service = RoleService(db_session)
    user_roles = service.get_user_roles(user_id, org_id)
    roles = [ur.role for ur in user_roles if ur.role]

    # Get user's resource-level permissions
    resource_perms_stmt = select(ResourcePermission).where(
        ResourcePermission.user_id == user_id,
        (ResourcePermission.expires_at.is_(None))
        | (ResourcePermission.expires_at > datetime.now(UTC)),
    )
    resource_perms = list(db_session.exec(resource_perms_stmt).all())

    return UserPermissionsResponse(
        user_id=user_id,
        org_id=org_id,
        roles=roles,
        permissions=permissions,
        resource_permissions=resource_perms,
    )


@router.post("/permissions/check")
async def api_check_permissions(
    request: Request,
    body: BatchPermissionCheckRequest,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
) -> BatchPermissionCheckResponse:
    """
    Batch check multiple permissions.

    Request body should contain a list of permission checks:
    ```json
    {
        "checks": [
            {"action": "create", "resource": "course", "org_id": 1},
            {"action": "update", "resource": "course", "resource_id": "course_abc123"}
        ]
    }
    ```

    Returns both a list of results and a convenience permissions dict.
    """
    results: list[PermissionCheckResult] = []
    permissions: dict[str, bool] = {}

    for check in body.checks:
        allowed = checker.check(
            current_user,
            check.action,
            check.resource,
            check.resource_id,
            check.org_id,
        )

        results.append(
            PermissionCheckResult(
                action=check.action,
                resource=check.resource,
                resource_id=check.resource_id,
                org_id=check.org_id,
                allowed=allowed,
            )
        )

        # Build convenience key
        key = f"{check.resource}:{check.action}"
        if check.resource_id:
            key += f":{check.resource_id}"
        elif check.org_id:
            key += f":org_{check.org_id}"

        permissions[key] = allowed

    return BatchPermissionCheckResponse(results=results, permissions=permissions)


@router.get("/permissions/check")
async def api_check_single_permission(
    action: Action,
    resource: ResourceType,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
    resource_id: str | None = None,
    org_id: int | None = None,
) -> PermissionCheckResult:
    """
    Check a single permission.

    Query parameters:
    - action: The action to check (e.g., "create", "read", "update", "delete")
    - resource: The resource type (e.g., "course", "activity")
    - resource_id: Optional specific resource UUID
    - org_id: Optional organization context

    Returns whether the permission is allowed.
    """
    allowed = checker.check(
        current_user,
        action,
        resource,
        resource_id,
        org_id,
    )

    return PermissionCheckResult(
        action=action,
        resource=resource,
        resource_id=resource_id,
        org_id=org_id,
        allowed=allowed,
    )


# ---------------------------------------------------------------------------
# Admin Endpoints
# ---------------------------------------------------------------------------


@router.post("/admin/seed-permissions")
async def api_seed_permissions(
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: Annotated[PermissionChecker, Depends(get_permission_checker)],
):
    """
    Seed default permissions and roles.

    Requires super-admin role.
    """
    # Only super-admin can seed permissions
    if isinstance(current_user, AnonymousUser) or current_user.id == 0:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Check for super-admin (this is a bootstrapping endpoint)
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(current_user.id)
    is_super_admin = any(ur.role and ur.role.slug == "super-admin" for ur in user_roles)

    if not is_super_admin:
        # If no super-admin exists yet, allow first user to seed
        from sqlmodel import select

        from src.db.permissions.models import UserRole

        existing_admins = db_session.exec(select(UserRole)).first()
        if existing_admins:
            raise HTTPException(status_code=403, detail="Super-admin required")

    # Seed permissions and roles
    permission_service = PermissionService(db_session)
    permission_service.seed_default_permissions()

    roles = role_service.seed_default_roles()

    return {
        "message": "Permissions and roles seeded successfully",
        "roles_created": list(roles.keys()),
    }
