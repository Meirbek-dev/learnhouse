from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.permissions import Action, ResourceType
from src.db.usergroups import UserGroupCreate, UserGroupRead, UserGroupUpdate
from src.security.permissions.exceptions import PermissionDenied
from src.db.users import PublicUser, UserRead
from src.security.auth import get_current_user
from src.security.rbac.dependencies import get_permission_service
from src.services.permissions.unified_permission_service import UnifiedPermissionService
from src.services.users.usergroups import (
    add_resources_to_usergroup,
    add_users_to_usergroup,
    create_usergroup,
    delete_usergroup_by_id,
    get_usergroups_by_resource,
    get_users_linked_to_usergroup,
    read_usergroup_by_id,
    read_usergroups_by_org_id,
    remove_resources_from_usergroup,
    remove_users_from_usergroup,
    update_usergroup_by_id,
)

router = APIRouter()


@router.post("/", tags=["usergroups"])
async def api_create_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        UnifiedPermissionService, Depends(get_permission_service)
    ],
    usergroup_object: UserGroupCreate,
) -> UserGroupRead:
    """
    Create UserGroup

    **Required Permission**: `usergroup:create:org`
    """
    # Check permission to create usergroups
    has_permission = await permission_service.check_permission(
        user_id=current_user.id,
        action=Action.CREATE,
        resource_type=ResourceType.USERGROUP,
    )

    if not has_permission:
        raise PermissionDenied(
            reason="You do not have permission to create user groups in this organization"
        )

    return await create_usergroup(request, db_session, current_user, usergroup_object)


@router.get("/{usergroup_id}", tags=["usergroups"])
async def api_get_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    usergroup_id: int,
) -> UserGroupRead:
    """
    Get UserGroup
    """
    return await read_usergroup_by_id(request, db_session, current_user, usergroup_id)


@router.get("/{usergroup_id}/users", tags=["usergroups"])
async def api_get_users_linked_to_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    usergroup_id: int,
) -> list[UserRead]:
    """
    Get Users linked to UserGroup
    """
    return await get_users_linked_to_usergroup(
        request, db_session, current_user, usergroup_id
    )


@router.get("/org/{org_id}", tags=["usergroups"])
async def api_get_usergroups(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    org_id: int,
) -> list[UserGroupRead]:
    """
    Get UserGroups by Org
    """
    return await read_usergroups_by_org_id(request, db_session, current_user, org_id)


@router.get("/resource/{resource_uuid}", tags=["usergroups"])
async def api_get_usergroupsby_resource(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    resource_uuid: str,
) -> list[UserGroupRead]:
    """
    Get UserGroups by Org
    """
    return await get_usergroups_by_resource(
        request, db_session, current_user, resource_uuid
    )


@router.put("/{usergroup_id}", tags=["usergroups"])
async def api_update_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        UnifiedPermissionService, Depends(get_permission_service)
    ],
    usergroup_id: int,
    usergroup_object: UserGroupUpdate,
) -> UserGroupRead:
    """
    Update UserGroup

    **Required Permission**: `usergroup:update:org`
    """
    # Check permission to update usergroups
    has_permission = await permission_service.check_permission(
        user_id=current_user.id,
        action=Action.UPDATE,
        resource_type=ResourceType.USERGROUP,
    )

    if not has_permission:
        raise PermissionDenied(
            reason=f"You do not have permission to update user group {usergroup_id}"
        )

    return await update_usergroup_by_id(
        request, db_session, current_user, usergroup_id, usergroup_object
    )


@router.delete("/{usergroup_id}", tags=["usergroups"])
async def api_delete_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        UnifiedPermissionService, Depends(get_permission_service)
    ],
    usergroup_id: int,
) -> str:
    """
    Delete UserGroup

    **Required Permission**: `usergroup:delete:org`
    """
    # Check permission to delete usergroups
    has_permission = await permission_service.check_permission(
        user_id=current_user.id,
        action=Action.DELETE,
        resource_type=ResourceType.USERGROUP,
    )

    if not has_permission:
        raise PermissionDenied(
            reason=f"You do not have permission to delete user group {usergroup_id}"
        )

    return await delete_usergroup_by_id(request, db_session, current_user, usergroup_id)


@router.post("/{usergroup_id}/add_users", tags=["usergroups"])
async def api_add_users_to_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        UnifiedPermissionService, Depends(get_permission_service)
    ],
    usergroup_id: int,
    user_ids: str,
) -> str:
    """
    Add Users to UserGroup

    **Required Permission**: `usergroup:manage:org`
    """
    # Check permission to manage usergroups
    has_permission = await permission_service.check_permission(
        user_id=current_user.id,
        action=Action.MANAGE,
        resource_type=ResourceType.USERGROUP,
    )

    if not has_permission:
        raise PermissionDenied(
            reason=f"You do not have permission to manage members of user group {usergroup_id}"
        )

    return await add_users_to_usergroup(
        request, db_session, current_user, usergroup_id, user_ids
    )


@router.delete("/{usergroup_id}/remove_users", tags=["usergroups"])
async def api_delete_users_from_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    usergroup_id: int,
    user_ids: str,
) -> str:
    """
    Delete Users from UserGroup
    """
    return await remove_users_from_usergroup(
        request, db_session, current_user, usergroup_id, user_ids
    )


@router.post("/{usergroup_id}/add_resources", tags=["usergroups"])
async def api_add_resources_to_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    usergroup_id: int,
    resource_uuids: str,
) -> str:
    """
    Add Resources to UserGroup
    """
    return await add_resources_to_usergroup(
        request, db_session, current_user, usergroup_id, resource_uuids
    )


@router.delete("/{usergroup_id}/remove_resources", tags=["usergroups"])
async def api_delete_resources_from_usergroup(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    usergroup_id: int,
    resource_uuids: str,
) -> str:
    """
    Delete Resources from UserGroup
    """
    return await remove_resources_from_usergroup(
        request, db_session, current_user, usergroup_id, resource_uuids
    )
