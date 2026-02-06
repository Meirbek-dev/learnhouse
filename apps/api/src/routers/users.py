from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, Response, UploadFile
from pydantic import EmailStr
from sqlmodel import Session
from src.security.permissions.exceptions import PermissionDenied
from src.services.permissions import PermissionService

from src.core.events.database import get_db_session
from src.db.courses.courses import CourseRead
from src.db.permissions import Action, ResourceType
from src.db.users import (
    PublicUser,
    User,
    UserCreate,
    UserRead,
    UserSession,
    UserUpdate,
    UserUpdatePassword,
)
from src.security.auth import get_current_user
from src.security.rbac.dependencies import get_permission_service
from src.services.courses.courses import get_user_courses
from src.services.users.password_reset import (
    change_password_with_reset_code,
    send_reset_password_code,
)
from src.services.users.users import (
    authorize_user_action,
    create_user_with_invite_validation,
    create_user_with_org_validation,
    create_user_without_org,
    delete_user_by_id,
    get_user_session,
    read_user_by_id,
    read_user_by_username,
    read_user_by_uuid,
    update_user,
    update_user_avatar,
    update_user_password,
)

router = APIRouter()


@router.get("/profile")
async def api_get_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
):
    """
    Get current user
    """
    return current_user.model_dump()


@router.get("/session")
async def api_get_current_user_session(
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
) -> UserSession:
    """
    Get current user session
    """
    return await get_user_session(request, db_session, current_user)


@router.get("/authorize/ressource/{ressource_uuid}/action/{action}")
async def api_get_authorization_status(
    request: Request,
    ressource_uuid: str,
    action: Literal["create", "read", "update", "delete"],
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
):
    """
    Get current user authorization status
    """
    return await authorize_user_action(
        request, db_session, current_user, ressource_uuid, action
    )


@router.post("/{org_id}", tags=["users"])
async def api_create_user_with_orgid(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[PermissionService, Depends(get_permission_service)],
    user_object: UserCreate,
    org_id: int,
) -> UserRead:
    """
    Create User with Org ID

    **Required Permission**: `user:create:org`
    """
    # Check permission to create users in this organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.USER,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            reason="You don't have permission to create users in this organization",
            action=Action.CREATE,
            resource_type=ResourceType.USER,
            org_id=org_id,
        )

    return await create_user_with_org_validation(
        request, db_session, current_user, user_object, org_id
    )


@router.post("/{org_id}/invite/{invite_code}", tags=["users"])
async def api_create_user_with_orgid_and_invite(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    user_object: UserCreate,
    invite_code: str,
    org_id: int,
) -> UserRead:
    """
    Create User with Org ID and invite code
    """
    return await create_user_with_invite_validation(
        request, db_session, current_user, user_object, invite_code, org_id
    )


@router.post("/", tags=["users"])
async def api_create_user_without_org(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    user_object: UserCreate,
) -> UserRead:
    """
    Create User
    """
    return await create_user_without_org(request, db_session, current_user, user_object)


@router.get("/id/{user_id}", tags=["users"])
async def api_get_user_by_id(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    user_id: int,
    response: Response,
) -> UserRead:
    """
    Get User by ID
    """
    # Short client-side cache; data is user-scoped and should be private
    response.headers["Cache-Control"] = "private, max-age=60"
    return await read_user_by_id(request, db_session, current_user, user_id)


@router.get("/uuid/{user_uuid}", tags=["users"])
async def api_get_user_by_uuid(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    user_uuid: str,
) -> UserRead:
    """
    Get User by UUID
    """
    return await read_user_by_uuid(request, db_session, current_user, user_uuid)


@router.get("/username/{username}", tags=["users"])
async def api_get_user_by_username(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    username: str,
    response: Response,
) -> UserRead:
    """
    Get User by Username
    """
    # Short client-side cache; data is user-scoped and should be private
    response.headers["Cache-Control"] = "private, max-age=60"
    return await read_user_by_username(request, db_session, current_user, username)


@router.put("/{user_id}", tags=["users"])
async def api_update_user(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[PermissionService, Depends(get_permission_service)],
    user_id: int,
    user_object: UserUpdate,
) -> UserRead:
    """
    Update User

    **Required Permission**: `user:update:own` (for own profile) or `user:update:org` (for others)
    """
    # Check if updating own profile or another user's profile
    is_own_profile = user_id == current_user.id

    if not is_own_profile:
        # Check permission to update other users
        has_permission = await permission_service.check(
            user=current_user,
            action=Action.UPDATE,
            resource=ResourceType.USER,
            raise_on_deny=False,
        )

        if not has_permission:
            raise PermissionDenied(
                reason="You don't have permission to update other users",
                action=Action.UPDATE,
                resource_type=ResourceType.USER,
                resource_id=user_id,
            )

    return await update_user(request, db_session, user_id, current_user, user_object)


