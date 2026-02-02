"""
RBAC v2 API Endpoints - FastAPI Routes

All endpoints require authentication unless marked PUBLIC.
All endpoints use consistent error responses.

Endpoints:
- POST /api/v1/rbac/v2/check - Check single permission
- POST /api/v1/rbac/v2/check/batch - Check multiple permissions
- GET  /api/v1/rbac/v2/me/permissions - Get current user's permissions
- GET  /api/v1/rbac/v2/me/roles - Get current user's roles
- POST /api/v1/rbac/v2/roles/assign - Assign role to user (admin)
- POST /api/v1/rbac/v2/roles/revoke - Revoke role from user (admin)
- POST /api/v1/rbac/v2/roles - Create new role (admin)
- POST /api/v1/rbac/v2/roles/{role_slug}/permissions - Add permission to role (admin)
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.rbac import RBACService
from src.services.rbac.dependencies import get_rbac_service

router = APIRouter()


# ============================================================================
# Request/Response Models
# ============================================================================


class PermissionCheckRequest(BaseModel):
    """Request to check single permission."""

    action: str = Field(
        ..., description="Action to check (create, read, update, delete, etc.)"
    )
    resource: str = Field(..., description="Resource type (course, user, org, etc.)")
    resource_id: str | None = Field(None, description="Optional specific resource ID")
    org_id: int | None = Field(None, description="Organization context")


class PermissionCheckResponse(BaseModel):
    """Response for permission check."""

    granted: bool = Field(..., description="Whether permission is granted")
    reason: str = Field(..., description="Reason for result")
    checked_at: str = Field(..., description="ISO timestamp when checked")
    cached: bool = Field(False, description="Whether result was from cache")


class BatchPermissionCheckRequest(BaseModel):
    """Request to check multiple permissions."""

    checks: list[PermissionCheckRequest] = Field(
        ..., description="List of permissions to check"
    )


class BatchPermissionCheckResponse(BaseModel):
    """Response for batch permission check."""

    results: dict[str, bool] = Field(
        ..., description="Map of permission_name → granted"
    )


class RoleInfo(BaseModel):
    """Role information."""

    id: int
    slug: str
    name: str
    description: str | None
    org_id: int | None
    expires_at: str | None


class PermissionInfo(BaseModel):
    """Permission information."""

    id: int
    name: str
    resource_type: str
    action: str
    scope: str
    description: str | None


class UserPermissionsResponse(BaseModel):
    """Response for user permissions query."""

    roles: list[RoleInfo] = Field(..., description="User's roles")
    permissions: list[PermissionInfo] = Field(
        ..., description="User's effective permissions"
    )


class RoleAssignmentRequest(BaseModel):
    """Request to assign role to user."""

    user_id: int = Field(..., description="User ID to assign role to")
    role_slug: str = Field(..., description="Role slug to assign")
    org_id: int = Field(..., description="Organization context")
    expires_at: str | None = Field(
        None, description="Optional expiration (ISO datetime)"
    )


class RoleRevocationRequest(BaseModel):
    """Request to revoke role from user."""

    user_id: int = Field(..., description="User ID to revoke role from")
    role_slug: str = Field(..., description="Role slug to revoke")
    org_id: int = Field(..., description="Organization context")


class RoleCreateRequest(BaseModel):
    """Request to create new role."""

    slug: str = Field(..., description="Unique role slug")
    name: str = Field(..., description="Role display name")
    description: str | None = Field(None, description="Role description")
    org_id: int | None = Field(None, description="Organization (None for global)")
    permissions: list[str] | None = Field(
        None, description="Optional list of permission names"
    )


class AddPermissionToRoleRequest(BaseModel):
    """Request to add permission to role."""

    permission_name: str = Field(..., description="Permission name to add")


# ============================================================================
# Endpoints - Permission Checks
# ============================================================================


@router.post("/check", response_model=PermissionCheckResponse)
async def check_permission(
    request: PermissionCheckRequest,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    rbac: Annotated[RBACService, Depends(get_rbac_service)],
):
    """
    Check if current user has permission.

    Returns 200 with granted=true/false.
    Never returns 403 (use for UI state, not enforcement).

    Example:
        POST /api/v1/rbac/v2/check
        {
          "action": "update",
          "resource": "course",
          "resource_id": "course_123",
          "org_id": 1
        }

        Response:
        {
          "granted": true,
          "reason": "role_permission_granted",
          "checked_at": "2026-02-02T12:00:00Z",
          "cached": false
        }
    """
    if isinstance(current_user, AnonymousUser):
        return PermissionCheckResponse(
            granted=False,
            reason="authentication_required",
            checked_at=datetime.utcnow().isoformat(),
            cached=False,
        )

    result = rbac.check(
        user_id=current_user.id,
        action=request.action,
        resource=request.resource,
        resource_id=request.resource_id,
        org_id=request.org_id,
    )

    return PermissionCheckResponse(
        granted=result.granted,
        reason=result.reason,
        checked_at=result.checked_at.isoformat(),
        cached=result.cached,
    )


@router.post("/check/batch", response_model=BatchPermissionCheckResponse)
async def check_permissions_batch(
    request: BatchPermissionCheckRequest,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    rbac: Annotated[RBACService, Depends(get_rbac_service)],
):
    """
    Check multiple permissions in one request (more efficient).

    Example:
        POST /api/v1/rbac/v2/check/batch
        {
          "checks": [
            {"action": "update", "resource": "course", "resource_id": "course_123"},
            {"action": "delete", "resource": "course", "resource_id": "course_123"}
          ]
        }

        Response:
        {
          "results": {
            "course:update:org": true,
            "course:delete:org": false
          }
        }
    """
    if isinstance(current_user, AnonymousUser):
        # All denied for anonymous users
        results = {}
        for check in request.checks:
            perm_name = f"{check.resource}:{check.action}:org"
            results[perm_name] = False
        return BatchPermissionCheckResponse(results=results)

    checks = [
        (check.action, check.resource, check.resource_id) for check in request.checks
    ]

    # Use first check's org_id (assumes all checks are for same org)
    org_id = request.checks[0].org_id if request.checks else None

    results = rbac.check_many(
        user_id=current_user.id,
        checks=checks,
        org_id=org_id,
    )

    return BatchPermissionCheckResponse(results=results)


# ============================================================================
# Endpoints - User Permissions
# ============================================================================


@router.get("/me/permissions", response_model=UserPermissionsResponse)
async def get_my_permissions(
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    rbac: Annotated[RBACService, Depends(get_rbac_service)],
    org_id: Annotated[int | None, Query(description="Filter by organization")] = None,
):
    """
    Get all permissions for current user.

    Used by frontend to:
    - Show/hide UI elements
    - Enable/disable buttons
    - Pre-fetch permissions for offline use

    Example:
        GET /api/v1/rbac/v2/me/permissions?org_id=1

        Response:
        {
          "roles": [
            {"id": 1, "slug": "instructor", "name": "Instructor", ...}
          ],
          "permissions": [
            {"id": 1, "name": "course:create:org", "resource_type": "course", ...}
          ]
        }
    """
    if isinstance(current_user, AnonymousUser):
        return UserPermissionsResponse(roles=[], permissions=[])

    roles = rbac.get_user_roles(current_user.id, org_id)
    permissions = rbac.get_user_permissions(current_user.id, org_id)

    return UserPermissionsResponse(
        roles=[RoleInfo(**role) for role in roles],
        permissions=[PermissionInfo(**perm) for perm in permissions],
    )


# ============================================================================
# Endpoints - Role Management (Admin Only)
# ============================================================================


@router.post("/roles/assign")
async def assign_role(
    request: RoleAssignmentRequest,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    rbac: Annotated[RBACService, Depends(get_rbac_service)],
):
    """
    Assign role to user (admin only).

    Requires permission: role:assign:org
    """
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # Check if current user can assign roles
    check = rbac.check(
        user_id=current_user.id,
        action="assign",
        resource="role",
        org_id=request.org_id,
    )
    check.raise_if_denied("You don't have permission to assign roles")

    # Parse expires_at if provided
    expires_at = None
    if request.expires_at:
        try:
            expires_at = datetime.fromisoformat(request.expires_at)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid expires_at format. Use ISO datetime.",
            )

    # Assign role
    rbac.assign_role(
        user_id=request.user_id,
        role_slug=request.role_slug,
        org_id=request.org_id,
        assigned_by=current_user.id,
        expires_at=expires_at,
    )

    return {"message": "Role assigned successfully"}


@router.post("/roles/revoke")
async def revoke_role(
    request: RoleRevocationRequest,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    rbac: Annotated[RBACService, Depends(get_rbac_service)],
):
    """
    Revoke role from user (admin only).

    Requires permission: role:revoke:org
    """
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # Check if current user can revoke roles
    check = rbac.check(
        user_id=current_user.id,
        action="revoke",
        resource="role",
        org_id=request.org_id,
    )
    check.raise_if_denied("You don't have permission to revoke roles")

    # Revoke role
    rbac.revoke_role(
        user_id=request.user_id,
        role_slug=request.role_slug,
        org_id=request.org_id,
        revoked_by=current_user.id,
    )

    return {"message": "Role revoked successfully"}


@router.post("/roles")
async def create_role(
    request: RoleCreateRequest,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    rbac: Annotated[RBACService, Depends(get_rbac_service)],
):
    """
    Create new role (admin only).

    Requires permission: role:create:org
    """
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # Check if current user can create roles
    check = rbac.check(
        user_id=current_user.id,
        action="create",
        resource="role",
        org_id=request.org_id,
    )
    check.raise_if_denied("You don't have permission to create roles")

    # Create role
    return rbac.create_role(
        slug=request.slug,
        name=request.name,
        org_id=request.org_id,
        description=request.description,
        permissions=request.permissions,
        created_by=current_user.id,
    )


@router.post("/roles/{role_slug}/permissions")
async def add_permission_to_role(
    role_slug: str,
    request: AddPermissionToRoleRequest,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    rbac: Annotated[RBACService, Depends(get_rbac_service)],
    org_id: Annotated[int | None, Query(description="Organization context")] = None,
):
    """
    Add permission to role (admin only).

    Requires permission: role:update:org
    """
    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # Check if current user can update roles
    check = rbac.check(
        user_id=current_user.id,
        action="update",
        resource="role",
        org_id=org_id,
    )
    check.raise_if_denied("You don't have permission to update roles")

    # Add permission to role
    rbac.add_permission_to_role(
        role_slug=role_slug,
        permission_name=request.permission_name,
        org_id=org_id,
        granted_by=current_user.id,
    )

    return {"message": "Permission added to role successfully"}
