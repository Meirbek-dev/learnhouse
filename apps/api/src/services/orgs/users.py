import logging
from datetime import UTC, datetime, timedelta

import orjson
from fastapi import HTTPException, Request
from sqlmodel import Session, select
from src.security.rbac import PermissionChecker

from config.config import get_platform_config
from src.db.organizations import (
    Organization,
    OrganizationRead,
    OrganizationUser,
    PaginatedOrganizationUsers,
    rebuild_organization_models,
)
from src.db.permissions import RoleRead
from src.db.permission_enums import ADMIN_ROLE_SLUGS
from src.db.permissions import Role, UserRole
from src.db.users import AnonymousUser, PublicUser, User, UserRead
from src.services.cache import redis_client
from src.services.cache.redis_client import delete_keys, get_json, set_json

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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:read", org.id)

    # Build base query joining via UserRole
    # Get distinct users who have any role in this org
    base_statement = (
        select(User)
        .join(UserRole, UserRole.user_id == User.id)
        .where(UserRole.org_id == org_id_int)
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

    checker = PermissionChecker(db_session)

    for user in users:
        # Get user's roles via new PermissionChecker
        user_roles = checker.get_user_roles(user_id=user.id, org_id=org_id_int)

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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:delete", org.id)

    # Check if user has any roles in this org (i.e., is a member)
    statement = select(UserRole).where(
        UserRole.user_id == user_id, UserRole.org_id == org.id
    )
    result = db_session.exec(statement)

    user_roles = result.all()

    if not user_roles:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Check if user is the last admin (lookup admin role by configured admin slugs)
    admin_role = db_session.exec(
        select(Role).where(Role.slug.in_(list(ADMIN_ROLE_SLUGS)))
    ).first()
    admin_role_id = admin_role.id if admin_role else 1

    # Count admins by checking UserRole with role_id = admin_role_id
    statement = (
        select(UserRole)
        .where(UserRole.org_id == org.id, UserRole.role_id == admin_role_id)
        .distinct()
    )
    result = db_session.exec(statement)
    admin_roles = result.all()

    # Get unique admin user IDs
    admin_user_ids = {role.user_id for role in admin_roles}

    if len(admin_user_ids) == 1 and user_id in admin_user_ids:
        raise HTTPException(
            status_code=400,
            detail="You can't remove the last admin of the organization",
        )

    # Delete all user's roles in this org
    for role in user_roles:
        db_session.delete(role)
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

    # find role by slug
    statement = select(Role).where(Role.slug == role_uuid)
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
    checker = PermissionChecker(db_session)
    checker.require(current_user.id, "organization:update", org.id)

    # Check if user is the last admin and if the new role is not admin
    # find any admin role by configured admin slugs
    admin_role = db_session.exec(
        select(Role).where(Role.slug.in_(list(ADMIN_ROLE_SLUGS)))
    ).first()
    admin_role_id = admin_role.id if admin_role else 1

    # Count admins by checking UserRole with role_id = admin_role_id
    statement = (
        select(UserRole)
        .where(UserRole.org_id == org.id, UserRole.role_id == admin_role_id)
        .distinct()
    )
    result = db_session.exec(statement)
    admin_roles = result.all()

    # Get unique admin user IDs
    admin_user_ids = {role.user_id for role in admin_roles}

    if not admin_user_ids:
        raise HTTPException(
            status_code=400,
            detail="There is no admin in the organization",
        )

    if (
        len(admin_user_ids) == 1
        and user_id_int in admin_user_ids
        and role_uuid not in ADMIN_ROLE_SLUGS
    ):
        raise HTTPException(
            status_code=400,
            detail="Organization must have at least one admin",
        )

    # Check if user has any roles in this org
    statement = select(UserRole).where(
        UserRole.user_id == user_id_int, UserRole.org_id == org.id
    )
    result = db_session.exec(statement)

    user_roles = result.all()

    if not user_roles:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    # Remove old role and assign new role using PermissionChecker
    if role_id is not None:
        # Remove all current roles
        for ur in user_roles:
            db_session.delete(ur)
        db_session.flush()

        # Assign new role
        checker.assign_role(
            user_id=user_id_int, role_slug=role_uuid, org_id=int(org.id)
        )

    db_session.commit()

    return {"detail": "User role updated"}
