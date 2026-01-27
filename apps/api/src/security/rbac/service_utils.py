"""
Unified RBAC utilities for all services.

This module provides a consistent interface for permission checks across
all services using the new PermissionChecker system.
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
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.security.rbac.checker import PermissionChecker
from src.services.permissions.role_service import RoleService

# Action mapping from string to enum
ACTION_MAP: dict[str, Action] = {
    "create": Action.CREATE,
    "read": Action.READ,
    "update": Action.UPDATE,
    "delete": Action.DELETE,
}

# Resource type inference from UUID prefix
RESOURCE_PREFIX_MAP: dict[str, ResourceType] = {
    "course": ResourceType.COURSE,
    "courseupdate": ResourceType.COURSE,
    "chapter": ResourceType.CHAPTER,
    "activity": ResourceType.ACTIVITY,
    "user": ResourceType.USER,
    "org": ResourceType.ORGANIZATION,
    "role": ResourceType.ROLE,
    "collection": ResourceType.COLLECTION,
    "usergroup": ResourceType.USERGROUP,
    "certificate": ResourceType.CERTIFICATE,
    "trail": ResourceType.TRAIL,
    "assignment": ResourceType.ASSIGNMENT,
    "quiz": ResourceType.QUIZ,
}


def map_action(action: str) -> Action:
    """Map string action to Action enum."""
    return ACTION_MAP.get(action, Action.READ)


def infer_resource_type(resource_uuid: str) -> ResourceType:
    """Infer resource type from UUID prefix."""
    if not resource_uuid or resource_uuid == "":
        return ResourceType.ORGANIZATION

    prefix = resource_uuid.split("_")[0].lower() if "_" in resource_uuid else ""
    return RESOURCE_PREFIX_MAP.get(prefix, ResourceType.COURSE)


def is_resource_owner(
    db_session: Session,
    user_id: int,
    resource_uuid: str,
) -> bool:
    """Check if user is owner of a resource via ResourceAuthor table."""
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


def is_admin_or_maintainer(db_session: Session, user_id: int) -> bool:
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


def is_resource_public(
    db_session: Session,
    resource_uuid: str,
    resource_type: ResourceType | None = None,
) -> bool:
    """Check if a resource is public."""
    if resource_type is None:
        resource_type = infer_resource_type(resource_uuid)

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


def verify_not_anonymous(user_id: int) -> None:
    """Verify user is not anonymous, raise if they are."""
    if user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to perform this action",
        )


def check_is_resource_author(
    db_session: Session,
    user_id: int,
    resource_uuid: str,
) -> bool:
    """
    Check if user is an author (creator, maintainer, or contributor) of a resource.

    This is similar to is_resource_owner but returns False instead of raising on failure,
    making it suitable for conditional checks.
    """
    if user_id == 0:
        return False
    return is_resource_owner(db_session, user_id, resource_uuid)


async def rbac_check(
    request: Request,
    resource_uuid: str,
    current_user: PublicUser | AnonymousUser | InternalUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
    resource_type: ResourceType | None = None,
    require_ownership: bool = False,
    org_id: int | None = None,
) -> bool:
    """
    Generic RBAC check for any resource.

    Args:
        request: FastAPI request object
        resource_uuid: UUID of the resource
        current_user: Current user
        action: Action to perform
        db_session: Database session
        resource_type: Optional explicit resource type (inferred from UUID if not provided)
        require_ownership: If True, requires resource ownership for non-read actions
        org_id: Optional organization ID for org-scoped permissions

    Returns:
        True if authorized

    Raises:
        HTTPException: If access is denied
    """
    # Internal users bypass RBAC
    if isinstance(current_user, InternalUser):
        return True

    user_id = current_user.id if hasattr(current_user, "id") else 0
    is_anonymous = user_id == 0
    inferred_type = resource_type or infer_resource_type(resource_uuid)
    mapped_action = map_action(action)
    checker = PermissionChecker(db_session)

    # Handle read operations
    if action == "read":
        if is_anonymous:
            # Anonymous can read public resources
            if is_resource_public(db_session, resource_uuid, inferred_type):
                return True
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be logged in to access this resource",
            )
        # Authenticated read - check permission or ownership
        if is_resource_owner(db_session, user_id, resource_uuid):
            return True
        if is_admin_or_maintainer(db_session, user_id):
            return True
        if checker.check(
            current_user, mapped_action, inferred_type, resource_uuid, org_id
        ):
            return True
        # For courses, also check if public
        if is_resource_public(db_session, resource_uuid, inferred_type):
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to read this resource",
        )

    # Non-read actions require authentication
    verify_not_anonymous(user_id)

    # Check ownership if required or for update/delete actions
    if require_ownership or action in ("update", "delete"):
        is_owner = is_resource_owner(db_session, user_id, resource_uuid)
        is_admin = is_admin_or_maintainer(db_session, user_id)
        if is_owner or is_admin:
            return True
        if require_ownership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You must be the resource owner or have admin role to {action} this resource",
            )

    # Check general permission
    if checker.check(current_user, mapped_action, inferred_type, resource_uuid, org_id):
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"You don't have permission to {action} this resource",
    )


async def rbac_check_org(
    request: Request,
    org_uuid: str,
    current_user: PublicUser | AnonymousUser | InternalUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    RBAC check for organization resources.
    Organizations are readable by anyone, but write requires admin.
    """
    if isinstance(current_user, InternalUser):
        return True

    # Organizations are readable by anyone
    if action == "read":
        return True

    user_id = current_user.id if hasattr(current_user, "id") else 0
    verify_not_anonymous(user_id)

    # Check if user is admin for this org
    if is_admin_or_maintainer(db_session, user_id):
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You must be an organization admin to perform this action",
    )


