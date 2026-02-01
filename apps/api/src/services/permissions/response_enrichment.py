"""
Service for enriching API responses with permission metadata.

This service provides utilities to add permission information to response models,
allowing the frontend to determine what actions are available to the user.
"""

from typing import Any, TypeVar

from sqlmodel import Session

from src.db.collections import Collection, CollectionRead, CollectionReadWithPermissions
from src.db.courses.activities import (
    Activity,
    ActivityRead,
    ActivityReadWithPermissions,
)
from src.db.courses.courses import Course, CourseRead, FullCourseRead
from src.db.courses.discussions import (
    CourseDiscussion,
    CourseDiscussionRead,
    CourseDiscussionReadWithPermissions,
)
from src.db.courses.enhanced_responses import (
    CourseReadWithPermissions,
    FullCourseReadWithPermissions,
)
from src.db.permissions import Action, ResourceType
from src.db.users import PublicUser
from src.services.permissions.permission_service_consolidated import PermissionService

# Generic type for response models
T = TypeVar("T")


async def enrich_course_with_permissions(
    course: CourseRead | FullCourseRead | Course,
    current_user: PublicUser,
    db_session: Session,
    permission_service: PermissionService,
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
        user_author = next((a for a in authors if a.get("id") == current_user.id), None)
        if user_author:
            # User is in authors list
            role = user_author.get("role", "")
            is_owner = role.lower() in ["owner", "author", "creator"]
            is_contributor = not is_owner  # Contributor but not owner

    # Check permissions
    can_update = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.COURSE,
        resource_id=course_id,
        raise_on_deny=False,
    )

    can_delete = await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.COURSE,
        resource_id=course_id,
        raise_on_deny=False,
    )

    can_publish = await permission_service.check(
        user=current_user,
        action=Action.PUBLISH,
        resource=ResourceType.COURSE,
        raise_on_deny=False,
    )

    can_manage_contributors = await permission_service.check(
        user=current_user,
        action=Action.MANAGE,
        resource=ResourceType.COURSE,
        resource_id=course_id,
        raise_on_deny=False,
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
    return CourseReadWithPermissions(**enriched_data)


async def enrich_courses_with_permissions(
    courses: list[CourseRead | Course],
    current_user: PublicUser,
    db_session: Session,
    permission_service: PermissionService,
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


async def enrich_collection_with_permissions(
    collection: CollectionRead | Collection,
    current_user: PublicUser,
    db_session: Session,
    permission_service: PermissionService,
    courses: list | None = None,
) -> CollectionReadWithPermissions:
    """
    Enrich a collection response with permission metadata.

    Args:
        collection: Collection to enrich
        current_user: Current authenticated user
        db_session: Database session
        permission_service: Permission service instance
        courses: Optional list of courses in the collection

    Returns:
        Collection with permission metadata
    """
    collection_id = (
        collection.collection_uuid
        if hasattr(collection, "collection_uuid")
        else str(collection.id)
    )

    # Check permissions
    can_update = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.COLLECTION,
        resource_id=collection_id,
        raise_on_deny=False,
    )

    can_delete = await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.COLLECTION,
        resource_id=collection_id,
        raise_on_deny=False,
    )

    # Check ownership
    is_owner = False
    is_creator = False
    if isinstance(collection, Collection) and collection.creator_id:
        is_creator = collection.creator_id == current_user.id
        is_owner = is_creator  # For collections, creator is owner

    # Build available actions list
    available_actions = []
    available_actions.append("read")  # If they can see it, they can read it
    if can_update:
        available_actions.append("update")
    if can_delete:
        available_actions.append("delete")

    # Convert to dict and add metadata
    collection_dict = (
        collection.model_dump()
        if hasattr(collection, "model_dump")
        else collection.dict()
    )

    # Add courses if not already present
    if "courses" not in collection_dict:
        collection_dict["courses"] = courses if courses is not None else []

    return CollectionReadWithPermissions(
        **collection_dict,
        can_update=can_update,
        can_delete=can_delete,
        is_owner=is_owner,
        is_creator=is_creator,
        available_actions=available_actions,
    )


async def enrich_collections_with_permissions(
    collections: list[CollectionRead | Collection],
    current_user: PublicUser,
    db_session: Session,
    permission_service: PermissionService,
) -> list[CollectionReadWithPermissions]:
    """
    Enrich multiple collections with permission metadata.

    Args:
        collections: List of collections to enrich
        current_user: Current authenticated user
        db_session: Database session
        permission_service: Permission service instance

    Returns:
        List of collections with permission metadata
    """
    enriched_collections = []
    for collection in collections:
        enriched = await enrich_collection_with_permissions(
            collection, current_user, db_session, permission_service
        )
        enriched_collections.append(enriched)

    return enriched_collections


