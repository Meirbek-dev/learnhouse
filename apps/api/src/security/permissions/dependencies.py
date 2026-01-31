"""
FastAPI Dependencies for Permission System

Provides dependency injection functions for easy integration
with FastAPI routes and services.
"""

from typing import Annotated, Callable

from fastapi import Depends, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.permissions.generated_enums import Action, ResourceType, Scope
from src.db.users import AnonymousUser, PublicUser
from src.security.permissions.checker import PermissionChecker, get_permission_checker


async def _lazy_get_current_user(
    request: Request, Authorize=Depends(), db_session=Depends(get_db_session)
) -> PublicUser | AnonymousUser:
    """Lazy wrapper to import get_current_user at runtime to avoid circular imports."""
    from src.security.auth import get_current_user as _get_current_user

    return await _get_current_user(request, Authorize, db_session)


# Type aliases for dependency injection
PermissionCheckerDep = Annotated[PermissionChecker, Depends(get_permission_checker)]
CurrentUserDep = Annotated[PublicUser | AnonymousUser, Depends(_lazy_get_current_user)]


def require_permission(
    action: Action,
    resource_type: ResourceType,
    scope: Scope = Scope.ALL,
) -> Callable:
    """
    Dependency that requires a specific permission.

    This is the recommended way to protect routes.

    Usage:
        @router.post("/courses")
        async def create_course(
            _: Annotated[None, Depends(require_permission(
                Action.CREATE,
                ResourceType.COURSE,
                Scope.ORG
            ))],
            checker: PermissionCheckerDep,
            user: CurrentUserDep,
            db: Session = Depends(get_db_session),
        ):
            # Permission already checked
            return await create_course_service(...)

    Args:
        action: Required action
        resource_type: Required resource type
        scope: Required scope (default: ALL)

    Returns:
        FastAPI dependency function
    """

    async def dependency(
        checker: PermissionCheckerDep,
        user: CurrentUserDep,
        request: Request,
    ) -> None:
        """Inner dependency function that performs the check."""
        await checker.require(
            user=user,
            action=action,
            resource_type=resource_type,
            scope=scope,
            request=request,
        )

    return dependency


def require_any_permission(
    checks: list[tuple[Action, ResourceType, Scope]],
) -> Callable:
    """
    Dependency that requires ANY of the specified permissions.

    Usage:
        @router.get("/content")
        async def get_content(
            _: Annotated[None, Depends(require_any_permission([
                (Action.READ, ResourceType.COURSE, Scope.ALL),
                (Action.MANAGE, ResourceType.ORGANIZATION, Scope.OWN),
            ]))],
        ):
            # User has at least one of the permissions
            ...

    Args:
        checks: List of (action, resource_type, scope) tuples

    Returns:
        FastAPI dependency function
    """

    async def dependency(
        checker: PermissionCheckerDep,
        user: CurrentUserDep,
        request: Request,
    ) -> None:
        """Check if user has ANY of the permissions."""
        from src.security.permissions.exceptions import PermissionDenied

        for action, resource_type, scope in checks:
            has_perm = await checker.check(
                user=user,
                action=action,
                resource_type=resource_type,
                scope=scope,
                request=request,
            )
            if has_perm:
                return

        # None of the permissions matched
        raise PermissionDenied(
            checks[0][0],
            checks[0][1],
            reason="None of the required permissions satisfied",
        )

    return dependency


def require_all_permissions(
    checks: list[tuple[Action, ResourceType, Scope]],
) -> Callable:
    """
    Dependency that requires ALL of the specified permissions.

    Usage:
        @router.post("/admin/action")
        async def admin_action(
            _: Annotated[None, Depends(require_all_permissions([
                (Action.MANAGE, ResourceType.ORGANIZATION, Scope.OWN),
                (Action.UPDATE, ResourceType.ROLE, Scope.ORG),
            ]))],
        ):
            # User has all required permissions
            ...

    Args:
        checks: List of (action, resource_type, scope) tuples

    Returns:
        FastAPI dependency function
    """

    async def dependency(
        checker: PermissionCheckerDep,
        user: CurrentUserDep,
        request: Request,
    ) -> None:
        """Check if user has ALL of the permissions."""
        for action, resource_type, scope in checks:
            await checker.require(
                user=user,
                action=action,
                resource_type=resource_type,
                scope=scope,
                request=request,
            )

    return dependency


def require_authentication() -> Callable:
    """
    Dependency that requires authentication (but no specific permission).

    Usage:
        @router.get("/profile")
        async def get_profile(
            _: Annotated[None, Depends(require_authentication())],
            user: CurrentUserDep,
        ):
            # User is authenticated
            return user

    Returns:
        FastAPI dependency function
    """

    async def dependency(
        user: CurrentUserDep,
    ) -> None:
        """Check if user is authenticated."""
        from src.security.permissions.exceptions import AuthenticationRequired

        if isinstance(user, AnonymousUser) or user.id == 0:
            raise AuthenticationRequired()

    return dependency
