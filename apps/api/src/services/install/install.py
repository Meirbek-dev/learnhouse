from datetime import datetime

import orjson
from fastapi import HTTPException, Request
from sqlalchemy import desc
from sqlmodel import Session, select
from ulid import ULID

from config.config import get_openu_config
from src.db.install import Install, InstallRead
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
from src.db.roles import Permission, Rights, Role, RoleTypeEnum
from src.db.user_organizations import UserOrganization
from src.db.users import User, UserCreate, UserRead
from src.security.security import security_hash_password


async def isInstallModeEnabled() -> bool:
    config = get_openu_config()

    if config.general_config.install_mode:
        return True
    raise HTTPException(
        status_code=403,
        detail="Install mode is not enabled",
    )


async def create_install_instance(request: Request, data: dict, db_session: Session):
    install = Install.model_validate(data)

    # complete install instance
    install.install_uuid = f"install_{ULID()}"
    install.update_date = str(datetime.now())
    install.creation_date = str(datetime.now())
    install.step = 1
    # insert install instance
    db_session.add(install)

    # commit changes
    db_session.commit()

    # refresh install instance
    db_session.refresh(install)

    return InstallRead.model_validate(install)


async def get_latest_install_instance(request: Request, db_session: Session):
    statement = select(Install).order_by(desc(Install.creation_date)).limit(1)
    install = db_session.exec(statement).first()

    if install is None:
        raise HTTPException(
            status_code=404,
            detail="No install instance found",
        )

    return InstallRead.model_validate(install)


async def update_install_instance(
    request: Request, data: dict, step: int, db_session: Session
):
    statement = select(Install).order_by(desc(Install.creation_date)).limit(1)
    install = db_session.exec(statement).first()

    if install is None:
        raise HTTPException(
            status_code=404,
            detail="No install instance found",
        )

    install.step = step
    install.data = data

    # commit changes
    db_session.commit()

    # refresh install instance
    db_session.refresh(install)

    return InstallRead.model_validate(install)


############################################################################################################
# Steps
############################################################################################################


# Install Default roles
def install_default_elements(db_session: Session) -> bool:
    """ """
    # remove all default roles
    statement = select(Role).where(Role.role_type == RoleTypeEnum.TYPE_GLOBAL)
    roles = db_session.exec(statement).all()

    # First, delete UserOrganization entries that reference the roles
    for role in roles:
        statement_user_orgs = select(UserOrganization).where(
            UserOrganization.role_id == role.id
        )
        user_orgs = db_session.exec(statement_user_orgs).all()
        for user_org in user_orgs:
            db_session.delete(user_org)
        db_session.commit()

    # Now, delete the roles
    for role in roles:
        db_session.delete(role)

    db_session.commit()
    db_session.expire_all()  # <-- clear session state

    # Check if default roles already exist
    statement = select(Role).where(Role.role_type == RoleTypeEnum.TYPE_GLOBAL)
    roles = db_session.exec(statement).all()

    if roles and len(roles) == 3:
        raise HTTPException(
            status_code=409,
            detail="Default roles already exist",
        )

    # Create rights as dictionaries directly to avoid JSON serialization issues with psycopg3
    admin_rights = Rights(
        courses=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        users=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        usergroups=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        collections=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        organizations=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        coursechapters=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        activities=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
    ).model_dump()

    maintainer_rights = Rights(
        courses=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        users=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        usergroups=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        collections=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        organizations=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        coursechapters=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
        activities=Permission(
            action_create=True,
            action_read=True,
            action_update=True,
            action_delete=True,
        ),
    ).model_dump()

    user_rights = Rights(
        courses=Permission(
            action_create=False,
            action_read=True,
            action_update=False,
            action_delete=False,
        ),
        users=Permission(
            action_create=True,
            action_read=True,
            action_update=False,
            action_delete=False,
        ),
        usergroups=Permission(
            action_create=False,
            action_read=True,
            action_update=False,
            action_delete=False,
        ),
        collections=Permission(
            action_create=False,
            action_read=True,
            action_update=False,
            action_delete=False,
        ),
        organizations=Permission(
            action_create=False,
            action_read=True,
            action_update=False,
            action_delete=False,
        ),
        coursechapters=Permission(
            action_create=False,
            action_read=True,
            action_update=False,
            action_delete=False,
        ),
        activities=Permission(
            action_create=False,
            action_read=True,
            action_update=False,
            action_delete=False,
        ),
    ).model_dump()

    # Create default roles with pre-serialized rights
    role_global_admin = Role(
        name="Admin",
        description="Standard Admin Role",
        id=1,
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_admin",
        rights=admin_rights,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    role_global_maintainer = Role(
        name="Maintainer",
        description="Standard Maintainer Role",
        id=2,
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_maintainer",
        rights=maintainer_rights,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    role_global_user = Role(
        name="User",
        description="Standard User Role",
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_user",
        id=3,
        rights=user_rights,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    # Insert roles in DB
    db_session.add(role_global_admin)
    db_session.add(role_global_maintainer)
    db_session.add(role_global_user)

    # commit changes
    db_session.commit()

    # refresh roles
    db_session.refresh(role_global_admin)

    return True


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


def install_create_organization_user(
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
            detail="Username already exists",
        )

    # Email
    statement = select(User).where(User.email == user.email)
    result = db_session.exec(statement)

    if result.first():
        raise HTTPException(
            status_code=409,
            detail="Email already exists",
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

    # Link user and organization
    user_organization = UserOrganization(
        user_id=user.id if user.id else 0,
        org_id=org_id or 0,
        role_id=1,
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    db_session.add(user_organization)
    db_session.commit()
    db_session.refresh(user_organization)

    return UserRead.model_validate(user)
