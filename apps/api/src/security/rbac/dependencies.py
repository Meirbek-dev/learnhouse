"""
FastAPI dependencies for the permission system.

This module provides FastAPI dependency injection functions for:
- Getting the RBAC service
- Getting the current permission context
- Combining user and permission data

RBAC v2: This is the only RBAC system - all legacy code has been removed.
"""

from typing import Annotated

from fastapi import Depends, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.context import PermissionContext
from src.services.rbac.service import RBACService
from src.services.rbac.dependencies import get_rbac_service, RBACServiceDep


async def _lazy_get_current_user(
    request: Request, Authorize=Depends(), db_session=Depends(get_db_session)
):
    """Lazy wrapper to import get_current_user at runtime to avoid circular imports."""
    from src.security.auth import get_current_user as _get_current_user

    # Delegate to the real dependency (Authorise and db_session are provided by FastAPI)
    return await _get_current_user(request, Authorize, db_session)


def get_permission_service(
    db_session: Annotated[Session, Depends(get_db_session)],
) -> RBACService:
    """
    Get an RBACService instance.

    This is the main dependency for permission checking in routes.

    Args:
        db_session: Database session

    Returns:
        RBACService instance

    Note:
        This function is kept for backwards compatibility.
        Prefer using get_rbac_service directly.
    """
    return get_rbac_service(db_session)


def get_permission_context(
    request: Request,
    current_user: Annotated[
        PublicUser | AnonymousUser, Depends(_lazy_get_current_user)
    ],
) -> PermissionContext:
    """
    Get the current permission context from request.

    This creates a PermissionContext with user and request information.

    Args:
        request: FastAPI request
        current_user: Current authenticated user

    Returns:
        PermissionContext instance
    """
    user_id = current_user.id if hasattr(current_user, "id") else 0
    user_uuid = current_user.user_uuid if hasattr(current_user, "user_uuid") else None

    return PermissionContext.from_request(
        user_id=user_id,
        request=request,
        user_uuid=user_uuid,
    )


# Type aliases for cleaner dependency injection
# Note: PermissionServiceDep is an alias for RBACServiceDep for backwards compatibility
PermissionServiceDep = Annotated[RBACService, Depends(get_permission_service)]
PermissionContextDep = Annotated[PermissionContext, Depends(get_permission_context)]
CurrentUserDep = Annotated[PublicUser | AnonymousUser, Depends(_lazy_get_current_user)]


class PermissionDeps:
    """
    Combined permission dependencies.

    This class holds all permission-related dependencies for easy injection.
    Usage:
        async def my_route(deps: Annotated[PermissionDeps, Depends()]):
            result = deps.service.check(user_id=deps.user.id, action="read", resource="course")
    """

    def __init__(
        self,
        service: PermissionServiceDep,
        context: PermissionContextDep,
        user: CurrentUserDep,
    ) -> None:
        self.service = service
        self.context = context
        self.user = user

    def require(self, action: str, resource: str, resource_id=None, org_id=None):
        """Check permission and raise HTTP 403 if denied."""
        user_id = self.user.id if hasattr(self.user, "id") else 0
        result = self.service.check(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
        )
        if not result.granted:
            from fastapi import HTTPException, status

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail=result.reason
            )

    def can(self, action: str, resource: str, resource_id=None, org_id=None) -> bool:
        """Check if user has permission without raising."""
        user_id = self.user.id if hasattr(self.user, "id") else 0
        result = self.service.check(
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            org_id=org_id,
        )
        return result.granted


# Type alias for combined deps
PermissionDepsDep = Annotated[PermissionDeps, Depends()]
