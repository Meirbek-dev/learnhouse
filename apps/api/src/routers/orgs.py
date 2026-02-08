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
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.security.rbac import PermissionCheckerDep
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
    update_org_thumbnail,
    upload_org_landing_content_service,
)
from src.services.orgs.users import (
    get_organization_users,
    remove_user_from_org,
    update_user_role,
)

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


@router.put("/{org_id}/users/{user_id}/role/{role_id}")
async def api_update_user_role(
    request: Request,
    org_id: int,
    user_id: int,
    role_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Update user role in an organization.

    **Path Parameter**: `role_id` — numeric role ID

    **Required Permission**: `organization:update`
    """
    return await update_user_role(
        request, org_id, user_id, role_id, db_session, current_user
    )


@router.delete("/{org_id}/users/{user_id}")
async def api_remove_user_from_org(
    request: Request,
    org_id: int,
    user_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """
    Remove user from org
    """
    return await remove_user_from_org(
        request, org_id, user_id, db_session, current_user
    )


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
    db_session: Annotated[Session, Depends(get_db_session)],
    checker: PermissionCheckerDep,
):
    """
    Update org logo

    **Required Permission**: `organization:update`
    """
    checker.require(current_user.id, "organization:update", org_id)
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
    db_session: Annotated[Session, Depends(get_db_session)],
    checker: PermissionCheckerDep,
):
    """
    Update org thumbnail

    **Required Permission**: `organization:update`
    """
    checker.require(current_user.id, "organization:update", org_id)
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
    db_session: Annotated[Session, Depends(get_db_session)],
    checker: PermissionCheckerDep,
):
    """
    Update org preview

    **Required Permission**: `organization:update`
    """
    checker.require(current_user.id, "organization:update", org_id)
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
    db_session: Annotated[Session, Depends(get_db_session)],
    checker: PermissionCheckerDep,
) -> OrganizationRead:
    """
    Update Org by ID

    **Required Permission**: `organization:update`
    """
    checker.require(current_user.id, "organization:update", org_id)
    return await update_org(request, org_object, org_id, current_user, db_session)


@router.delete("/{org_id}")
async def api_delete_org(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
    checker: PermissionCheckerDep,
):
    """
    Delete Org by ID

    **Required Permission**: `organization:delete`
    """
    checker.require(current_user.id, "organization:delete", org_id)
    return await delete_org(request, org_id, current_user, db_session)


@router.put("/{org_id}/landing")
async def api_update_org_landing(
    request: Request,
    org_id: int,
    landing_object: dict,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
    checker: PermissionCheckerDep,
):
    """
    Update organization landing object

    **Required Permission**: `organization:update`
    """
    checker.require(current_user.id, "organization:update", org_id)
    return await update_org_landing(
        request, landing_object, org_id, current_user, db_session
    )


@router.post("/{org_id}/landing/content")
async def api_upload_org_landing_content(
    request: Request,
    org_id: int,
    content_file: UploadFile,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
    checker: PermissionCheckerDep,
):
    """
    Upload content for organization landing page

    **Required Permission**: `organization:update`
    """
    checker.require(current_user.id, "organization:update", org_id)
    return await upload_org_landing_content_service(
        request=request,
        content_file=content_file,
        org_id=org_id,
        current_user=current_user,
        db_session=db_session,
    )