async def rbac_check_user(
    request: Request,
    user_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    RBAC check for user resources.
    Users can create accounts and read/update their own data.
    """
    user_id = current_user.id if hasattr(current_user, "id") else 0

    if action in ("create", "read"):
        # Anyone can create an account or read (subject to other checks)
        return True

    verify_not_anonymous(user_id)

    # Users can update/delete their own data
    if current_user.user_uuid == user_uuid:
        return True

    # Admins can manage any user
    if is_admin_or_maintainer(db_session, user_id):
        return True

    checker = PermissionChecker(db_session)
    if checker.check(current_user, map_action(action), ResourceType.USER, user_uuid):
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have permission to perform this action on this user",
    )


async def rbac_check_role(
    request: Request,
    role_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> None:
    """RBAC check for role resources. Requires authentication and appropriate permissions."""
    user_id = current_user.id if hasattr(current_user, "id") else 0
    verify_not_anonymous(user_id)

    checker = PermissionChecker(db_session)
    if checker.check(current_user, map_action(action), ResourceType.ROLE, role_uuid):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have permission to manage roles",
    )


async def rbac_check_usergroup(
    request: Request,
    usergroup_uuid: str,
    current_user: PublicUser | AnonymousUser | InternalUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """RBAC check for usergroup resources."""
    if isinstance(current_user, InternalUser):
        return True

    user_id = current_user.id if hasattr(current_user, "id") else 0
    verify_not_anonymous(user_id)

    checker = PermissionChecker(db_session)
    if checker.check(
        current_user, map_action(action), ResourceType.USERGROUP, usergroup_uuid
    ):
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have permission to manage this user group",
    )


def has_instructor_role(db_session: Session, user_id: int) -> bool:
    """Check if user has instructor role."""
    if user_id == 0:
        return False
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)
    instructor_roles = {"instructor", "teacher", "professor"}
    return any(
        role.slug.lower() in instructor_roles or role.name.lower() in instructor_roles
        for role in user_roles
    ) or is_admin_or_maintainer(db_session, user_id)


def has_authenticated_user_role(db_session: Session, user_id: int) -> bool:
    """Check if user is authenticated with any role (basic user check)."""
    if user_id == 0:
        return False
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)
    return (
        len(user_roles) > 0 or True
    )  # All authenticated users are considered to have basic role


def check_user_permission(
    db_session: Session,
    user_id: int,
    action: Literal["create", "read", "update", "delete"],
    resource_uuid: str,
) -> bool:
    """
    Check if a user has permission for an action on a resource.

    This replaces authorization_verify_based_on_roles from the old RBAC system.
    Returns True if user has permission, False otherwise (does not raise).
    """
    if user_id == 0:
        return False

    # First check if user is resource owner/author
    if action in ("update", "delete", "read"):
        if is_resource_owner(db_session, user_id, resource_uuid):
            return True

    # Check if user has admin/maintainer role
    if is_admin_or_maintainer(db_session, user_id):
        return True

    # For read actions, also check instructor role
    if action == "read" and has_instructor_role(db_session, user_id):
        return True

    # For update actions (grading, etc), require instructor role
    if action == "update" and has_instructor_role(db_session, user_id):
        return True

    # Check through permission checker for more granular permissions
    resource_type = infer_resource_type(resource_uuid)
    checker = PermissionChecker(db_session)

    # Need to construct a minimal user object for the checker
    from src.db.users import User

    user = db_session.exec(select(User).where(User.id == user_id)).first()
    if user:
        public_user = PublicUser.model_validate(user)
        return checker.check(
            public_user, map_action(action), resource_type, resource_uuid
        )

    return False


# ---------------------------------------------------------------------------
# Course-specific RBAC functions (consolidated from courses_security.py)
# ---------------------------------------------------------------------------


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
    mapped_action = map_action(action)
    user_id = current_user.id if hasattr(current_user, "id") else 0
    is_anonymous = user_id == 0

    # READ operations
    if action == "read":
        if is_anonymous:
            # Anonymous users can only read public courses
            if is_resource_public(db_session, course_uuid, ResourceType.COURSE):
                return True
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be logged in to access this course",
            )

        # Authenticated user - check various access paths
        # 1. Check if course is public
        if is_resource_public(db_session, course_uuid, ResourceType.COURSE):
            return True

        # 2. Check if user is course owner/contributor
        if is_resource_owner(db_session, user_id, course_uuid):
            return True

        # 3. Check if user is admin/maintainer
        if is_admin_or_maintainer(db_session, user_id):
            return True

        # 4. Check if accessible via UserGroup membership
        from src.db.usergroup_resources import UserGroupResource
        from src.db.usergroup_user import UserGroupUser

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
        is_owner = is_resource_owner(db_session, user_id, course_uuid)
        is_admin = is_admin_or_maintainer(db_session, user_id)

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
        require_course_ownership=action != "read",
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
        require_course_ownership=action != "read",
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
        require_course_ownership=action != "read",
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
        require_course_ownership=action != "read",
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
    mapped_action = map_action(action)
    user_id = current_user.id if hasattr(current_user, "id") else 0
    is_anonymous = user_id == 0

    if action == "read":
        if is_anonymous:
            if is_resource_public(db_session, collection_uuid, ResourceType.COLLECTION):
                return True
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You must be logged in to access this collection",
            )
        if checker.check(
            current_user, mapped_action, ResourceType.COLLECTION, collection_uuid
        ):
            return True
        # Also allow if resource is public
        if is_resource_public(db_session, collection_uuid, ResourceType.COLLECTION):
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
