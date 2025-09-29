from typing import Literal

from fastapi import HTTPException, Request, status
from sqlalchemy import null
from sqlmodel import Session, select

from src.db.collections import Collection
from src.db.courses.courses import Course
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.roles import Role
from src.db.user_organizations import UserOrganization
from src.security.rbac.utils import (
    check_course_permissions_with_own,
    check_element_type,
)


# Tested and working
async def authorization_verify_if_element_is_public(
    request,
    element_uuid: str,
    action: Literal["read"],
    db_session: Session,
) -> bool:
    element_nature = await check_element_type(element_uuid)
    # Verifies if the element is public
    if element_nature == ("courses") and action == "read":
        if element_nature == "courses":
            statement = select(Course).where(
                Course.public, Course.course_uuid == element_uuid
            )
            course = db_session.exec(statement).first()
            if course:
                return True
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User rights : You don't have the right to perform this action",
            )

    if element_nature == "collections" and action == "read":
        statement = select(Collection).where(
            Collection.public, Collection.collection_uuid == element_uuid
        )
        collection = db_session.exec(statement).first()
        if collection:
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User rights : You don't have the right to perform this action",
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User rights : You don't have the right to perform this action",
    )


# Tested and working
async def authorization_verify_if_user_is_author(
    request: Request,
    user_id: int,
    action: Literal["read", "update", "delete", "create"],
    element_uuid: str,
    db_session: Session,
):
    # For create action, we don't need to check existing resource
    if action == "create":
        return True  # Allow creation if user is authenticated

    if action in ["update", "delete", "read"]:
        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == element_uuid
        )
        resource_author = db_session.exec(statement).first()

        if resource_author:
            if resource_author.user_id == int(user_id):
                return bool(
                    (
                        resource_author.authorship
                        in (
                            ResourceAuthorshipEnum.CREATOR,
                            ResourceAuthorshipEnum.MAINTAINER,
                            ResourceAuthorshipEnum.CONTRIBUTOR,
                        )
                    )
                    and resource_author.authorship_status
                    == ResourceAuthorshipStatusEnum.ACTIVE
                )
            return False
        return False
    return False


# Tested and working
async def authorization_verify_based_on_roles(
    request: Request,
    user_id: int,
    action: Literal["read", "update", "delete", "create"],
    element_uuid: str,
    db_session: Session,
) -> bool:
    element_type = await check_element_type(element_uuid)

    # Get user roles bound to an organization and standard roles
    statement = (
        select(Role)
        .join(UserOrganization)
        .where((UserOrganization.org_id == Role.org_id) | (Role.org_id == null()))
        .where(UserOrganization.user_id == user_id)
    )

    user_roles_in_organization_and_standard_roles = db_session.exec(statement).all()

    # Check if user is the author of the resource for "own" permissions
    is_author = False
    if action in ["update", "delete", "read"]:
        is_author = await authorization_verify_if_user_is_author(
            request, user_id, action, element_uuid, db_session
        )

    # Check all roles until we find one that grants the permission
    for role in user_roles_in_organization_and_standard_roles:
        role = Role.model_validate(role)
        if role.rights:
            rights = role.rights
            element_rights = getattr(rights, element_type, None)
            if element_rights:
                # Special handling for courses with PermissionsWithOwn
                if element_type == "courses":
                    if await check_course_permissions_with_own(
                        element_rights, action, is_author
                    ):
                        return True
                # For non-course resources, only check general permissions
                # (regular Permission class no longer has "own" permissions)
                elif getattr(element_rights, f"action_{action}", False):
                    return True

    # If we get here, no role granted the permission
    return False


async def authorization_verify_based_on_org_admin_status(
    request: Request,
    user_id: int,
    action: Literal["read", "update", "delete", "create"],
    element_uuid: str,
    db_session: Session,
) -> bool:
    await check_element_type(element_uuid)

    # Get user roles bound to an organization and standard roles
    statement = (
        select(Role)
        .join(UserOrganization)
        .where((UserOrganization.org_id == Role.org_id) | (Role.org_id == null()))
        .where(UserOrganization.user_id == user_id)
    )

    user_roles_in_organization_and_standard_roles = db_session.exec(statement).all()

    # Check if user has admin role (role_id 1 or 2) in any organization
    for role in user_roles_in_organization_and_standard_roles:
        role = Role.model_validate(role)
        if role.id in [1, 2]:  # Assuming 1 and 2 are admin role IDs
            return True

    return False


# Tested and working
async def authorization_verify_based_on_roles_and_authorship(
    request: Request,
    user_id: int,
    action: Literal["read", "update", "delete", "create"],
    element_uuid: str,
    db_session: Session,
) -> bool:
    isAuthor = await authorization_verify_if_user_is_author(
        request, user_id, action, element_uuid, db_session
    )

    isRole = await authorization_verify_based_on_roles(
        request, user_id, action, element_uuid, db_session
    )

    if isAuthor or isRole:
        return True
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User rights (roles & authorship) : You don't have the right to perform this action",
    )


async def authorization_verify_if_user_is_anon(user_id: int) -> None:
    if user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You should be logged in to perform this action",
        )