async def enrich_discussion_with_permissions_typed(
    discussion: CourseDiscussionRead | CourseDiscussion,
    current_user: PublicUser,
    db_session: Session,
    permission_service: PermissionService,
) -> CourseDiscussionReadWithPermissions:
    """
    Enrich a discussion response with permission metadata.

    Args:
        discussion: The discussion to enrich (Read model or DB model)
        current_user: The authenticated user
        db_session: Database session
        permission_service: Unified permission service instance

    Returns:
        Discussion response with permission metadata
    """
    # Convert to dict to work with both CourseDiscussionRead and CourseDiscussion models
    if isinstance(discussion, CourseDiscussionRead):
        discussion_dict = discussion.model_dump()
    else:
        # SQLModel instance
        discussion_dict = discussion.model_dump()

    # Check UPDATE permission
    can_update = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.DISCUSSION,
        resource_id=str(discussion.id),
        raise_on_deny=False,
    )

    # Check DELETE permission
    can_delete = await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.DISCUSSION,
        resource_id=str(discussion.id),
        raise_on_deny=False,
    )

    # Check MODERATE permission
    can_moderate = await permission_service.check(
        user=current_user,
        action=Action.MODERATE,
        resource=ResourceType.DISCUSSION,
        resource_id=str(discussion.id),
        raise_on_deny=False,
    )

    # Determine ownership (discussions use user_id as creator)
    user_id = getattr(discussion, "user_id", None)
    is_creator = user_id == current_user.id if user_id else False
    is_owner = is_creator  # For discussions, creator is the owner

    # Build available actions list
    available_actions = ["read"]  # All users can read if they have access
    if can_update:
        available_actions.append("update")
    if can_delete:
        available_actions.append("delete")
    if can_moderate:
        available_actions.append("moderate")

    # Create enriched response
    return CourseDiscussionReadWithPermissions(
        **discussion_dict,
        can_update=can_update,
        can_delete=can_delete,
        can_moderate=can_moderate,
        is_owner=is_owner,
        is_creator=is_creator,
        available_actions=available_actions,
    )


async def enrich_discussions_with_permissions(
    discussions: list[CourseDiscussionRead | CourseDiscussion],
    current_user: PublicUser,
    db_session: Session,
    permission_service: PermissionService,
) -> list[CourseDiscussionReadWithPermissions]:
    """
    Enrich multiple discussions with permission metadata.

    Args:
        discussions: List of discussions to enrich
        current_user: Current authenticated user
        db_session: Database session
        permission_service: Permission service instance

    Returns:
        List of discussions with permission metadata
    """
    enriched_discussions = []
    for discussion in discussions:
        enriched = await enrich_discussion_with_permissions_typed(
            discussion, current_user, db_session, permission_service
        )
        enriched_discussions.append(enriched)

    return enriched_discussions


async def enrich_generic_resource_with_permissions(
    resource: dict[str, Any],
    resource_type: ResourceType,
    resource_id: int | str,
    current_user: PublicUser,
    permission_service: PermissionService,
    actions_to_check: list[Action] | None = None,
) -> dict[str, Any]:
    """
    Generic helper to enrich any resource with permission metadata.

    This function can be used to add permission information to any resource type
    (activities, discussions, users, organizations, etc.).

    Args:
        resource: Resource data as dict
        resource_type: Type of resource (ACTIVITY, DISCUSSION, etc.)
        resource_id: Resource identifier
        current_user: The authenticated user
        permission_service: Unified permission service instance
        actions_to_check: List of actions to check (default: READ, UPDATE, DELETE, MANAGE)

    Returns:
        Resource dict with added permission metadata fields
    """
    if actions_to_check is None:
        actions_to_check = [Action.READ, Action.UPDATE, Action.DELETE, Action.MANAGE]

    # Check each permission
    permission_checks = {}
    for action in actions_to_check:
        can_perform = await permission_service.check(
            user=current_user,
            action=action,
            resource=resource_type,
            resource_id=str(resource_id),
            raise_on_deny=False,
        )
        permission_checks[f"can_{action.value}"] = can_perform

    # Build available actions list
    available_actions = [
        action.value
        for action in actions_to_check
        if permission_checks.get(f"can_{action.value}", False)
    ]

    # Add permission metadata to resource
    return {
        **resource,
        **permission_checks,
        "available_actions": available_actions,
    }


