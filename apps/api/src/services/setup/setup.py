from datetime import datetime

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
from src.db.roles import (
    DashboardPermission,
    Permission,
    PermissionsWithOwn,
    Rights,
    Role,
    RoleTypeEnum,
)
from src.db.user_organizations import UserOrganization
from src.db.users import User, UserCreate, UserRead
from src.security.security import security_hash_password


# Install Default roles
def install_default_elements(db_session: Session) -> bool:
    """ """
    # Ensure default global roles exist. Do not delete existing roles because
    # they may be referenced by `UserOrganization` rows (foreign key).
    # Create missing default roles idempotently by `role_uuid`.
    statement = select(Role).where(Role.role_type == RoleTypeEnum.TYPE_GLOBAL)
    existing_roles = db_session.exec(statement).all()

    # If all four default roles already exist, nothing to do
    if existing_roles and len(existing_roles) >= 4:
        return True

    # Create default roles
    role_global_admin = Role(
        name="Админ",
        description="Полный контроль над платформой",
        id=1,
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_admin",
        rights=Rights(
            courses=PermissionsWithOwn(
                action_create=True,
                action_read=True,
                action_read_own=True,
                action_update=True,
                action_update_own=True,
                action_delete=True,
                action_delete_own=True,
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
            roles=Permission(
                action_create=True,
                action_read=True,
                action_update=True,
                action_delete=True,
            ),
            dashboard=DashboardPermission(
                action_access=True,
            ),
        ),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    role_global_maintainer = Role(
        name="Maintainer",
        description="Менеджер среднего звена, широкие полномочия, но нет контроля над платформой",
        id=2,
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_maintainer",
        rights=Rights(
            courses=PermissionsWithOwn(
                action_create=True,
                action_read=True,
                action_read_own=True,
                action_update=True,
                action_update_own=True,
                action_delete=True,
                action_delete_own=True,
            ),
            users=Permission(
                action_create=True,
                action_read=True,
                action_update=True,
                action_delete=False,
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
                action_create=False,
                action_read=True,
                action_update=False,
                action_delete=False,
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
            roles=Permission(
                action_create=False,
                action_read=True,
                action_update=False,
                action_delete=False,
            ),
            dashboard=DashboardPermission(
                action_access=True,
            ),
        ),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    role_global_instructor = Role(
        name="Преподаватель",
        description="Может управлять своим собственным контентом",
        id=3,
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_instructor",
        rights=Rights(
            courses=PermissionsWithOwn(
                action_create=True,
                action_read=True,
                action_read_own=True,
                action_update=False,
                action_update_own=True,
                action_delete=False,
                action_delete_own=True,
            ),
            users=Permission(
                action_create=False,
                action_read=False,
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
                action_create=True,
                action_read=True,
                action_update=False,
                action_delete=False,
            ),
            organizations=Permission(
                action_create=False,
                action_read=False,
                action_update=False,
                action_delete=False,
            ),
            coursechapters=Permission(
                action_create=True,
                action_read=True,
                action_update=False,
                action_delete=False,
            ),
            activities=Permission(
                action_create=True,
                action_read=True,
                action_update=False,
                action_delete=False,
            ),
            roles=Permission(
                action_create=False,
                action_read=False,
                action_update=False,
                action_delete=False,
            ),
            dashboard=DashboardPermission(
                action_access=True,
            ),
        ),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    role_global_user = Role(
        name="Пользователь",
        description="Студент (только для чтения)",
        role_type=RoleTypeEnum.TYPE_GLOBAL,
        role_uuid="role_global_user",
        id=4,
        rights=Rights(
            courses=PermissionsWithOwn(
                action_create=False,
                action_read=True,
                action_read_own=True,
                action_update=False,
                action_update_own=False,
                action_delete=True,
                action_delete_own=True,
            ),
            users=Permission(
                action_create=False,
                action_read=False,
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
                action_read=False,
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
            roles=Permission(
                action_create=False,
                action_read=False,
                action_update=False,
                action_delete=False,
            ),
            dashboard=DashboardPermission(
                action_access=False,
            ),
        ),
        creation_date=str(datetime.now()),
        update_date=str(datetime.now()),
    )

    # Serialize rights to JSON
    role_global_admin.rights = role_global_admin.rights.dict()
    role_global_maintainer.rights = role_global_maintainer.rights.dict()
    role_global_instructor.rights = role_global_instructor.rights.dict()
    role_global_user.rights = role_global_user.rights.dict()

    # Insert roles in DB
    # Add each default role only if it doesn't already exist (by role_uuid)
    for default_role in (
        role_global_admin,
        role_global_maintainer,
        role_global_instructor,
        role_global_user,
    ):
        stmt = select(Role).where(Role.role_uuid == default_role.role_uuid)
        exists = db_session.exec(stmt).first()
        if not exists:
            # Avoid explicit id conflicts: let the DB assign the id if needed
            try:
                default_role.id = None
            except Exception:
                pass
            db_session.add(default_role)

    # commit changes
    db_session.commit()

    # refresh roles
    try:
        db_session.refresh(role_global_admin)
    except Exception:
        # If the admin role wasn't created because it already existed, ignore
        pass

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
