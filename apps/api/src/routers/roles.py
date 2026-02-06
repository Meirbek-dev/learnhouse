"""
Roles Router — CRUD for roles + permission assignment.

Role assignment/revocation to *users* is in rbac.py.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
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
from src.security.rbac import require_permission

router = APIRouter()


# ── List / Read ───────────────────────────────────────────────────────────

@router.get("/permissions/all", response_model=list[PermissionRead])
async def list_all_permissions(
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
):
    """List all permission definitions. Used by the RBAC admin panel."""
    perms = db.exec(
        select(Permission).order_by(Permission.resource_type, Permission.action)
    ).all()
    return [PermissionRead.model_validate(p) for p in perms]


@router.get("/", response_model=list[RoleRead])
async def list_roles(
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    org_id: Annotated[int | None, Query()] = None,
):
    """List all roles available in an org (system roles + org-specific)."""
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
):
    """Get a single role by ID (includes its permissions via separate endpoint)."""
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    return RoleRead.model_validate(role)


# ── Create / Update / Delete ──────────────────────────────────────────────

@router.post(
    "/",
    response_model=RoleRead,
    dependencies=[Depends(require_permission("role:create:org"))],
)
async def create_role(
    body: RoleCreate,
    db: Annotated[Session, Depends(get_db_session)],
):
    """Create a new custom role for an org."""
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
    return RoleRead.model_validate(role)


@router.put(
    "/{role_id}",
    response_model=RoleRead,
    dependencies=[Depends(require_permission("role:update:org"))],
)
async def update_role(
    role_id: int,
    body: RoleUpdate,
    db: Annotated[Session, Depends(get_db_session)],
):
    """Update a role's name, description, or priority."""
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    if role.is_system:
        raise HTTPException(403, detail="System roles cannot be modified")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(role, field, value)
    db.commit()
    db.refresh(role)
    return RoleRead.model_validate(role)


@router.delete(
    "/{role_id}",
    dependencies=[Depends(require_permission("role:delete:org"))],
)
async def delete_role(
    role_id: int,
    db: Annotated[Session, Depends(get_db_session)],
):
    """Delete a custom role."""
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    if role.is_system:
        raise HTTPException(403, detail="System roles cannot be deleted")
    db.delete(role)
    db.commit()
    return {"ok": True}


# ── Permissions on Roles ──────────────────────────────────────────────────

@router.get("/{role_id}/permissions", response_model=list[PermissionRead])
async def get_role_permissions(
    role_id: int,
    db: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
):
    """Get all permissions assigned to a role."""
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
    dependencies=[Depends(require_permission("role:update:org"))],
)
async def add_permission_to_role(
    role_id: int,
    body: dict,
    db: Annotated[Session, Depends(get_db_session)],
):
    """Add a permission to a role."""
    permission_id = body.get("permission_id")
    if not permission_id:
        raise HTTPException(400, detail="permission_id is required")
    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    perm = db.get(Permission, permission_id)
    if not perm:
        raise HTTPException(404, detail="Permission not found")
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
    return {"ok": True}


@router.delete(
    "/{role_id}/permissions/{permission_id}",
    dependencies=[Depends(require_permission("role:update:org"))],
)
async def remove_permission_from_role(
    role_id: int,
    permission_id: int,
    db: Annotated[Session, Depends(get_db_session)],
):
    """Remove a permission from a role."""
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
    return {"ok": True}
