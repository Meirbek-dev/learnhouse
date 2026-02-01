import contextlib
from datetime import UTC, datetime

import orjson
from fastapi import HTTPException
from sqlmodel import Session, select
from ulid import ULID

from config.config import get_platform_config
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
from src.db.organizations import Organization, OrganizationCreate
from src.db.users import User, UserCreate, UserRead
from src.security.security import security_hash_password
from src.services.permissions.permission_service_consolidated import PermissionService


# Install Default roles
def install_default_elements(db_session: Session) -> bool:
    """
    Install default elements including system roles and permissions.

    Uses the new RBAC permission system via PermissionService.
    """
    permission_service = PermissionService(db_session)

    # Seed default roles and permissions using the new RBAC system
    # This creates: super-admin, org-admin, maintainer, instructor, moderator, user
    created_roles = permission_service.seed_default_roles()

    return len(created_roles) > 0


# Organization creation
def install_create_organization(org_object: OrganizationCreate, db_session: Session):
    org = Organization.model_validate(org_object)

    # Complete the org object
    org.org_uuid = f"org_{ULID()}"
    org.creation_date = str(datetime.now())
    org.update_date = str(datetime.now())

    db_session.add(org)
    db_session.commit()
    db_session.refresh(org)

    # Org Config
    org_config = OrganizationConfigBase(
        config_version="1.3",
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
            payments=PaymentOrgConfig(enabled=False),
            discussions=DiscussionOrgConfig(enabled=True, limit=0),
            analytics=AnalyticsOrgConfig(enabled=True, limit=0),
            collaboration=CollaborationOrgConfig(enabled=True, limit=0),
            api=APIOrgConfig(enabled=True, limit=0),
        ),
        cloud=OrgCloudConfig(plan="free", custom_domain=False),
        landing={},
    )

    org_config_dict = orjson.loads(org_config.model_dump_json())

    # OrgSettings
    org_settings = OrganizationConfig(
        org_id=int(org.id if org.id else 0),
        config=org_config_dict,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(org_settings)
    db_session.commit()
    db_session.refresh(org_settings)

    return org


async def install_create_organization_user(
    user_object: UserCreate, org_slug: str, db_session: Session
):
    user = User.model_validate(user_object)

    # Complete the user object
    user.user_uuid = f"user_{ULID()}"
    user.password = security_hash_password(user_object.password)
    user.email_verified = False
    user.creation_date = str(datetime.now())
    user.update_date = str(datetime.now())

    # Verifications

    # Check if Organization exists
    statement = select(Organization).where(Organization.slug == org_slug)
    org = db_session.exec(statement)

    if not org.first():
        raise HTTPException(
            status_code=409,
            detail="Organization does not exist",
        )

    # Username
    statement = select(User).where(User.username == user.username)
    result = db_session.exec(statement)

    if result.first():
        raise HTTPException(
            status_code=409,
            detail="Имя пользователя уже существует",
        )

    # Email
    statement = select(User).where(User.email == user.email)
    result = db_session.exec(statement)

    if result.first():
        raise HTTPException(
            status_code=409,
            detail="Пользователь с данной электронной почтой уже существует",
        )

    # Exclude unset values
    user_data = user.model_dump(exclude_unset=True)
    for key, value in user_data.items():
        setattr(user, key, value)

    # Add user to database
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    # get org id
    statement = select(Organization).where(Organization.slug == org_slug)
    org = db_session.exec(statement)
    org = org.first()
    org_id = org.id if org else 0

    # Link user and organization by assigning admin role
    from src.services.permissions import get_permission_service
    permission_service = get_permission_service(db_session)
    permission_service.assign_role(
        user_id=user.id if user.id else 0,
        role_id=1,  # Admin role
        org_id=org_id or 0,
    )

    return UserRead.model_validate(user)
