"""
Compatibility layer for migrating from legacy RBAC to new permission system.

This module provides functions that match the legacy RBAC signatures but use
the new PermissionChecker under the hood. This allows gradual migration without
breaking existing code.

Once all code is migrated to use PermissionChecker directly, this module can be removed.
"""

from typing import Literal

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select

from src.db.permissions.enums import Action, ResourceType
from src.db.resource_authors import (
    ResourceAuthor,
    ResourceAuthorshipEnum,
    ResourceAuthorshipStatusEnum,
)
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.security.rbac.checker import PermissionChecker
from src.security.rbac.context import PermissionContext

# --- Action Mapping ---

_ACTION_MAP: dict[str, Action] = {
    "create": Action.CREATE,
    "read": Action.READ,
    "update": Action.UPDATE,
    "delete": Action.DELETE,
}


def _map_action(action: str) -> Action:
    """Map string action to Action enum."""
    return _ACTION_MAP.get(action.lower(), Action.READ)


def _infer_resource_type(element_uuid: str) -> ResourceType:
    """
    Infer resource type from UUID prefix or naming pattern.

    Legacy code used various UUID patterns:
    - course_x, course_uuid -> COURSE
    - activity_x, activity_uuid -> ACTIVITY
    - chapter_x -> CHAPTER
    - collection_x -> COLLECTION
    - user_x -> USER
    - usergroup_x -> USERGROUP
    - org_x -> ORGANIZATION
    """
    el = element_uuid.lower()

    if el.startswith("course") or "course" in el:
        return ResourceType.COURSE
    if el.startswith("activity") or "activity" in el:
        return ResourceType.ACTIVITY
    if el.startswith("chapter"):
        return ResourceType.CHAPTER
    if el.startswith("collection"):
        return ResourceType.COLLECTION
    if el.startswith("user"):
        return ResourceType.USER
    if el.startswith("usergroup"):
        return ResourceType.USERGROUP
    if el.startswith("org"):
        return ResourceType.ORGANIZATION
    if el.startswith("assignment"):
        return ResourceType.ASSIGNMENT
    if el.startswith("submission"):
        return ResourceType.SUBMISSION
    if el.startswith("exam"):
        return ResourceType.EXAM

    # Default to course for backwards compatibility
    return ResourceType.COURSE


# --- Compatibility Functions ---


async def authorization_verify_if_user_is_anon(user_id: int) -> None:
    """
    Verify user is not anonymous.

    Legacy signature compatibility - raises HTTPException if anonymous.
    """
    if user_id == 0:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must be logged in to perform this action",
        )


async def authorization_verify_if_element_is_public(
    request: Request,
    element_uuid: str,
    action: Literal["read"],
    db_session: Session,
) -> bool:
    """
    Check if element is public (for anonymous read access).

    Legacy signature compatibility.
    """
    from src.db.collections import Collection
    from src.db.courses.courses import Course

    resource_type = _infer_resource_type(element_uuid)

    if resource_type == ResourceType.COURSE and action == "read":
        statement = select(Course).where(
            Course.public, Course.course_uuid == element_uuid
        )
        course = db_session.exec(statement).first()
        if course:
            return True

    if resource_type == ResourceType.COLLECTION and action == "read":
        statement = select(Collection).where(
            Collection.public, Collection.collection_uuid == element_uuid
        )
        collection = db_session.exec(statement).first()
        if collection:
            return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User rights: You don't have the right to perform this action",
    )


async def authorization_verify_if_user_is_author(
    request: Request,
    user_id: int,
    action: Literal["read", "update", "delete", "create"],
    element_uuid: str,
    db_session: Session,
) -> bool:
    """
    Check if user is author of the resource.

    Legacy signature compatibility.
    """
    if action == "create":
        return True  # Allow creation if user is authenticated

    if action in ["update", "delete", "read"]:
        statement = select(ResourceAuthor).where(
            ResourceAuthor.resource_uuid == element_uuid
        )
        resource_author = db_session.exec(statement).first()

        if (
            resource_author
            and resource_author.user_id == int(user_id)
            and (
                resource_author.authorship
                in (
                    ResourceAuthorshipEnum.CREATOR,
                    ResourceAuthorshipEnum.MAINTAINER,
                    ResourceAuthorshipEnum.CONTRIBUTOR,
                )
                and resource_author.authorship_status
                == ResourceAuthorshipStatusEnum.ACTIVE
            )
        ):
            return True

    return False


async def authorization_verify_based_on_roles(
    request: Request,
    user_id: int,
    action: Literal["read", "update", "delete", "create"],
    element_uuid: str,
    db_session: Session,
) -> bool:
    """
    Check permissions based on user roles using new RBAC system.

    Legacy signature compatibility.
    """
    from src.db.users import User

    # Get user object
    user = db_session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        return False

    # Create PublicUser for checker
    public_user = PublicUser.model_validate(user)

    checker = PermissionChecker(db_session)
    resource_type = _infer_resource_type(element_uuid)
    mapped_action = _map_action(action)

    # Extract resource ID if it's a real UUID (not a placeholder like "course_x")
    resource_id = element_uuid if not element_uuid.endswith("_x") else None

    return checker.check(
        user=public_user,
        action=mapped_action,
        resource=resource_type,
        resource_id=resource_id,
    )


