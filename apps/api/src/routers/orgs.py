from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Request, UploadFile
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.organization_config import OrganizationConfigBase
from src.db.organizations import (
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
    OrganizationUser,
    PaginatedOrganizationUsers,
)
from src.db.permissions import Action, ResourceType
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.security.permissions.exceptions import PermissionDenied
from src.security.rbac.dependencies import get_permission_service
from src.services.orgs.invites import (
    create_invite_code,
    create_invite_code_with_usergroup,
    delete_invite_code,
    get_invite_code,
    get_invite_codes,
)
from src.services.orgs.join import JoinOrg, join_org
from src.services.orgs.orgs import (
    create_org,
    create_org_with_config,
    delete_org,
    get_organization,
    get_organization_by_slug,
    get_orgs_by_user,
    get_orgs_by_user_admin,
    update_org,
    update_org_landing,
    update_org_logo,
    update_org_preview,
    update_org_signup_mechanism,
    update_org_thumbnail,
    upload_org_landing_content_service,
)
from src.services.orgs.users import (
    get_list_of_invited_users,
    get_organization_users,
    invite_batch_users,
    remove_invited_user,
    remove_user_from_org,
    update_user_role,
)
from src.services.permissions import PermissionService

router = APIRouter()


@router.post("/")
async def api_create_org(
    request: Request,
    org_object: OrganizationCreate,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> OrganizationRead:
    """
    Create new organization
    """
    return await create_org(request, org_object, current_user, db_session)


# Temporary pre-alpha code
@router.post("/withconfig/")
async def api_create_org_withconfig(
    request: Request,
    org_object: OrganizationCreate,
    config_object: OrganizationConfigBase,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> OrganizationRead:
    """
    Create new organization
    """
    return await create_org_with_config(
        request, org_object, current_user, db_session, config_object
    )


@router.get("/{org_id}")
async def api_get_org(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> OrganizationRead:
    """
    Get single Org by ID
    """
    return await get_organization(request, org_id, db_session, current_user)


@router.get("/{org_id}/users")
async def api_get_org_users(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
    page: int = 1,
    per_page: int = 20,
) -> PaginatedOrganizationUsers:
    """
    Get organization users with pagination
    """
    return await get_organization_users(
        request, org_id, db_session, current_user, page, per_page
    )


@router.post("/join")
async def api_join_an_org(
    request: Request,
    args: JoinOrg,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Get single Org by ID
    """
    return await join_org(request, args, current_user, db_session)


@router.put("/{org_id}/users/{user_id}/role/{role_uuid}")
async def api_update_user_role(
    request: Request,
    org_id: int,
    user_id: int,
    role_uuid: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Update user role
    """
    return await update_user_role(
        request, org_id, user_id, role_uuid, db_session, current_user
    )


@router.delete("/{org_id}/users/{user_id}")
async def api_remove_user_from_org(
    request: Request,
    org_id: int,
    user_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Remove user from org

    **Required Permission**: `user:delete:org`
    """
    # Check permission to remove users from organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.USER,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.DELETE,
            resource_type=ResourceType.USER,
            reason="User lacks permission to remove users from this organization",
        )
    return await remove_user_from_org(
        request, org_id, user_id, db_session, current_user
    )


# Config related routes
@router.put("/{org_id}/signup_mechanism")
async def api_get_org_signup_mechanism(
    request: Request,
    org_id: int,
    signup_mechanism: Literal["open", "inviteOnly"],
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Update org signup mechanism

    **Required Permission**: `organization:update:own`
    """
    # Check permission to update organization settings
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.UPDATE,
            resource_type=ResourceType.ORGANIZATION,
            reason="User lacks permission to update organization settings",
        )
    return await update_org_signup_mechanism(
        request, signup_mechanism, org_id, current_user, db_session
    )


# Invites related routes
@router.post("/{org_id}/invites")
async def api_create_invite_code(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Create invite code

    **Required Permission**: `user:invite:org`
    """
    # Check permission to invite users
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.INVITE,
        resource=ResourceType.USER,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.INVITE,
            resource_type=ResourceType.USER,
            reason="User lacks permission to invite users to this organization",
        )
    return await create_invite_code(request, org_id, current_user, db_session)


@router.post("/{org_id}/invites_with_usergroups")
async def api_create_invite_code_with_ug(
    request: Request,
    org_id: int,
    usergroup_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Create invite code with usergroup

    **Required Permission**: `user:invite:org`
    """
    # Check permission to invite users
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.INVITE,
        resource=ResourceType.USER,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.INVITE,
            resource_type=ResourceType.USER,
            reason="You don't have permission to invite users to this organization",
            org_id=org_id,
        )

    return await create_invite_code_with_usergroup(
        request, org_id, usergroup_id, current_user, db_session
    )


@router.get("/{org_id}/invites")
async def api_get_invite_codes(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Get invite codes
    """
    return await get_invite_codes(request, org_id, current_user, db_session)


@router.get("/{org_id}/invites/code/{invite_code}")
async def api_get_invite_code(
    request: Request,
    org_id: int,
    invite_code: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Get invite code
    """
    print(f"org_id: {org_id}, invite_code: {invite_code}")
    return await get_invite_code(request, org_id, invite_code, current_user, db_session)


@router.delete("/{org_id}/invites/{org_invite_code_uuid}")
async def api_delete_invite_code(
    request: Request,
    org_id: int,
    org_invite_code_uuid: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Delete invite code

    **Required Permission**: `user:invite:org`
    """
    # Check permission to manage invites
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.INVITE,
        resource=ResourceType.USER,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.INVITE,
            resource_type=ResourceType.USER,
            reason="You don't have permission to manage invites for this organization",
            org_id=org_id,
        )

    return await delete_invite_code(
        request, org_id, org_invite_code_uuid, current_user, db_session
    )


@router.post("/{org_id}/invites/users/batch")
async def api_invite_batch_users(
    request: Request,
    org_id: int,
    emails: str,
    invite_code_uuid: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Invite batch users by emails

    **Required Permission**: `user:invite:org`
    """
    # Check permission to invite users
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.INVITE,
        resource=ResourceType.USER,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.INVITE,
            resource_type=ResourceType.USER,
            reason="You don't have permission to invite users to this organization",
            org_id=org_id,
        )

    return await invite_batch_users(
        request, org_id, emails, invite_code_uuid, db_session, current_user
    )


@router.get("/{org_id}/invites/users")
async def api_get_org_users_invites(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Get org users invites
    """
    return await get_list_of_invited_users(request, org_id, db_session, current_user)


@router.delete("/{org_id}/invites/users/{email}")
async def api_delete_org_users_invites(
    request: Request,
    org_id: int,
    email: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Delete org users invites

    **Required Permission**: `user:invite:org`
    """
    # Check permission to manage invites
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.INVITE,
        resource=ResourceType.USER,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.INVITE,
            resource_type=ResourceType.USER,
            reason="You don't have permission to manage invites for this organization",
            org_id=org_id,
        )

    return await remove_invited_user(request, org_id, email, db_session, current_user)


@router.get("/slug/{org_slug}")
async def api_get_org_by_slug(
    request: Request,
    org_slug: str,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> OrganizationRead:
    """
    Get single Org by Slug
    """
    return await get_organization_by_slug(request, org_slug, db_session, current_user)


@router.put("/{org_id}/logo")
async def api_update_org_logo(
    request: Request,
    org_id: int,
    logo_file: UploadFile,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Update org logo

    **Required Permission**: `organization:update:own`
    """
    # Check permission to update organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.UPDATE,
            resource_type=ResourceType.ORGANIZATION,
            reason="You don't have permission to update this organization's logo",
            org_id=org_id,
        )

    return await update_org_logo(
        request=request,
        logo_file=logo_file,
        org_id=org_id,
        current_user=current_user,
        db_session=db_session,
    )


@router.put("/{org_id}/thumbnail")
async def api_update_org_thumbnail(
    request: Request,
    org_id: int,
    thumbnail_file: UploadFile,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Update org thumbnail

    **Required Permission**: `organization:update:own`
    """
    # Check permission to update organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.UPDATE,
            resource_type=ResourceType.ORGANIZATION,
            reason="You don't have permission to update this organization's thumbnail",
            org_id=org_id,
        )

    return await update_org_thumbnail(
        request=request,
        thumbnail_file=thumbnail_file,
        org_id=org_id,
        current_user=current_user,
        db_session=db_session,
    )


@router.put("/{org_id}/preview")
async def api_update_org_preview(
    request: Request,
    org_id: int,
    preview_file: UploadFile,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Update org preview

    **Required Permission**: `organization:update:own`
    """
    # Check permission to update organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.UPDATE,
            resource_type=ResourceType.ORGANIZATION,
            reason="You don't have permission to update this organization's preview",
            org_id=org_id,
        )

    return await update_org_preview(
        request=request,
        preview_file=preview_file,
        org_id=org_id,
        current_user=current_user,
        db_session=db_session,
    )


@router.get("/user/page/{page}/limit/{limit}")
async def api_user_orgs(
    request: Request,
    page: int,
    limit: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> list[OrganizationRead]:
    """
    Get orgs by page and limit by current user
    """
    return await get_orgs_by_user(
        request, db_session, str(current_user.id), page, limit
    )


@router.get("/user_admin/page/{page}/limit/{limit}")
async def api_user_orgs_admin(
    request: Request,
    page: int,
    limit: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> list[OrganizationRead]:
    """
    Get orgs by page and limit by current user
    """
    return await get_orgs_by_user_admin(
        request, db_session, str(current_user.id), page, limit
    )


@router.put("/{org_id}")
async def api_update_org(
    request: Request,
    org_object: OrganizationUpdate,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> OrganizationRead:
    """
    Update Org by ID

    **Required Permission**: `organization:update:own`
    """
    # Check permission to update organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.UPDATE,
            resource_type=ResourceType.ORGANIZATION,
            reason="You don't have permission to update this organization",
            org_id=org_id,
        )

    return await update_org(request, org_object, org_id, current_user, db_session)


@router.delete("/{org_id}")
async def api_delete_org(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Delete Org by ID

    **Required Permission**: `organization:delete:own`
    """
    # Check permission to delete organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.ORGANIZATION,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.DELETE,
            resource_type=ResourceType.ORGANIZATION,
            reason="You don't have permission to delete this organization",
            org_id=org_id,
        )

    return await delete_org(request, org_id, current_user, db_session)


@router.put("/{org_id}/landing")
async def api_update_org_landing(
    request: Request,
    org_id: int,
    landing_object: dict,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Update organization landing object

    **Required Permission**: `organization:update:own`
    """
    # Check permission to update organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.UPDATE,
            resource_type=ResourceType.ORGANIZATION,
            reason="You don't have permission to update this organization's landing page",
            org_id=org_id,
        )

    return await update_org_landing(
        request, landing_object, org_id, current_user, db_session
    )


@router.post("/{org_id}/landing/content")
async def api_upload_org_landing_content(
    request: Request,
    org_id: int,
    content_file: UploadFile,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    permission_service: Annotated[
        PermissionService, Depends(get_permission_service)
    ],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Upload content for organization landing page

    **Required Permission**: `organization:update:own`
    """
    # Check permission to update organization
    has_permission = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        org_id=org_id,
        raise_on_deny=False,
    )

    if not has_permission:
        raise PermissionDenied(
            action=Action.UPDATE,
            resource_type=ResourceType.ORGANIZATION,
            reason="You don't have permission to update this organization's landing content",
            org_id=org_id,
        )

    return await upload_org_landing_content_service(
        request=request,
        content_file=content_file,
        org_id=org_id,
        current_user=current_user,
        db_session=db_session,
    )
