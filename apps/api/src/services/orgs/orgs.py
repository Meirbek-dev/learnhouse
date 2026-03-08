from datetime import UTC, datetime
from typing import Literal

from fastapi import HTTPException, Request, UploadFile, status
from sqlmodel import Session, select
from ulid import ULID

from src.db.organizations import (
    Organization,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)
from src.db.permission_enums import ADMIN_ROLE_SLUGS, RoleSlug
from src.db.permissions import Role, UserRole
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.security.rbac import PermissionChecker
from src.services.orgs.uploads import (
    upload_org_landing_content,
    upload_org_logo,
    upload_org_preview,
    upload_org_thumbnail,
)


async def get_organization(
    request: Request,
    org_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    checker: PermissionChecker | None = None,
) -> OrganizationRead:
    # Convert org_id to int for proper type matching with database
    org_id_int = int(org_id)

    statement = select(Organization).where(Organization.id == org_id_int)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    if checker is None:
        checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "organization:read", org.id, resource_owner_id=org.creator_id
    )

    return OrganizationRead.model_validate(org)


async def get_organization_by_slug(
    request: Request,
    org_slug: str,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
) -> OrganizationRead:
    statement = select(Organization).where(Organization.slug == org_slug)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    return OrganizationRead.model_validate(org)


async def create_org(
    request: Request,
    org_object: OrganizationCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
):
    statement = select(Organization).where(Organization.slug == org_object.slug)
    result = db_session.exec(statement)

    org = result.first()

    if org:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization already exists",
        )

    org = Organization.model_validate(org_object)

    if isinstance(current_user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You should be logged in to be able to achieve this action",
        )

    # Complete the org object
    org.org_uuid = f"org_{ULID()}"
    org.creation_date = str(datetime.now())
    org.update_date = str(datetime.now())
    org.creator_id = current_user.id

    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    from src.db.permissions import Role

    admin_role = db_session.exec(
        select(Role).where(Role.slug == RoleSlug.ADMIN)
    ).first()
    if not admin_role:
        raise HTTPException(500, detail="Admin role not found")

    # Link user to org by assigning admin role
    from src.security.rbac import PermissionChecker

    checker = PermissionChecker(db_session)
    checker.assign_role(
        user_id=int(current_user.id),
        role_id=admin_role.id,
        org_id=int(org.id or 0),
    )

    return OrganizationRead.model_validate(org)


async def update_org(
    request: Request,
    org_object: OrganizationUpdate,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    checker: PermissionChecker | None = None,
):
    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization slug not found",
        )

    # RBAC check
    if checker is None:
        checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "organization:update", org.id, resource_owner_id=org.creator_id
    )

    # Verify if the new slug is already in use
    statement = select(Organization).where(Organization.slug == org_object.slug)
    result = db_session.exec(statement)

    slug_available = result.first()

    if slug_available and slug_available.id != org_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Organization slug already exists",
        )

    # Update only the fields that were passed in
    update_data = org_object.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if value is not None:
            setattr(org, field, value)

    # Complete the org object
    org.update_date = str(datetime.now())

    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    return OrganizationRead.model_validate(org)


async def update_org_logo(
    request: Request,
    logo_file: UploadFile,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    checker: PermissionChecker | None = None,
):
    # Convert org_id to int for proper type matching with database
    org_id_int = int(org_id)

    statement = select(Organization).where(Organization.id == org_id_int)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    if checker is None:
        checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "organization:update", org.id, resource_owner_id=org.creator_id
    )

    # Upload logo
    name_in_disk = await upload_org_logo(logo_file, org.org_uuid)

    # Update org
    org.logo_image = name_in_disk

    # Complete the org object
    org.update_date = str(datetime.now())

    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    return {"detail": "Logo updated"}


async def update_org_thumbnail(
    request: Request,
    thumbnail_file: UploadFile,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    checker: PermissionChecker | None = None,
):
    # Convert org_id to int for proper type matching with database
    org_id_int = int(org_id)

    statement = select(Organization).where(Organization.id == org_id_int)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    if checker is None:
        checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "organization:update", org.id, resource_owner_id=org.creator_id
    )

    # Upload logo
    name_in_disk = await upload_org_thumbnail(thumbnail_file, org.org_uuid)

    # Update org
    org.thumbnail_image = name_in_disk

    # Complete the org object
    org.update_date = str(datetime.now())

    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    return {"detail": "Thumbnail updated"}