async def enrich_activity_with_permissions(
    activity: dict[str, Any],
    current_user: PublicUser,
    permission_service: PermissionService,
) -> dict[str, Any]:
    """
    Enrich an activity with permission metadata.

    Args:
        activity: Activity data
        current_user: The authenticated user
        permission_service: Unified permission service instance

    Returns:
        Activity with permission metadata
    """
    activity_id = activity.get("id")

    # Check permissions
    can_update = await permission_service.check(
        user=current_user,
        action=Action.UPDATE,
        resource=ResourceType.ACTIVITY,
        resource_id=str(activity_id),
        raise_on_deny=False,
    )

    can_delete = await permission_service.check(
        user=current_user,
        action=Action.DELETE,
        resource=ResourceType.ACTIVITY,
        resource_id=str(activity_id),
        raise_on_deny=False,
    )

    # Check ownership
    creator_id = activity.get("creator_id")
    is_creator = creator_id == current_user.id if creator_id else False
    is_owner = is_creator  # For activities, creator is owner

    # Build available actions
    available_actions = ["read"]  # If they can see it, they can read it
    if can_update:
        available_actions.append("update")
    if can_delete:
        available_actions.append("delete")

    return {
        **activity,
        "can_update": can_update,
        "can_delete": can_delete,
        "is_owner": is_owner,
        "is_creator": is_creator,
        "available_actions": available_actions,
    }



async def enrich_discussion_with_permissions(
    discussion: dict[str, Any],
    current_user: PublicUser,
    permission_service: PermissionService,
) -> dict[str, Any]:
    """
    Enrich a discussion with permission metadata.

    Args:
        discussion: Discussion data
        current_user: The authenticated user
        permission_service: Unified permission service instance

    Returns:
        Discussion with permission metadata
    """
    return await enrich_generic_resource_with_permissions(
        resource=discussion,
        resource_type=ResourceType.DISCUSSION,
        resource_id=discussion.get("id"),
        current_user=current_user,
        permission_service=permission_service,
        actions_to_check=[Action.READ, Action.UPDATE, Action.DELETE, Action.MODERATE],
    )


async def enrich_organization_with_permissions(
    organization: dict[str, Any],
    current_user: PublicUser,
    permission_service: PermissionService,
) -> dict[str, Any]:
    """
    Enrich an organization with permission metadata.

    Args:
        organization: Organization data
        current_user: The authenticated user
        permission_service: Unified permission service instance

    Returns:
        Organization with permission metadata
    """
    return await enrich_generic_resource_with_permissions(
        resource=organization,
        resource_type=ResourceType.ORGANIZATION,
        resource_id=organization.get("id"),
        current_user=current_user,
        permission_service=permission_service,
        actions_to_check=[Action.READ, Action.UPDATE, Action.MANAGE, Action.INVITE],
    )


async def enrich_user_with_permissions(
    user: dict[str, Any],
    current_user: PublicUser,
    permission_service: PermissionService,
) -> dict[str, Any]:
    """
    Enrich a user profile with permission metadata.

    Args:
        user: User data
        current_user: The authenticated user
        permission_service: Unified permission service instance

    Returns:
        User with permission metadata
    """
    is_self = user.get("id") == current_user.id

    enriched = await enrich_generic_resource_with_permissions(
        resource=user,
        resource_type=ResourceType.USER,
        resource_id=user.get("id"),
        current_user=current_user,
        permission_service=permission_service,
        actions_to_check=[Action.READ, Action.UPDATE, Action.DELETE],
    )

    # Add is_self flag
    enriched["is_self"] = is_self

    return enriched


async def enrich_usergroup_with_permissions(
    usergroup: dict[str, Any],
    current_user: PublicUser,
    permission_service: PermissionService,
) -> dict[str, Any]:
    """
    Enrich a usergroup with permission metadata.

    Args:
        usergroup: UserGroup data
        current_user: The authenticated user
        permission_service: Unified permission service instance

    Returns:
        UserGroup with permission metadata
    """
    return await enrich_generic_resource_with_permissions(
        resource=usergroup,
        resource_type=ResourceType.USERGROUP,
        resource_id=usergroup.get("id"),
        current_user=current_user,
        permission_service=permission_service,
        actions_to_check=[Action.READ, Action.UPDATE, Action.DELETE, Action.MANAGE],
    )
