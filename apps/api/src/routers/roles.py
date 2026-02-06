"""
Roles Router — list / read roles.

Role assignment/revocation is in rbac.py.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session, or_, select

from src.core.events.database import get_db_session
from src.db.permissions import Role, RoleRead
from src.db.users import PublicUser
from src.security.auth import get_current_user

router = APIRouter()


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
    """Get a single role by ID."""
    from fastapi import HTTPException

    role = db.get(Role, role_id)
    if not role:
        raise HTTPException(404, detail="Role not found")
    return RoleRead.model_validate(role)
