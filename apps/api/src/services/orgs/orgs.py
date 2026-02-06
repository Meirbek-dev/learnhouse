import logging
from datetime import UTC, datetime
from typing import Literal

import orjson
from fastapi import HTTPException, Request, UploadFile, status
from sqlmodel import Session, select
from src.security.rbac import PermissionChecker
from ulid import ULID

from src.db.organization_config import (
    AIOrgConfig,
    AnalyticsOrgConfig,
    APIOrgConfig,
    AssignmentOrgConfig,
    CollaborationOrgConfig,
    CourseOrgConfig,
    DiscussionOrgConfig,
    MemberOrgConfig,
    OrganizationConfig,
    OrganizationConfigBase,
    OrgCloudConfig,
    OrgFeatureConfig,
    OrgGeneralConfig,
    PaymentOrgConfig,
    StorageOrgConfig,
    UserGroupOrgConfig,
)
from src.db.organizations import (
    Organization,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)
from src.db.permissions import Role, UserRole
from src.db.users import AnonymousUser, InternalUser, PublicUser
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

    # Allow anonymous read if the organization is marked as discoverable (explore=True)
    if isinstance(current_user, AnonymousUser) and getattr(org, "explore", False):
        # Skip RBAC check for public orgs
        pass
    else:
        # RBAC check
        checker = PermissionChecker(db_session)
        checker.require(current_user.id, "organization:read:org", org.id)

    # Get org config
    statement = select(OrganizationConfig).where(OrganizationConfig.org_id == org.id)
    result = db_session.exec(statement)

    org_config = result.first()

    if org_config is None:
        logging.error(f"Organization {org_id} has no config")

    config = OrganizationConfig.model_validate(org_config) if org_config else {}

    return OrganizationRead(**org.model_dump(), config=config)


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

    # Allow anonymous read if the organization is marked as discoverable (explore=True)
    if isinstance(current_user, AnonymousUser) and getattr(org, "explore", False):
        # Skip RBAC check for public orgs
        pass
    else:
        # RBAC check
        checker = PermissionChecker(db_session)
        checker.require(current_user.id, "organization:read:org", org.id)

    # Get org config
    statement = select(OrganizationConfig).where(OrganizationConfig.org_id == org.id)
    result = db_session.exec(statement)

    org_config = result.first()

    if org_config is None:
        logging.error(f"Organization {org_slug} has no config")

    config = OrganizationConfig.model_validate(org_config) if org_config else {}

    return OrganizationRead(**org.model_dump(), config=config)


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

    # Link user to org by assigning admin role
    from src.security.rbac import PermissionChecker

    checker = PermissionChecker(db_session)
    checker.assign_role(
        user_id=int(current_user.id),
        role_slug="org-admin",
        org_id=int(org.id or 0),
    )

    org_config = OrganizationConfigBase(
        config_version="1.1",
        general=OrgGeneralConfig(enabled=True, color="normal"),
        features=OrgFeatureConfig(
            courses=CourseOrgConfig(enabled=True, limit=0),
            members=MemberOrgConfig(
                enabled=True, signup_mode="open", admin_limit=0, limit=0
            ),
            usergroups=UserGroupOrgConfig(enabled=True, limit=0),
            storage=StorageOrgConfig(enabled=True, limit=0),
            ai=AIOrgConfig(enabled=True, limit=0, model="gpt-5-nano"),
            assignments=AssignmentOrgConfig(enabled=True, limit=0),
            payments=PaymentOrgConfig(enabled=True),
            discussions=DiscussionOrgConfig(enabled=True, limit=0),
            analytics=AnalyticsOrgConfig(enabled=True, limit=0),
            collaboration=CollaborationOrgConfig(enabled=True, limit=0),
            api=APIOrgConfig(enabled=True, limit=0),
        ),
        cloud=OrgCloudConfig(plan="free", custom_domain=False),
    )

    org_config_dict = orjson.loads(org_config.model_dump_json())

    # OrgSettings
    org_settings = OrganizationConfig(
        org_id=int(org.id or 0),
        config=org_config_dict,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(org_settings)
    db_session.commit()
    db_session.refresh(org_settings)

    # Get org config
    statement = select(OrganizationConfig).where(OrganizationConfig.org_id == org.id)
    result = db_session.exec(statement)

    org_config = result.first()

    if org_config is None:
        logging.error(f"Organization {org.id} has no config")

    config = OrganizationConfig.model_validate(org_config)

    return OrganizationRead(**org.model_dump(), config=config)


async def create_org_with_config(
    request: Request,
    org_object: OrganizationCreate,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
    submitted_config: OrganizationConfigBase,
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

    # Link user to org by assigning admin role
    from src.security.rbac import PermissionChecker

    checker = PermissionChecker(db_session)
    checker.assign_role(
        user_id=int(current_user.id),
        role_slug="org-admin",
        org_id=int(org.id or 0),
    )
    org_config = submitted_config

    org_config_dict = orjson.loads(org_config.model_dump_json())

    # OrgSettings
    org_settings = OrganizationConfig(
        org_id=int(org.id or 0),
        config=org_config_dict,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(org_settings)
    db_session.commit()
    db_session.refresh(org_settings)

    # Get org config
    statement = select(OrganizationConfig).where(OrganizationConfig.org_id == org.id)
    result = db_session.exec(statement)

    org_config = result.first()

    if org_config is None:
        logging.error(f"Organization {org.id} has no config")

    config = OrganizationConfig.model_validate(org_config)

    return OrganizationRead(**org.model_dump(), config=config)


async def update_org(
    request: Request,
    org_object: OrganizationUpdate,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:update:org", org.id)

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


async def update_org_with_config_no_auth(
    request: Request,
    orgconfig: OrganizationConfigBase,
    org_id: int,
    db_session: Session,
):
    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization slug not found",
        )

    # Get org config
    statement = select(OrganizationConfig).where(OrganizationConfig.org_id == org.id)
    result = db_session.exec(statement)

    org_config = result.first()

    if org_config is None:
        logging.error(f"Organization {org_id} has no config")
        raise HTTPException(
            status_code=404,
            detail="Organization config not found",
        )

    updated_config = orgconfig

    # Update the database
    org_config.config = orjson.loads(updated_config.model_dump_json())
    org_config.update_date = str(datetime.now())

    db_session.add(org_config)
    db_session.commit()
    db_session.refresh(org_config)

    return {"detail": "Organization updated"}


async def update_org_logo(
    request: Request,
    logo_file: UploadFile,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:update:org", org.id)

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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:update:org", org.id)

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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:update:org", org.id)

    # Upload logo
    name_in_disk = await upload_org_preview(preview_file, org.org_uuid)

    return {"name_in_disk": name_in_disk}


async def delete_org(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:delete:org", org.id)

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

    # Join Organization, UserRole and OrganizationConfig in a single query
    # Resolve the admin role id by slug (new RBAC system)
    admin_role = db_session.exec(
        select(Role).where(Role.slug.in_(["super-admin", "org-admin"]))
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

    org_ids = [r[0] for r in db_session.exec(org_id_query).all()]

    orgsWithConfig = []
    if org_ids:
        statement = (
            select(Organization, OrganizationConfig)
            .outerjoin(OrganizationConfig)
            .where(
                Organization.id.in_(org_ids),
                OrganizationConfig.org_id == Organization.id,
            )
        )
        result = db_session.exec(statement).all()
        # Map by org id to preserve the set
        org_map: dict[int, tuple] = {
            org.id: (org, org_config) for org, org_config in result
        }
        for oid in org_ids:
            org, org_config = org_map.get(oid, (None, None))
            if not org:
                continue
            config = OrganizationConfig.model_validate(org_config) if org_config else {}
            org_read = OrganizationRead(**org.model_dump(), config=config)
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

    org_ids = [r[0] for r in db_session.exec(org_id_query).all()]

    orgsWithConfig = []
    if org_ids:
        statement = (
            select(Organization, OrganizationConfig)
            .outerjoin(OrganizationConfig)
            .where(
                Organization.id.in_(org_ids),
                OrganizationConfig.org_id == Organization.id,
            )
        )
        result = db_session.exec(statement).all()
        org_map: dict[int, tuple] = {
            org.id: (org, org_config) for org, org_config in result
        }
        for oid in org_ids:
            org, org_config = org_map.get(oid, (None, None))
            if not org:
                continue
            config = OrganizationConfig.model_validate(org_config) if org_config else {}
            org_read = OrganizationRead(**org.model_dump(), config=config)
            orgsWithConfig.append(org_read)

    return orgsWithConfig


# Config related
async def update_org_signup_mechanism(
    request: Request,
    signup_mechanism: Literal["open", "inviteOnly"],
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:update:org", org.id)

    # Get org config
    statement = select(OrganizationConfig).where(OrganizationConfig.org_id == org.id)
    result = db_session.exec(statement)

    org_config = result.first()

    if org_config is None:
        logging.error(f"Organization {org_id} has no config")
        raise HTTPException(
            status_code=404,
            detail="Organization config not found",
        )

    updated_config = org_config.config

    # Update config
    updated_config = OrganizationConfigBase(**updated_config)
    updated_config.features.members.signup_mode = signup_mechanism

    # Update the database
    org_config.config = orjson.loads(updated_config.model_dump_json())
    org_config.update_date = str(datetime.now())

    db_session.add(org_config)
    db_session.commit()
    db_session.refresh(org_config)

    return {"detail": "Signup mechanism updated"}


async def get_org_join_mechanism(
    request: Request,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:read:org", org.id)

    # Get org config
    statement = select(OrganizationConfig).where(OrganizationConfig.org_id == org.id)
    result = db_session.exec(statement)

    org_config = result.first()

    if org_config is None:
        logging.error(f"Organization {org_id} has no config")
        raise HTTPException(
            status_code=404,
            detail="Organization config not found",
        )

    config = org_config.config

    # Get the signup mechanism
    config = OrganizationConfigBase(**config)
    return config.features.members.signup_mode


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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:update:org", org.id)

    # Get org config
    statement = select(OrganizationConfig).where(OrganizationConfig.org_id == org.id)
    result = db_session.exec(statement)

    org_config = result.first()

    if org_config is None:
        logging.error(f"Organization {org_id} has no config")
        raise HTTPException(
            status_code=404,
            detail="Organization config not found",
        )

    # Convert to OrganizationConfigBase model and back to ensure all fields exist
    config_model = OrganizationConfigBase(**org_config.config)

    # Update the landing object
    config_model.landing = landing_object

    # Convert back to dict and update
    updated_config_dict = orjson.loads(config_model.model_dump_json())
    org_config.config = updated_config_dict
    org_config.update_date = str(datetime.now())

    db_session.add(org_config)
    db_session.commit()
    db_session.refresh(org_config)

    return {"detail": "Landing object updated"}


async def upload_org_landing_content_service(
    request: Request,
    content_file: UploadFile,
    org_id: int,
    current_user: PublicUser | AnonymousUser,
    db_session: Session,
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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:update:org", org.id)

    # Upload content
    name_in_disk = await upload_org_landing_content(content_file, org.org_uuid)

    return {"detail": "Landing content uploaded successfully", "filename": name_in_disk}
