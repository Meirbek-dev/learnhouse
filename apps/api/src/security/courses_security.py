"""
SECURITY MODULE FOR COURSES RBAC SYSTEM (New Implementation)

This module provides unified RBAC checks for all courses-related operations
using the new PermissionChecker system.

Key Features:
- Uses PermissionChecker for all permission checks
- Resource ownership via ResourceAuthor table
- Admin/maintainer role escalation
- Anonymous user handling for public resources
"""

from typing import Literal

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select

from src.db.collections import Collection
from src.db.courses.courses import Course
from src.db.permissions.enums import Action, ResourceType
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.checker import PermissionChecker
from src.services.permissions.role_service import RoleService

# Action mapping from string to enum
_ACTION_MAP: dict[str, Action] = {
    "create": Action.CREATE,
    "read": Action.READ,
    "update": Action.UPDATE,
    "delete": Action.DELETE,
}


def _map_action(action: str) -> Action:
    """Map string action to Action enum."""
    return _ACTION_MAP.get(action, Action.READ)


def _is_course_owner(
    db_session: Session,
    user_id: int,
    resource_uuid: str,
) -> bool:
    """Check if user is owner of a course resource."""
    statement = select(ResourceAuthor).where(
        ResourceAuthor.resource_uuid == resource_uuid,
        ResourceAuthor.user_id == user_id,
    )
    resource_author = db_session.exec(statement).first()

    if not resource_author:
        return False

    return (
        resource_author.authorship
        in (
            ResourceAuthorshipEnum.CREATOR,
            ResourceAuthorshipEnum.MAINTAINER,
            ResourceAuthorshipEnum.CONTRIBUTOR,
        )
        and resource_author.authorship_status == ResourceAuthorshipStatusEnum.ACTIVE
    )


def _is_admin_or_maintainer(db_session: Session, user_id: int) -> bool:
    """Check if user has admin or maintainer role."""
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)
    admin_roles = {
        "admin",
        "superadmin",
        "org_admin",
        "maintainer",
        "super-admin",
        "org-admin",
    }
    return any(
        role.slug.lower() in admin_roles or role.name.lower() in admin_roles
        for role in user_roles
    )


def _is_resource_public(
    db_session: Session,
    resource_uuid: str,
    resource_type: ResourceType,
) -> bool:
    """Check if a resource is public."""
    if resource_type == ResourceType.COURSE:
        course = db_session.exec(
            select(Course).where(Course.course_uuid == resource_uuid)
        ).first()
        return course.public if course else False
    elif resource_type == ResourceType.COLLECTION:
        collection = db_session.exec(
            select(Collection).where(Collection.collection_uuid == resource_uuid)
        ).first()
        return collection.public if collection else False
    return False