@router.put("/update_avatar/{user_id}", tags=["users"])
async def api_update_avatar_user(
    *,
    request: Request,
    user_id: int,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[PermissionService, Depends(get_permission_service)],
    avatar_file: UploadFile | None = None,
) -> UserRead:
    """
    Update User Avatar

    **Required Permission**: `user:update:own` (for own avatar) or `user:update:org` (for others)
    """
    # Check if updating own avatar or another user's avatar
    is_own_avatar = user_id == current_user.id

    if not is_own_avatar:
        # Check permission to update other users
        has_permission = await permission_service.check(
            user=current_user,
            action=Action.UPDATE,
            resource=ResourceType.USER,
            raise_on_deny=False,
        )

        if not has_permission:
            raise PermissionDenied(
                reason="You don't have permission to update other users' avatars",
                action=Action.UPDATE,
                resource_type=ResourceType.USER,
                resource_id=user_id,
            )

    return await update_user_avatar(request, db_session, current_user, avatar_file)


@router.put("/change_password/{user_id}", tags=["users"])
async def api_update_user_password(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    user_id: int,
    form: UserUpdatePassword,
) -> UserRead:
    """
    Update User Password

    **Required Permission**: Own account only (for security)
    """
    # Password changes restricted to own account only
    if user_id != current_user.id:
        raise PermissionDenied(
            reason="You can only change your own password",
            action=Action.UPDATE,
            resource_type=ResourceType.USER,
            resource_id=user_id,
        )

    return await update_user_password(request, db_session, current_user, user_id, form)


@router.put("/preferences/theme/{user_id}", tags=["users"])
async def api_update_user_theme(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    user_id: int,
    theme: str,
) -> UserRead:
    """
    Update User Theme Preference
    """
    user_update = UserUpdate(theme=theme)
    return await update_user(request, db_session, user_id, current_user, user_update)


@router.put("/preferences/locale/{user_id}", tags=["users"])
async def api_update_user_locale(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    user_id: int,
    locale: str,
) -> UserRead:
    """
    Update User Locale Preference
    """
    user_update = UserUpdate(locale=locale)
    return await update_user(request, db_session, user_id, current_user, user_update)


@router.post("/reset_password/change_password/{email}", tags=["users"])
async def api_change_password_with_reset_code(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    new_password: str,
    email: EmailStr,
    org_id: int,
    reset_code: str,
):
    """
    Change password with reset code
    """
    return await change_password_with_reset_code(
        request, db_session, current_user, new_password, org_id, email, reset_code
    )


@router.post("/reset_password/send_reset_code/{email}", tags=["users"])
async def api_send_password_reset_email(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    email: EmailStr,
    org_id: int,
):
    """
    Send password reset email
    """
    return await send_reset_password_code(
        request, db_session, current_user, org_id, email
    )


@router.delete("/user_id/{user_id}", tags=["users"])
async def api_delete_user(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[PermissionService, Depends(get_permission_service)],
    user_id: int,
):
    """
    Delete User

    **Required Permission**: `user:delete:org`
    """
    # Check permission to delete users
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.USER,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            reason="You don't have permission to delete users",
            action=Action.DELETE,
            resource_type=ResourceType.USER,
            resource_id=user_id,
        )

    # Prevent self-deletion
    if user_id == current_user.id:
        raise PermissionDenied(
            reason="You cannot delete your own account through this endpoint",
            action=Action.DELETE,
            resource_type=ResourceType.USER,
            resource_id=user_id,
        )

    return await delete_user_by_id(request, db_session, current_user, user_id)


@router.get("/{user_id}/courses", tags=["users"])
async def api_get_user_courses(
    *,
    request: Request,
    db_session: Annotated[Session, Depends(get_db_session)],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    user_id: int,
    page: int = 1,
    limit: int = 20,
) -> list[CourseRead]:
    """
    Get courses made or contributed by a user.
    """
    return await get_user_courses(
        request=request,
        current_user=current_user,
        user_id=user_id,
        db_session=db_session,
        page=page,
        limit=limit,
    )