async def update_org_preview(
    request: Request,
    preview_file: UploadFile,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    checker: PermissionChecker | None = None,
):
    # Convert org_id to int for proper type matching with database
    org_id_int = int(org_id)

    statement = select(Organization).where(Organization.id == org_id_int)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    if checker is None:
        checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "organization:update", org.id, resource_owner_id=org.creator_id
    )

    # Upload logo
    name_in_disk = await upload_org_preview(preview_file, org.org_uuid)

    return {"name_in_disk": name_in_disk}


async def delete_org(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    checker: PermissionChecker | None = None,
):
    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    if checker is None:
        checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "organization:delete", org.id, resource_owner_id=org.creator_id
    )

    db_session.delete(org)
    db_session.commit()

    # Delete all user roles linked to this org
    statement = select(UserRole).where(UserRole.org_id == org_id)
    result = db_session.exec(statement)

    user_roles = result.all()

    for role in user_roles:
        db_session.delete(role)
    db_session.commit()

    db_session.refresh(org)

    return {"detail": "Organization deleted"}


async def get_orgs_by_user_admin(
    request: Request,
    db_session: Session,
    user_id: int,
    page: int = 1,
    limit: int = 10,
) -> list[OrganizationRead]:
    # Convert user_id to int for proper type matching with database
    user_id_int = int(user_id)

    # Resolve the admin role id by slug (new RBAC system)
    admin_role = db_session.exec(
        select(Role).where(Role.slug.in_(list(ADMIN_ROLE_SLUGS)))
    ).first()
    admin_role_id = admin_role.id if admin_role else 1

    # First get distinct org IDs where the user has admin role
    org_id_query = (
        select(UserRole.org_id)
        .where(
            UserRole.user_id == user_id_int,
            UserRole.role_id == admin_role_id,
        )
        .distinct()
        .offset((page - 1) * limit)
        .limit(limit)
    )

    org_ids = db_session.exec(org_id_query).all()

    orgsWithConfig = []
    if org_ids:
        statement = select(Organization).where(Organization.id.in_(org_ids))
        result = db_session.exec(statement).all()
        org_map: dict[int, Organization] = {org.id: org for org in result if org.id}
        for oid in org_ids:
            org = org_map.get(oid)
            if not org:
                continue
            org_read = OrganizationRead.model_validate(org)
            orgsWithConfig.append(org_read)

    return orgsWithConfig


async def get_orgs_by_user(
    request: Request,
    db_session: Session,
    user_id: int,
    page: int = 1,
    limit: int = 10,
) -> list[OrganizationRead]:
    # Convert user_id to int for proper type matching with database
    user_id_int = int(user_id)

    # First get distinct org IDs for this user
    org_id_query = (
        select(UserRole.org_id)
        .where(UserRole.user_id == user_id_int)
        .distinct()
        .offset((page - 1) * limit)
        .limit(limit)
    )

    org_ids = db_session.exec(org_id_query).all()

    orgsWithConfig = []
    if org_ids:
        statement = select(Organization).where(Organization.id.in_(org_ids))
        result = db_session.exec(statement).all()
        org_map: dict[int, Organization] = {org.id: org for org in result if org.id}
        for oid in org_ids:
            org = org_map.get(oid)
            if not org:
                continue
            org_read = OrganizationRead.model_validate(org)
            orgsWithConfig.append(org_read)

    return orgsWithConfig


async def upload_org_preview_service(
    preview_file: UploadFile,
    org_uuid: str,
) -> dict:
    # No need for request or current_user since we're not doing RBAC checks for previews

    # Upload preview
    name_in_disk = await upload_org_preview(preview_file, org_uuid)

    return {"detail": "Preview uploaded successfully", "filename": name_in_disk}


async def update_org_landing(
    request: Request,
    landing_object: dict,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    checker: PermissionChecker | None = None,
):
    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    if checker is None:
        checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "organization:update", org.id, resource_owner_id=org.creator_id
    )

    org.landing = landing_object
    org.update_date = str(datetime.now())

    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    return {"detail": "Landing object updated"}


async def upload_org_landing_content_service(
    request: Request,
    content_file: UploadFile,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    checker: PermissionChecker | None = None,
) -> dict:
    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    if checker is None:
        checker = PermissionChecker(db_session)
    checker.require(
        current_user.id, "organization:update", org.id, resource_owner_id=org.creator_id
    )

    # Upload content
    name_in_disk = await upload_org_landing_content(content_file, org.org_uuid)

    return {"detail": "Landing content uploaded successfully", "filename": name_in_disk}
