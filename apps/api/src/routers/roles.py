"""
Roles Router — CRUD for roles + permission assignment.

Role assignment/revocation to *users* is in rbac.py.
"""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, or_, select

from src.core.events.database import get_db_session
from src.db.permissions import (
    Permission,
    PermissionRead,
    Role,
    RoleCreate,
    RolePermission,
    RoleRead,
    RoleUpdate,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.security.rbac import PermissionCheckerDep

audit_log = logging.getLogger("rbac.audit")

router = APIRouter()


class AddPermissionBody(BaseModel):
    permission_id: int


# ── List / Read ───────────────────────────────────────────────────────────


@router.get("/permissions/all", response_model=list[PermissionRead])
async def list_all_permissions(
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    """List all permission definitions. Used by the RBAC admin panel."""
    checker.require(current_user.id, "role:read", org_id)
    perms = db.exec(
        select(Permission).order_by(Permission.resource_type, Permission.action)
    ).all()
    return [PermissionRead.model_validate(p) for p in perms]


@router.get("/", response_model=list[RoleRead])
async def list_roles(
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    """List all roles available in an org (system roles + org-specific)."""
    checker.require(current_user.id, "role:read", org_id)
    query = select(Role)
    if org_id is not None:
        query = query.where(or_(Role.org_id == org_id, Role.org_id.is_(None)))
    else:
        query = query.where(Role.org_id.is_(None))
    roles = db.exec(query.order_by(Role.priority.desc())).all()
    return [RoleRead.model_validate(r) for r in roles]


@router.get("/{role_id}", response_model=RoleRead)
async def get_role(
    role_id: int,
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    """Get a single role by ID (includes its permissions via separate endpoint)."""
    checker.require(current_user.id, "role:read", org_id)
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    return RoleRead.model_validate(role)


# ── Create / Update / Delete ──────────────────────────────────────────────


@router.post(
    "/",
    response_model=RoleRead,
)
async def create_role(
    body: RoleCreate,
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
):
    """Create a new custom role for an org."""
    checker.require(current_user.id, "role:create", body.org_id)

    # Escalation prevention: new role priority must not exceed caller's highest
    caller_roles = checker.get_user_roles(current_user.id, body.org_id)
    caller_max_priority = max((r["priority"] for r in caller_roles), default=0)
    new_priority = body.priority if hasattr(body, "priority") and body.priority is not None else 0
    if new_priority > caller_max_priority:
        raise HTTPException(
            403,
            detail="Cannot create a role with higher priority than your own",
        )

    role = Role(
        slug=body.slug,
        name=body.name,
        description=body.description,
        org_id=body.org_id,
        is_system=False,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    audit_log.info(
        "role_created",
        extra={
            "actor_id": current_user.id,
            "role_id": role.id,
            "role_slug": role.slug,
            "org_id": body.org_id,
        },
    )
    return RoleRead.model_validate(role)


@router.put(
    "/{role_id}",
    response_model=RoleRead,
)
async def update_role(
    role_id: int,
    body: RoleUpdate,
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    """Update a role's name, description, or priority."""
    checker.require(current_user.id, "role:update", org_id)
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    if role.is_system:
        raise HTTPException(403, detail="System roles cannot be modified")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(role, field, value)
    db.commit()
    db.refresh(role)
    audit_log.info(
        "role_updated",
        extra={
            "actor_id": current_user.id,
            "role_id": role_id,
            "org_id": org_id,
            "fields": list(body.model_dump(exclude_unset=True).keys()),
        },
    )
    return RoleRead.model_validate(role)


@router.delete(
    "/{role_id}",
)
async def delete_role(
    role_id: int,
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    """Delete a custom role."""
    checker.require(current_user.id, "role:delete", org_id)
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    if role.is_system:
        raise HTTPException(403, detail="System roles cannot be deleted")
    db.delete(role)
    db.commit()
    audit_log.info(
        "role_deleted",
        extra={
            "actor_id": current_user.id,
            "role_id": role_id,
            "role_slug": role.slug,
            "org_id": org_id,
        },
    )
    return {"ok": True}


# ── Permissions on Roles ──────────────────────────────────────────────────


@router.get("/{role_id}/permissions", response_model=list[PermissionRead])
async def get_role_permissions(
    role_id: int,
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    """Get all permissions assigned to a role."""
    checker.require(current_user.id, "role:read", org_id)
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    perms = db.exec(
        select(Permission)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id == role_id)
    ).all()
    return [PermissionRead.model_validate(p) for p in perms]


@router.post(
    "/{role_id}/permissions",
)
async def add_permission_to_role(
    role_id: int,
    body: AddPermissionBody,
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    """Add a permission to a role."""
    checker.require(current_user.id, "role:update", org_id)
    permission_id = body.permission_id
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    if role.is_system:
        raise HTTPException(403, detail="System roles cannot be modified")
    perm = db.get(Permission, permission_id)
    if not perm:
        raise HTTPException(404, detail="Permission not found")

    # Escalation prevention: caller must themselves have the permission being added
    caller_perms = checker.get_effective_permissions(current_user.id, org_id)
    if perm.name not in caller_perms and "*:*:*" not in caller_perms:
        raise HTTPException(
            403,
            detail=f"Cannot grant permission '{perm.name}' that you do not have",
        )

    # Check if already exists
    existing = db.exec(
        select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
    ).first()
    if existing:
        raise HTTPException(409, detail="Permission already assigned to role")
    rp = RolePermission(role_id=role_id, permission_id=permission_id)
    db.add(rp)
    db.commit()
    audit_log.info(
        "permission_added_to_role",
        extra={
            "actor_id": current_user.id,
            "role_id": role_id,
            "permission_id": permission_id,
            "permission_name": perm.name,
            "org_id": org_id,
        },
    )
    return {"ok": True}


@router.delete(
    "/{role_id}/permissions/{permission_id}",
)
async def remove_permission_from_role(
    role_id: int,
    permission_id: int,
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    checker: PermissionCheckerDep,
    org_id: Annotated[int | None, Query()] = None,
):
    """Remove a permission from a role."""
    checker.require(current_user.id, "role:update", org_id)
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    if role.is_system:
        raise HTTPException(403, detail="System roles cannot be modified")
    rp = db.exec(
        select(RolePermission).where(
            RolePermission.role_id == role_id,
            RolePermission.permission_id == permission_id,
        )
    ).first()
    if not rp:
        raise HTTPException(404, detail="Permission not assigned to this role")
    db.delete(rp)
    db.commit()
    audit_log.info(
        "permission_removed_from_role",
        extra={
            "actor_id": current_user.id,
            "role_id": role_id,
            "permission_id": permission_id,
            "org_id": org_id,
        },
    )
    return {"ok": True}