async def courses_rbac_check(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
    require_course_ownership: bool = False,
) -> bool:
    """
    Unified RBAC check for courses-related operations.

    Args:
        request: FastAPI request object
        course_uuid: UUID of the course (or "course_x" for course creation)
        current_user: Current user (PublicUser or AnonymousUser)
        action: Action to perform (create, read, update, delete)
        db_session: Database session
        require_course_ownership: If True, requires course ownership for non-read actions

    Returns:
        bool: True if authorized

    Raises:
        HTTPException: 403 Forbidden if user lacks required permissions
        HTTPException: 401 Unauthorized if user is anonymous for non-read actions
    """
    checker = PermissionChecker(db_session)
    mapped_action = _map_action(action)
    user_id = current_user.id if hasattr(current_user, "id") else 0
    is_anonymous = user_id == 0

    # READ operations
    if action == "read":
        if is_anonymous:
            # Anonymous users can only read public courses
            if _is_resource_public(db_session, course_uuid, ResourceType.COURSE):
                return True
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be logged in to access this course",
            )

        # Authenticated user - check various access paths
        # 1. Check if course is public
        if _is_resource_public(db_session, course_uuid, ResourceType.COURSE):
            return True

        # 2. Check if user is course owner/contributor
        if _is_course_owner(db_session, user_id, course_uuid):
            return True

        # 3. Check if user is admin/maintainer
        if _is_admin_or_maintainer(db_session, user_id):
            return True

        # 4. Check if accessible via UserGroup membership
        from src.db.usergroups.usergroups import UserGroupResource, UserGroupUser

        # Check if course has UserGroup restrictions
        ugr_stmt = select(UserGroupResource).where(
            UserGroupResource.resource_uuid == course_uuid
        )
        ugr_result = db_session.exec(ugr_stmt).first()

        # If course has no UserGroup restrictions, any authenticated user can access
        if not ugr_result:
            return True

        # Check if user is member of a UserGroup that grants access
        member_stmt = (
            select(UserGroupUser)
            .join(
                UserGroupResource,
                UserGroupUser.usergroup_id == UserGroupResource.usergroup_id,
            )
            .where(
                UserGroupResource.resource_uuid == course_uuid,
                UserGroupUser.user_id == user_id,
            )
        )
        if db_session.exec(member_stmt).first():
            return True

        # No access path found
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this course",
        )

    # Non-read actions require authentication
    if is_anonymous:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to perform this action",
        )

    # Course creation (course_x placeholder)
    if action == "create" and course_uuid == "course_x":
        # Check if user has course create permission
        if checker.check(current_user, Action.CREATE, ResourceType.COURSE):
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must have instructor role or higher to create courses",
        )

    # For course content operations (require_course_ownership=True) or update/delete
    if require_course_ownership or action in ["update", "delete"]:
        is_owner = _is_course_owner(db_session, user_id, course_uuid)
        is_admin = _is_admin_or_maintainer(db_session, user_id)

        if is_owner or is_admin:
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You must be the course owner or have admin/maintainer role to {action} in this course",
        )

    # Default: check general permission
    if checker.check(current_user, mapped_action, ResourceType.COURSE, course_uuid):
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"You don't have permission to {action} this course",
    )


async def courses_rbac_check_with_course_lookup(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
    require_course_ownership: bool = False,
) -> Course:
    """RBAC check with course lookup - returns course if authorized."""
    statement = select(Course).where(Course.course_uuid == course_uuid)
    course = db_session.exec(statement).first()

    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    await courses_rbac_check(
        request, course_uuid, current_user, action, db_session, require_course_ownership
    )
    return course


async def courses_rbac_check_for_activities(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """RBAC check for activities - requires course ownership for non-read actions."""
    return await courses_rbac_check(
        request,
        course_uuid,
        current_user,
        action,
        db_session,
        require_course_ownership=True,
    )


async def courses_rbac_check_for_assignments(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """RBAC check for assignments - requires course ownership for non-read actions."""
    return await courses_rbac_check(
        request,
        course_uuid,
        current_user,
        action,
        db_session,
        require_course_ownership=True,
    )


async def courses_rbac_check_for_chapters(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """RBAC check for chapters - requires course ownership for non-read actions."""
    return await courses_rbac_check(
        request,
        course_uuid,
        current_user,
        action,
        db_session,
        require_course_ownership=True,
    )


async def courses_rbac_check_for_certifications(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """RBAC check for certifications - requires course ownership for non-read actions."""
    return await courses_rbac_check(
        request,
        course_uuid,
        current_user,
        action,
        db_session,
        require_course_ownership=True,
    )


async def courses_rbac_check_for_collections(
    request: Request,
    collection_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """RBAC check for collections."""
    checker = PermissionChecker(db_session)
    mapped_action = _map_action(action)
    user_id = current_user.id if hasattr(current_user, "id") else 0
    is_anonymous = user_id == 0

    if action == "read":
        if is_anonymous:
            if _is_resource_public(
                db_session, collection_uuid, ResourceType.COLLECTION
            ):
                return True
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be logged in to access this collection",
            )
        if checker.check(
            current_user, mapped_action, ResourceType.COLLECTION, collection_uuid
        ):
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to read this collection",
        )

    # Non-read requires authentication
    if is_anonymous:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to perform this action",
        )

    # Check permission
    if checker.check(
        current_user, mapped_action, ResourceType.COLLECTION, collection_uuid
    ):
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"You don't have permission to {action} this collection",
    )
