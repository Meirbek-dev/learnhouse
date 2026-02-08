"""
RBAC API Endpoints

- POST /check           — check single permission (returns granted/denied, never 403)
- POST /check/batch     — batch check
- GET  /me/permissions  — get current user's roles + permission strings
- POST /roles/assign    — assign role (admin)
- POST /roles/revoke    — revoke role (admin)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.security.rbac import PermissionCheckerDep, require_permission

router = APIRouter()


# ============================================================================
# Request / Response models
# ============================================================================


class PermissionCheckRequest(BaseModel):
    action: str
    resource: str
    resource_id: str | None = None
    org_id: int | None = None


class PermissionCheckResponse(BaseModel):
    granted: bool
    permission: str


class BatchPermissionCheckRequest(BaseModel):
    checks: list[PermissionCheckRequest]
    org_id: int | None = None


class BatchPermissionCheckResponse(BaseModel):
    results: dict[str, bool]


class RoleAssignmentRequest(BaseModel):
    user_id: int
    role_slug: str
    org_id: int


class RoleRevocationRequest(BaseModel):
    user_id: int
    role_slug: str
    org_id: int


class UserPermissionsResponse(BaseModel):
    roles: list[dict]
    permissions: list[str]
    org_id: int | None = None


# ============================================================================
# Permission check endpoints (never 403 — used by frontend for UI state)
# ============================================================================


@router.post("/check", response_model=PermissionCheckResponse)
async def check_permission(
    request: PermissionCheckRequest,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
):
    if isinstance(current_user, AnonymousUser):
        return PermissionCheckResponse(
            granted=False,
            permission=f"{request.resource}:{request.action}:org",
        )

    perm = f"{request.resource}:{request.action}:org"
    granted = checker.check(current_user.id, perm, request.org_id)
    return PermissionCheckResponse(granted=granted, permission=perm)


@router.post("/check/batch", response_model=BatchPermissionCheckResponse)
async def check_permissions_batch(
    request: BatchPermissionCheckRequest,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
):
    perms = [f"{c.resource}:{c.action}:org" for c in request.checks]

    if isinstance(current_user, AnonymousUser):
        return BatchPermissionCheckResponse(results={p: False for p in perms})

    results = checker.check_many(current_user.id, perms, request.org_id)
    return BatchPermissionCheckResponse(results=results)


# ============================================================================
# Current user permissions (for frontend)
# ============================================================================


@router.get("/me/permissions", response_model=UserPermissionsResponse)
async def get_my_permissions(
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    if isinstance(current_user, AnonymousUser):
        return UserPermissionsResponse(roles=[], permissions=[], org_id=org_id)

    roles = checker.get_user_roles(current_user.id, org_id)
    permissions = sorted(checker.get_expanded_permissions(current_user.id, org_id))

    return UserPermissionsResponse(
        roles=roles,
        permissions=permissions,
        org_id=org_id,
    )


# ============================================================================
# Role assignment / revocation (admin)
# ============================================================================


@router.post("/roles/assign")
async def assign_role(
    request: RoleAssignmentRequest,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
):
    checker.require(current_user.id, "role:create:org", request.org_id)
    checker.assign_role(
        user_id=request.user_id,
        role_slug=request.role_slug,
        org_id=request.org_id,
        assigned_by=current_user.id,
    )
    return {"message": "Role assigned"}


@router.post("/roles/revoke")
async def revoke_role(
    request: RoleRevocationRequest,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
):
    checker.require(current_user.id, "role:delete:org", request.org_id)
    checker.revoke_role(
        user_id=request.user_id,
        role_slug=request.role_slug,
        org_id=request.org_id,
    )
    return {"message": "Role revoked"}
