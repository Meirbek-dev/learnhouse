"""
Service for enriching API responses with permission metadata.

This service provides utilities to add permission information to response models,
allowing the frontend to determine what actions are available to the user.
"""

from typing import Any

from sqlmodel import Session

from src.db.courses.courses import Course, CourseRead, FullCourseRead
from src.db.courses.enhanced_responses import (
    CourseReadWithPermissions,
    FullCourseReadWithPermissions,
)
from src.db.permissions import Action, ResourceType
from src.db.users import PublicUser
from src.services.permissions.unified_permission_service import UnifiedPermissionService


async def enrich_course_with_permissions(
    course: CourseRead | FullCourseRead | Course,
    current_user: PublicUser,
    db_session: Session,
    permission_service: UnifiedPermissionService,
) -> CourseReadWithPermissions | FullCourseReadWithPermissions:
    """
    Enrich a course response with permission metadata.

    Args:
        course: The course to enrich (Read model or DB model)
        current_user: The authenticated user
        db_session: Database session
        permission_service: Unified permission service instance

    Returns:
        Course response with permission metadata
    """
    # Convert to dict to work with both CourseRead and Course models
    if isinstance(course, (CourseRead, FullCourseRead)):
        course_dict = course.model_dump()
    else:
        # SQLModel instance
        course_dict = course.model_dump()

    course_id = course_dict.get("id")

    # Determine if user is owner/contributor
    is_owner = False
    is_contributor = False

    # Check authors list if available
    authors = course_dict.get("authors", [])
    if authors:
        user_author = next(
            (a for a in authors if a.get("id") == current_user.id),
            None
        )
        if user_author:
            # User is in authors list
            role = user_author.get("role", "")
            is_owner = role.lower() in ["owner", "author", "creator"]
            is_contributor = not is_owner  # Contributor but not owner

    # Check permissions
    can_update = await permission_service.check_resource_permission(
        user_id=current_user.id,
        action=Action.UPDATE,
        resource_type=ResourceType.COURSE,
        resource_id=course_id,
    )

    can_delete = await permission_service.check_resource_permission(
        user_id=current_user.id,
        action=Action.DELETE,
        resource_type=ResourceType.COURSE,
        resource_id=course_id,
    )

    can_publish = await permission_service.check_permission(
        user_id=current_user.id,
        action=Action.PUBLISH,
        resource_type=ResourceType.COURSE,
    )

    can_manage_contributors = await permission_service.check_resource_permission(
        user_id=current_user.id,
        action=Action.MANAGE,
        resource_type=ResourceType.COURSE,
        resource_id=course_id,
    )

    # Build available actions list
    available_actions = []
    if can_update:
        available_actions.append("update")
    if can_delete:
        available_actions.append("delete")
    if can_publish:
        available_actions.append("publish")
    if can_manage_contributors:
        available_actions.append("manage_contributors")

    # Add read permission (if they can see it, they can read it)
    available_actions.append("read")

    # Create enriched response
    enriched_data = {
        **course_dict,
        "can_update": can_update,
        "can_delete": can_delete,
        "can_publish": can_publish,
        "can_manage_contributors": can_manage_contributors,
        "is_owner": is_owner,
        "is_contributor": is_contributor,
        "available_actions": available_actions,
    }

    # Return appropriate model type
    if isinstance(course, FullCourseRead) or "chapters" in course_dict:
        return FullCourseReadWithPermissions(**enriched_data)
    else:
        return CourseReadWithPermissions(**enriched_data)


async def enrich_courses_with_permissions(
    courses: list[CourseRead | Course],
    current_user: PublicUser,
    db_session: Session,
    permission_service: UnifiedPermissionService,
) -> list[CourseReadWithPermissions]:
    """
    Enrich multiple courses with permission metadata.

    This is more efficient than calling enrich_course_with_permissions
    multiple times as it can batch permission checks.

    Args:
        courses: List of courses to enrich
        current_user: The authenticated user
        db_session: Database session
        permission_service: Unified permission service instance

    Returns:
        List of courses with permission metadata
    """
    if not courses:
        return []

    enriched_courses = []

    for course in courses:
        enriched = await enrich_course_with_permissions(
            course, current_user, db_session, permission_service
        )
        enriched_courses.append(enriched)

    return enriched_courses


def get_available_actions(
    can_update: bool,
    can_delete: bool,
    can_publish: bool,
    can_manage: bool,
    can_read: bool = True,
) -> list[str]:
    """
    Helper function to build available actions list.

    Args:
        can_update: Can update permission
        can_delete: Can delete permission
        can_publish: Can publish permission
        can_manage: Can manage permission
        can_read: Can read permission (default True)

    Returns:
        List of available action strings
    """
    actions = []

    if can_read:
        actions.append("read")
    if can_update:
        actions.append("update")
    if can_delete:
        actions.append("delete")
    if can_publish:
        actions.append("publish")
    if can_manage:
        actions.append("manage")

    return actions
