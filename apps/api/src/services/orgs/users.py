import logging
from datetime import UTC, datetime, timedelta

import orjson
from fastapi import HTTPException, Request
from sqlmodel import Session, select

from config.config import get_platform_config
from src.db.organizations import (
    Organization,
    OrganizationRead,
    OrganizationUser,
    PaginatedOrganizationUsers,
    rebuild_organization_models,
)
from src.db.permissions import Role, RoleRead, UserPermission
from src.db.permissions.constants import ADMIN_ROLE_SLUGS
from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, PublicUser, User, UserRead
from src.services.cache import redis_client
from src.services.cache.redis_client import delete_keys, get_json, set_json
from src.services.orgs.invites import send_invite_email
from src.services.permissions import get_permission_service

# Rebuild organization models to resolve forward references
rebuild_organization_models()


async def get_organization_users(
    request: Request,
    org_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
    page: int = 1,
    per_page: int = 20,
) -> PaginatedOrganizationUsers:
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
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Build base query joining via UserPermission (new schema)
    # Get distinct users who have any permission in this org
    base_statement = (
        select(User)
        .join(UserPermission, UserPermission.user_id == User.id)
        .where(UserPermission.org_id == org_id_int)
        .distinct()
    )

    # Get total count
    all_users = db_session.exec(base_statement).all()
    total = len(all_users)

    # Apply pagination
    offset = (page - 1) * per_page
    paginated_statement = base_statement.offset(offset).limit(per_page)
    users = db_session.exec(paginated_statement).all()

    org_users_list = []

    permission_service = get_permission_service(db_session)

    for user in users:
        # Get user's roles via new PermissionService
        user_roles = permission_service.get_user_roles(
            user_id=user.id, org_id=org_id_int
        )

        if not user_roles:
            logging.warning(f"No roles found for user {user.id} in org {org_id_int}")
            # skip this user
            continue

        # Use the first role (primary role)
        role = user_roles[0]

        user_read = UserRead.model_validate(user)
        role_read = RoleRead.model_validate(role)

        org_user = OrganizationUser(
            user=user_read,
            role=role_read,
        )

        org_users_list.append(org_user)

    total_pages = (total + per_page - 1) // per_page if total > 0 else 1

    return PaginatedOrganizationUsers(
        users=org_users_list,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


async def remove_user_from_org(
    request: Request,
    org_id: int,
    user_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
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
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Check if user has any permissions in this org (i.e., is a member)
    statement = select(UserPermission).where(
        UserPermission.user_id == user_id, UserPermission.org_id == org.id
    )
    result = db_session.exec(statement)

    user_perms = result.all()

    if not user_perms:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Check if user is the last admin (lookup admin role by configured admin slugs)
    admin_role = db_session.exec(
        select(Role).where(Role.slug.in_(list(ADMIN_ROLE_SLUGS)))
    ).first()
    admin_role_id = admin_role.id if admin_role else 1

    # Count admins by checking UserPermissions with granted_via_role_id = admin_role_id
    statement = select(UserPermission).where(
        UserPermission.org_id == org.id,
        UserPermission.granted_via_role_id == admin_role_id
    ).distinct()
    result = db_session.exec(statement)
    admin_perms = result.all()

    # Get unique admin user IDs
    admin_user_ids = {perm.user_id for perm in admin_perms}

    if len(admin_user_ids) == 1 and user_id in admin_user_ids:
        raise HTTPException(
            status_code=400,
            detail="You can't remove the last admin of the organization",
        )

    # Delete all user's permissions in this org
    for perm in user_perms:
        db_session.delete(perm)
    db_session.commit()

    return {"detail": "User removed from org"}


async def update_user_role(
    request: Request,
    org_id: int,
    user_id: int,
    role_uuid: str,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
):
    # Convert org_id and user_id to int for proper type matching with database
    org_id_int = int(org_id)
    user_id_int = int(user_id)

    # normalize incoming role identifier to slug (handle legacy 'role_*' names)
    slug = role_uuid.split("_")[-1] if isinstance(role_uuid, str) and role_uuid.startswith("role_") else role_uuid

    # find role by slug
    statement = select(Role).where(Role.slug == slug)
    result = db_session.exec(statement)

    role = result.first()

    if not role:
        raise HTTPException(
            status_code=404,
            detail="Role not found",
        )

    role_id = role.id

    statement = select(Organization).where(Organization.id == org_id_int)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Check if user is the last admin and if the new role is not admin
    # find any admin role by configured admin slugs
    admin_role = db_session.exec(
        select(Role).where(Role.slug.in_(list(ADMIN_ROLE_SLUGS)))
    ).first()
    admin_role_id = admin_role.id if admin_role else 1

    # Count admins by checking UserPermissions with granted_via_role_id = admin_role_id
    statement = select(UserPermission).where(
        UserPermission.org_id == org.id,
        UserPermission.granted_via_role_id == admin_role_id
    ).distinct()
    result = db_session.exec(statement)
    admin_perms = result.all()

    # Get unique admin user IDs
    admin_user_ids = {perm.user_id for perm in admin_perms}

    if not admin_user_ids:
        raise HTTPException(
            status_code=400,
            detail="There is no admin in the organization",
        )

    if (
        len(admin_user_ids) == 1
        and user_id_int in admin_user_ids
        and slug not in ADMIN_ROLE_SLUGS
    ):
        raise HTTPException(
            status_code=400,
            detail="Organization must have at least one admin",
        )

    # Check if user has any permissions in this org
    statement = select(UserPermission).where(
        UserPermission.user_id == user_id_int, UserPermission.org_id == org.id
    )
    result = db_session.exec(statement)

    user_perms = result.all()

    if not user_perms:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Remove old role and assign new role using PermissionService
    if role_id is not None:
        # Get current role to remove
        current_role_ids = {perm.granted_via_role_id for perm in user_perms if perm.granted_via_role_id}

        # Remove all current role-based permissions
        for role_id_to_remove in current_role_ids:
            if role_id_to_remove:
                permission_service.remove_role(
                    user_id=user_id_int, role_id=role_id_to_remove, org_id=org.id
                )

        # Assign new role
        permission_service.assign_role(
            user_id=user_id_int, role_id=role_id, org_id=org.id
        )

    db_session.commit()

    return {"detail": "User role updated"}


async def invite_batch_users(
    request: Request,
    org_id: int,
    emails: str,
    invite_code_uuid: str,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
):
    # Redis init
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # get User sender
    statement = select(User).where(User.id == current_user.id)
    user = db_session.exec(statement).first()

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.CREATE,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Connect to Redis (use cached client)
    r = redis_client.get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )

    invite_list = emails.split(",")

    # invitations expire after 60 days
    ttl = int(timedelta(days=60).total_seconds())

    for email in invite_list:
        email = email.strip()

        # Check if user is already invited
        invited_user = get_json(f"invited_user:{email}:org:{org.org_uuid}")

        if invited_user:
            logging.error(f"User {email} already invited")
            # skip this user
            continue

        org = OrganizationRead.model_validate(org)
        user = UserRead.model_validate(user)

        isEmailSent = send_invite_email(
            org,
            invite_code_uuid,
            user,
            email,
        )

        invited_user_object = {
            "email": email,
            "org_id": org.id,
            "invite_code_uuid": invite_code_uuid,
            "pending": True,
            "email_sent": isEmailSent,
            "expires": ttl,
            "created_at": datetime.now().isoformat(),
            "created_by": current_user.user_uuid,
        }

        invited_user = set_json(
            f"invited_user:{email}:org:{org.org_uuid}",
            invited_user_object,
            ttl,
        )

    return {"detail": "Users invited"}


async def get_list_of_invited_users(
    request: Request,
    org_id: int,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
):
    # Redis init
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.READ,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Connect to Redis (use cached client)
    r = redis_client.get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )

    invited_users = r.keys(f"invited_user:*:org:{org.org_uuid}")

    invited_users_list = []

    for user in invited_users:
        key = user.decode("utf-8") if isinstance(user, (bytes, bytearray)) else user
        invited_user = get_json(key)
        if invited_user:
            invited_users_list.append(invited_user)

    return invited_users_list


async def remove_invited_user(
    request: Request,
    org_id: int,
    email: str,
    db_session: Session,
    current_user: PublicUser | AnonymousUser,
):
    # Redis init
    PLATFORM_CONFIG = get_platform_config()
    redis_conn_string = PLATFORM_CONFIG.redis_config.redis_connection_string

    if not redis_conn_string:
        raise HTTPException(
            status_code=500,
            detail="Redis connection string not found",
        )

    statement = select(Organization).where(Organization.id == org_id)
    result = db_session.exec(statement)

    org = result.first()

    if not org:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # RBAC check
    permission_service = get_permission_service(db_session)

    await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.ORGANIZATION,
        resource_id=org.org_uuid,
    )

    # Connect to Redis (use cached client)
    r = redis_client.get_redis_client()

    if not r:
        raise HTTPException(
            status_code=500,
            detail="Could not connect to Redis",
        )

    invited_user = get_json(f"invited_user:{email}:org:{org.org_uuid}")

    if not invited_user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    delete_keys(f"invited_user:{email}:org:{org.org_uuid}")

    return {"detail": "User removed"}