async def authorization_verify_based_on_roles_and_authorship(
    request: Request,
    user_id: int,
    action: Literal["read", "update", "delete", "create"],
    element_uuid: str,
    db_session: Session,
) -> bool:
    """
    Check permissions based on roles AND authorship using new RBAC system.

    Legacy signature compatibility - raises HTTPException if denied.
    """
    # Check authorship first
    is_author = await authorization_verify_if_user_is_author(
        request, user_id, action, element_uuid, db_session
    )
    if is_author:
        return True

    # Check role-based permissions
    is_role_allowed = await authorization_verify_based_on_roles(
        request, user_id, action, element_uuid, db_session
    )
    if is_role_allowed:
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User rights (roles & authorship): You don't have the right to perform this action",
    )


async def authorization_verify_based_on_org_admin_status(
    request: Request,
    user_id: int,
    action: Literal["read", "update", "delete", "create"],
    element_uuid: str,
    db_session: Session,
) -> bool:
    """
    Check if user has admin status in any organization.

    Legacy signature compatibility.
    """
    from src.db.users import User
    from src.services.permissions.role_service import RoleService

    # Get user
    user = db_session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        return False

    PublicUser.model_validate(user)

    # Use RoleService to check for admin roles
    role_service = RoleService(db_session)
    user_roles = role_service.get_user_roles(user_id)

    # Check if user has any admin-level roles (admin, superadmin)
    admin_role_names = {"admin", "superadmin", "org_admin"}
    return any(role.name.lower() in admin_role_names for role in user_roles)


# --- Service-Level RBAC Functions ---


async def rbac_check_generic(
    request: Request,
    resource_uuid: str,
    current_user: PublicUser | AnonymousUser | InternalUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
    resource_type: ResourceType | None = None,
) -> bool | None:
    """
    Generic RBAC check that can be used by any service.

    This replaces the various per-service rbac_check functions.

    Args:
        request: FastAPI request
        resource_uuid: UUID of the resource
        current_user: Current user
        action: Action to perform
        db_session: Database session
        resource_type: Optional explicit resource type (inferred from UUID if not provided)

    Returns:
        True if allowed, None for neutral (continue with other checks)

    Raises:
        HTTPException: If access is denied
    """
    # Internal users bypass RBAC
    if isinstance(current_user, InternalUser):
        return True

    # Anonymous users handling
    if current_user.id == 0:
        if action == "read":
            # Anonymous can read public resources
            try:
                return await authorization_verify_if_element_is_public(
                    request, resource_uuid, "read", db_session
                )
            except HTTPException:
                # Not public, deny access
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )
        else:
            # Non-read actions require authentication
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
            )

    # Authenticated user - use new RBAC checker
    checker = PermissionChecker(db_session)
    inferred_type = resource_type or _infer_resource_type(resource_uuid)
    mapped_action = _map_action(action)

    # Build context from request
    context = PermissionContext(
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    # Resource ID (exclude placeholders)
    resource_id = resource_uuid if not resource_uuid.endswith("_x") else None

    # Use require to throw on failure
    checker.require(
        user=current_user,
        action=mapped_action,
        resource=inferred_type,
        resource_id=resource_id,
        context=context,
    )

    return True


# --- Courses-Specific Compatibility ---


async def courses_rbac_check_compat(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
    require_course_ownership: bool = False,
) -> bool:
    """
    Compatibility layer for courses_rbac_check.

    This function maintains the same signature as the original courses_rbac_check
    but uses the new RBAC system under the hood.
    """
    checker = PermissionChecker(db_session)
    _map_action(action)

    # Handle anonymous users
    if current_user.id == 0:
        if action == "read":
            return await authorization_verify_if_element_is_public(
                request, course_uuid, "read", db_session
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    # Course creation (course_x placeholder)
    if action == "create" and course_uuid == "course_x":
        # Check if user has course:create permission
        if checker.check(current_user, Action.CREATE, ResourceType.COURSE):
            return True
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You must have instructor role or higher to create courses",
        )

    # For content creation/update/delete, check course ownership
    if require_course_ownership or action in ["create", "update", "delete"]:
        # Check course ownership
        is_owner = await authorization_verify_if_user_is_author(
            request, current_user.id, action, course_uuid, db_session
        )

        # Check admin status
        is_admin = await authorization_verify_based_on_org_admin_status(
            request, current_user.id, action, course_uuid, db_session
        )

        if not (is_owner or is_admin):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You must be the course owner or have admin role to {action} in this course",
            )
        return True

    # Default: check role-based permissions
    return await authorization_verify_based_on_roles_and_authorship(
        request, current_user.id, action, course_uuid, db_session
    )
