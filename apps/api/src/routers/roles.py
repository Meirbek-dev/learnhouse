from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.permissions import RoleCreate, RoleRead, RoleUpdate
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.roles.roles import (
    create_role,
    delete_role,
    get_roles_by_organization,
    read_role,
    update_role,
)

router = APIRouter()


@router.post("/org/{org_id}")
async def api_create_role(
    request: Request,
    org_id: int,
    role_object: RoleCreate,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> RoleRead:
    """
    Create new role for a specific organization
    """
    # Set the org_id in the role object
    role_object.org_id = org_id
    return await create_role(request, db_session, role_object, current_user)


@router.get("/org/{org_id}")
async def api_get_roles_by_organization(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> list[RoleRead]:
    """
    Get all roles for a specific organization, including global roles
    """
    return await get_roles_by_organization(request, db_session, org_id, current_user)


@router.get("/{role_id}")
async def api_get_role(
    request: Request,
    role_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> RoleRead:
    """
    Get single role by role_id
    """
    return await read_role(request, db_session, role_id, current_user)


@router.put("/{role_id}")
async def api_update_role(
    request: Request,
    role_id: int,
    role_object: RoleUpdate,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> RoleRead:
    """
    Update role by role_id
    """
    return await update_role(request, db_session, role_id, role_object, current_user)


@router.delete("/{role_id}")
async def api_delete_role(
    request: Request,
    role_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Delete role by ID
    """
    return await delete_role(request, db_session, role_id, current_user)
