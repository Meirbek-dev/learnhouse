"""
Backward compatibility wrappers for old RBAC functions.

This module provides drop-in replacements for the old rbac_check_* functions
that use the new UnifiedPermissionService internally. This allows us to migrate
gradually without breaking existing code.

Once all code is migrated to use UnifiedPermissionService directly, this file can be deleted.
"""

from typing import Literal

from fastapi import HTTPException, Request, status
from sqlmodel import Session

from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, InternalUser, PublicUser
from src.services.permissions.unified_permission_service import get_permission_service


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
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    Generic RBAC check for any resource - backward compatibility wrapper.
    """
    if resource_type is None:
        # Default to COURSE for backward compatibility (unsafe!)
        resource_type = ResourceType.COURSE

    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=resource_type,
        resource_id=resource_uuid if resource_uuid != "course_x" else None,
        org_id=org_id,
        request=request,
        raise_on_deny=True,
    )


async def rbac_check_org(
    request: Request,
    org_uuid: str,
    current_user: PublicUser | AnonymousUser | InternalUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for organization resources - backward compatibility wrapper.
    """
    # Organizations are readable by anyone
    if action == "read":
        return True

    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.ORGANIZATION,
        resource_id=org_uuid,
        request=request,
        raise_on_deny=True,
    )


async def rbac_check_user(
    request: Request,
    user_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for user resources - backward compatibility wrapper.
    """
    if action in ("create", "read"):
        return True

    # Users can update/delete their own data
    if hasattr(current_user, "user_uuid") and current_user.user_uuid == user_uuid:
        return True

    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.USER,
        resource_id=user_uuid,
        request=request,
        raise_on_deny=True,
    )


async def rbac_check_role(
    request: Request,
    role_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> None:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for role resources - backward compatibility wrapper.
    """
    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.ROLE,
        resource_id=role_uuid,
        request=request,
        raise_on_deny=True,
    )


async def rbac_check_usergroup(
    request: Request,
    usergroup_uuid: str,
    current_user: PublicUser | AnonymousUser | InternalUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for usergroup resources - backward compatibility wrapper.
    """
    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.USERGROUP,
        resource_id=usergroup_uuid,
        request=request,
        raise_on_deny=True,
    )


async def courses_rbac_check(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
    require_course_ownership: bool = False,
    org_id: int | None = None,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    Unified RBAC check for courses - backward compatibility wrapper.
    """
    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.COURSE,
        resource_id=course_uuid if course_uuid != "course_x" else None,
        org_id=org_id,
        request=request,
        raise_on_deny=True,
    )


async def courses_rbac_check_for_activities(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for activities - backward compatibility wrapper.
    """
    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.ACTIVITY,
        resource_id=course_uuid,  # Using course_uuid for context
        request=request,
        raise_on_deny=True,
    )


async def courses_rbac_check_for_assignments(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for assignments - backward compatibility wrapper.
    """
    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.ASSIGNMENT,
        resource_id=course_uuid,  # Using course_uuid for context
        request=request,
        raise_on_deny=True,
    )


async def courses_rbac_check_for_chapters(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for chapters - backward compatibility wrapper.
    """
    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.CHAPTER,
        resource_id=course_uuid,  # Using course_uuid for context
        request=request,
        raise_on_deny=True,
    )


async def courses_rbac_check_for_certifications(
    request: Request,
    course_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for certifications - backward compatibility wrapper.
    """
    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.CERTIFICATE,
        resource_id=course_uuid,  # Using course_uuid for context
        request=request,
        raise_on_deny=True,
    )


async def courses_rbac_check_for_collections(
    request: Request,
    collection_uuid: str,
    current_user: PublicUser | AnonymousUser,
    action: Literal["create", "read", "update", "delete"],
    db_session: Session,
    org_id: int | None = None,
) -> bool:
    """
    [DEPRECATED] Use UnifiedPermissionService.check() directly instead.

    RBAC check for collections - backward compatibility wrapper.
    """
    service = get_permission_service(db_session)
    mapped_action = _map_action(action)

    return await service.check(
        user=current_user,
        action=mapped_action,
        resource=ResourceType.COLLECTION,
        resource_id=collection_uuid,
        org_id=org_id,
        request=request,
        raise_on_deny=True,
    )
