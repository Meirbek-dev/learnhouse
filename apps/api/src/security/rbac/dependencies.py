"""
FastAPI dependencies for the permission system.

This module provides FastAPI dependency injection functions for:
- Getting the permission checker
- Getting the current permission context
- Combining user and permission data
"""

from typing import Annotated

from fastapi import Depends, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.checker import PermissionChecker
from src.security.rbac.context import PermissionContext


async def _lazy_get_current_user(request: Request, Authorize=Depends(), db_session=Depends(get_db_session)):
    """Lazy wrapper to import get_current_user at runtime to avoid circular imports."""
    from src.security.auth import get_current_user as _get_current_user

    # Delegate to the real dependency (Authorise and db_session are provided by FastAPI)
    return await _get_current_user(request, Authorize, db_session)


def get_permission_checker(
    db_session: Annotated[Session, Depends(get_db_session)],
) -> PermissionChecker:
    """
    Get a PermissionChecker instance.

    This is the main dependency for permission checking in routes.

    Args:
        db_session: Database session

    Returns:
        PermissionChecker instance
    """
    return PermissionChecker(db_session)


def get_permission_context(
    request: Request,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(_lazy_get_current_user)],
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
PermissionCheckerDep = Annotated[PermissionChecker, Depends(get_permission_checker)]
PermissionContextDep = Annotated[PermissionContext, Depends(get_permission_context)]
CurrentUserDep = Annotated[PublicUser | AnonymousUser, Depends(_lazy_get_current_user)]


class PermissionDeps:
    """
    Combined permission dependencies.

    This class holds all permission-related dependencies for easy injection.
    Usage:
        async def my_route(deps: Annotated[PermissionDeps, Depends()]):
            deps.checker.require(deps.user, Action.READ, ResourceType.COURSE)
    """

    def __init__(
        self,
        checker: PermissionCheckerDep,
        context: PermissionContextDep,
        user: CurrentUserDep,
    ) -> None:
        self.checker = checker
        self.context = context
        self.user = user

    def require(self, action, resource, resource_id=None, org_id=None):
        """Shorthand for checker.require with current user and context."""
        self.checker.require(
            self.user,
            action,
            resource,
            resource_id,
            org_id,
            self.context,
        )

    def can(self, action, resource, resource_id=None, org_id=None) -> bool:
        """Shorthand for checker.check with current user."""
        return self.checker.check(
            self.user,
            action,
            resource,
            resource_id,
            org_id,
            self.context,
        )


# Type alias for combined deps
PermissionDepsDep = Annotated[PermissionDeps, Depends()]
