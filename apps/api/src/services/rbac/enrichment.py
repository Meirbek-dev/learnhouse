"""
RBAC Response Enrichment

Helper functions to add permission metadata to API responses.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, TypeVar

from sqlmodel import Session

if TYPE_CHECKING:
    from src.db.users import PublicUser
    from src.services.rbac.service import RBACService

T = TypeVar("T")


async def enrich_with_permissions(
    resource: Any,
    resource_type: str,
    current_user: PublicUser,
    rbac: RBACService,
    *,
    org_id: int | None = None,
    resource_id_field: str = "id",
    include_actions: list[str] | None = None,
) -> dict:
    """
    Generic enrichment function to add permission metadata to a resource.

    Args:
        resource: The resource object to enrich
        resource_type: Type of resource (e.g., "course", "collection")
        current_user: Current authenticated user
        rbac: RBAC service instance
        org_id: Organization context
        resource_id_field: Field name for the resource ID
        include_actions: Actions to check (default: ["update", "delete"])

    Returns:
        Dict with resource data plus permission metadata
    """
    if include_actions is None:
        include_actions = ["update", "delete"]

    # Get resource data as dict
    if hasattr(resource, "model_dump"):
        data = resource.model_dump()
    elif hasattr(resource, "dict"):
        data = resource.dict()
    else:
        data = dict(resource)

    # Get resource ID
    resource_id = str(getattr(resource, resource_id_field, None) or data.get(resource_id_field))

    # Get user ID
    user_id = getattr(current_user, "id", 0)

    # Check permissions for each action
    available_actions = ["read"]
    permissions = {"can_read": True}

    for action in include_actions:
        result = rbac.check(
            user_id=user_id,
            action=action,
            resource=resource_type,
            resource_id=resource_id,
            org_id=org_id,
        )
        can_action = result.granted if hasattr(result, 'granted') else result
        permissions[f"can_{action}"] = can_action
        if can_action:
            available_actions.append(action)

    # Check ownership
    creator_id = getattr(resource, "creator_id", None) or data.get("creator_id")
    is_owner = creator_id == user_id if creator_id is not None else False

    # Add metadata
    data.update({
        "permissions": permissions,
        "available_actions": available_actions,
        "is_owner": is_owner,
    })

    return data


async def enrich_many_with_permissions(
    resources: list[Any],
    resource_type: str,
    current_user: PublicUser,
    rbac: RBACService,
    *,
    org_id: int | None = None,
    resource_id_field: str = "id",
    include_actions: list[str] | None = None,
) -> list[dict]:
    """
    Enrich a list of resources with permission metadata.
    """
    return [
        await enrich_with_permissions(
            resource=r,
            resource_type=resource_type,
            current_user=current_user,
            rbac=rbac,
            org_id=org_id,
            resource_id_field=resource_id_field,
            include_actions=include_actions,
        )
        for r in resources
    ]


# ============================================================================
# Collection-specific enrichment (backwards compatible)
# ============================================================================

async def enrich_collection_with_permissions(
    collection,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
    courses: list | None = None,
):
    """
    Enrich collection with permission metadata.

    Backwards compatible with old PermissionService interface.
    """
    data = await enrich_with_permissions(
        resource=collection,
        resource_type="collection",
        current_user=current_user,
        rbac=permission_service,
        org_id=getattr(collection, "org_id", None),
        resource_id_field="collection_uuid",
    )

    if courses is not None:
        data["courses"] = courses
    elif "courses" not in data:
        data["courses"] = getattr(collection, "courses", [])

    return data


async def enrich_collections_with_permissions(
    collections,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
):
    """Enrich multiple collections with permission metadata."""
    return [
        await enrich_collection_with_permissions(
            collection=c,
            current_user=current_user,
            db_session=db_session,
            permission_service=permission_service,
        )
        for c in collections
    ]


# ============================================================================
# Course-specific enrichment
# ============================================================================

async def enrich_course_with_permissions(
    course,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
):
    """Enrich course with permission metadata."""
    return await enrich_with_permissions(
        resource=course,
        resource_type="course",
        current_user=current_user,
        rbac=permission_service,
        org_id=getattr(course, "org_id", None),
        resource_id_field="course_uuid",
    )


async def enrich_courses_with_permissions(
    courses,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
):
    """Enrich multiple courses with permission metadata."""
    return [
        await enrich_course_with_permissions(
            course=c,
            current_user=current_user,
            db_session=db_session,
            permission_service=permission_service,
        )
        for c in courses
    ]


# ============================================================================
# Activity-specific enrichment
# ============================================================================

async def enrich_activity_with_permissions(
    activity,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
):
    """Enrich activity with permission metadata."""
    return await enrich_with_permissions(
        resource=activity,
        resource_type="activity",
        current_user=current_user,
        rbac=permission_service,
        org_id=getattr(activity, "org_id", None),
        resource_id_field="activity_uuid",
    )


# ============================================================================
# Discussion-specific enrichment
# ============================================================================

async def enrich_discussion_with_permissions(
    discussion,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
):
    """Enrich discussion with permission metadata."""
    return await enrich_with_permissions(
        resource=discussion,
        resource_type="discussion",
        current_user=current_user,
        rbac=permission_service,
        org_id=getattr(discussion, "org_id", None),
        resource_id_field="discussion_uuid",
    )


async def enrich_discussions_with_permissions(
    discussions,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
):
    """Enrich multiple discussions with permission metadata."""
    return [
        await enrich_discussion_with_permissions(
            discussion=d,
            current_user=current_user,
            db_session=db_session,
            permission_service=permission_service,
        )
        for d in discussions
    ]


# For typed variant - same as above
enrich_discussion_with_permissions_typed = enrich_discussion_with_permissions


# ============================================================================
# Organization-specific enrichment
# ============================================================================

async def enrich_organization_with_permissions(
    organization,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
):
    """Enrich organization with permission metadata."""
    return await enrich_with_permissions(
        resource=organization,
        resource_type="org",
        current_user=current_user,
        rbac=permission_service,
        org_id=getattr(organization, "id", None),
        resource_id_field="org_uuid",
        include_actions=["update", "delete", "manage_members"],
    )


# ============================================================================
# User-specific enrichment
# ============================================================================

async def enrich_user_with_permissions(
    user,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
    org_id: int | None = None,
):
    """Enrich user with permission metadata."""
    return await enrich_with_permissions(
        resource=user,
        resource_type="user",
        current_user=current_user,
        rbac=permission_service,
        org_id=org_id,
        resource_id_field="user_uuid",
    )


# ============================================================================
# UserGroup-specific enrichment
# ============================================================================

async def enrich_usergroup_with_permissions(
    usergroup,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
):
    """Enrich usergroup with permission metadata."""
    return await enrich_with_permissions(
        resource=usergroup,
        resource_type="usergroup",
        current_user=current_user,
        rbac=permission_service,
        org_id=getattr(usergroup, "org_id", None),
        resource_id_field="usergroup_uuid",
    )


# ============================================================================
# Generic helper
# ============================================================================

async def enrich_generic_resource_with_permissions(
    resource,
    resource_type: str,
    current_user: PublicUser,
    db_session: Session,
    permission_service: RBACService,
    resource_id_field: str = "id",
    org_id: int | None = None,
):
    """Generic enrichment for any resource type."""
    return await enrich_with_permissions(
        resource=resource,
        resource_type=resource_type,
        current_user=current_user,
        rbac=permission_service,
        org_id=org_id,
        resource_id_field=resource_id_field,
    )
