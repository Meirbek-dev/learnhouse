"""
RBAC Utility Functions

This module provides helper utilities for permission checking across all services.
All actual permission checking should use UnifiedPermissionService from src.services.permissions.

These are HELPER functions only - not full RBAC check implementations.
"""

from fastapi import HTTPException, status
from sqlmodel import Session, select

from src.db.collections import Collection
from src.db.courses.courses import Course
from src.db.permissions.constants import (
    ADMIN_OR_MAINTAINER_SLUGS,
    INSTRUCTOR_OR_HIGHER_SLUGS,
)
from src.db.permissions.enums import Action, ResourceType
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import AnonymousUser, InternalUser, PublicUser, User
from src.services.permissions.role_service import RoleService

# ===========================
# Resource Type Utilities
# ===========================


def infer_resource_type(resource_uuid: str) -> ResourceType | None:
    """
    Infer resource type from UUID prefix or database lookup.
    REMOVE IT
    DEPRECATED: This is a best-effort function. Prefer passing explicit resource_type.

    Args:
        resource_uuid: Resource UUID

    Returns:
        Inferred ResourceType or None if cannot determine
    """
    # Try common prefixes
    if resource_uuid.startswith("course_"):
        return ResourceType.COURSE
    if resource_uuid.startswith("collection_"):
        return ResourceType.COLLECTION
    if resource_uuid.startswith("org_"):
        return ResourceType.ORGANIZATION

    # Default to None - caller should handle
    return None


# ===========================
# User Type Utilities
# ===========================


def is_anonymous(user: PublicUser | AnonymousUser | InternalUser | None) -> bool:
    """
    Check if the user is anonymous (not authenticated).

    This is the standardized way to check for anonymous users.
    Use this instead of checking user.id == 0 or isinstance checks.

    Args:
        user: User object to check

    Returns:
        True if user is anonymous, False otherwise
    """
    if user is None:
        return True
    if isinstance(user, AnonymousUser):
        return True
    if isinstance(user, InternalUser):
        return False
    # PublicUser - check id
    return not hasattr(user, "id") or user.id == 0


def get_user_id(user: PublicUser | AnonymousUser | InternalUser | None) -> int:
    """
    Get user ID, returns 0 for anonymous users.

    Args:
        user: User object

    Returns:
        User ID, or 0 if anonymous/None
    """
    if user is None or isinstance(user, AnonymousUser):
        return 0
    return user.id if hasattr(user, "id") else 0


# ===========================
# Enum Mapping Utilities
# ===========================


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
    """
    Map string action to Action enum.

    Args:
        action: Action string ("create", "read", "update", "delete")

    Returns:
        Corresponding Action enum value
    """
    return ACTION_MAP.get(action, Action.READ)


# ===========================
# Resource Ownership Utilities
# ===========================


def is_resource_owner(
    db_session: Session,
    user_id: int,
    resource_uuid: str,
) -> bool:
    """
    Check if user is owner of a resource via ResourceAuthor table.

    Args:
        db_session: Database session
        user_id: User ID to check
        resource_uuid: Resource UUID

    Returns:
        True if user is an active creator/maintainer/contributor
    """
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


def check_is_resource_author(
    db_session: Session,
    user_id: int,
    resource_uuid: str,
) -> bool:
    """
    Check if user is an author (creator, maintainer, or contributor) of a resource.

    This is similar to is_resource_owner but returns False instead of raising on failure,
    making it suitable for conditional checks.

    Args:
        db_session: Database session
        user_id: User ID to check
        resource_uuid: Resource UUID

    Returns:
        True if user is an author, False otherwise
    """
    if user_id == 0:
        return False
    return is_resource_owner(db_session, user_id, resource_uuid)


# ===========================
# Role Utilities
# ===========================


def is_admin_or_maintainer(db_session: Session, user_id: int) -> bool:
    """
    Check if user has admin or maintainer role.

    Args:
        db_session: Database session
        user_id: User ID to check

    Returns:
        True if user has admin/maintainer role
    """
    if user_id == 0:
        return False
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)
    return any(
        ur.role and ur.role.slug in ADMIN_OR_MAINTAINER_SLUGS for ur in user_roles
    )


def has_instructor_role(db_session: Session, user_id: int) -> bool:
    """
    Check if user has instructor role or higher.

    Args:
        db_session: Database session
        user_id: User ID to check

    Returns:
        True if user has instructor role or higher
    """
    if user_id == 0:
        return False
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)
    return any(
        ur.role and ur.role.slug in INSTRUCTOR_OR_HIGHER_SLUGS for ur in user_roles
    )


def has_authenticated_user_role(db_session: Session, user_id: int) -> bool:
    """
    Check if user is authenticated with any role (basic user check).

    Args:
        db_session: Database session
        user_id: User ID to check

    Returns:
        True if user is authenticated
    """
    if user_id == 0:
        return False
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)
    return (
        len(user_roles) > 0 or True
    )  # All authenticated users are considered to have basic role


# ===========================
# Resource Public Status Utilities
# ===========================


def is_resource_public(
    db_session: Session,
    resource_uuid: str,
    resource_type: ResourceType | None = None,
) -> bool:
    """
    Check if a resource is public.

    Args:
        db_session: Database session
        resource_uuid: Resource UUID
        resource_type: Optional explicit resource type (inferred if not provided)

    Returns:
        True if resource is public
    """
    if resource_type is None:
        resource_type = infer_resource_type(resource_uuid)

    if resource_type == ResourceType.COURSE:
        course = db_session.exec(
            select(Course).where(Course.course_uuid == resource_uuid)
        ).first()
        return course.public if course else False
    if resource_type == ResourceType.COLLECTION:
        collection = db_session.exec(
            select(Collection).where(Collection.collection_uuid == resource_uuid)
        ).first()
        return collection.public if collection else False
    return False


# ===========================
# Verification Utilities
# ===========================


def verify_not_anonymous(user_id: int) -> None:
    """
    Verify user is not anonymous, raise if they are.

    Args:
        user_id: User ID to check

    Raises:
        HTTPException: 401 if user is anonymous
    """
    if user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="You must be logged in to perform this action",
        )
