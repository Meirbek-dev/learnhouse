"""
Permission decorators for FastAPI routes.

This module provides decorators for protecting routes with permission checks.
"""

from collections.abc import Callable
from functools import wraps
from typing import Any

from fastapi import Depends, HTTPException, Request, status

from src.db.permissions.enums import Action, ResourceType
from src.db.users import AnonymousUser, PublicUser
from src.security.rbac.context import PermissionContext
from src.security.rbac.dependencies import get_permission_checker


def require_permission(
    action: Action,
    resource: ResourceType,
    resource_id_param: str | None = None,
    org_id_param: str | None = None,
    error_message: str | None = None,
) -> Callable:
    """
    Decorator to require a permission for a route.

    This decorator automatically checks permissions before executing the route.
    It extracts resource_id and org_id from path/query parameters if specified.

    Usage:
        @router.put("/courses/{course_uuid}")
        @require_permission(Action.UPDATE, ResourceType.COURSE, "course_uuid")
        async def update_course(course_uuid: str, ...):
            ...

    Args:
        action: Required action
        resource: Resource type
        resource_id_param: Name of the path/query parameter containing resource ID
        org_id_param: Name of the path/query parameter containing org ID
        error_message: Custom error message for permission denied

    Returns:
        Decorated function
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            # Extract dependencies from kwargs (FastAPI injects them)
            request: Request | None = kwargs.get("request")
            current_user: PublicUser | AnonymousUser | None = kwargs.get("current_user")
            db_session = kwargs.get("db_session")
            checker = kwargs.get("checker")

            # If checker not in kwargs, we need to get it
            if checker is None and db_session is not None:
                from src.security.rbac.checker import PermissionChecker

                checker = PermissionChecker(db_session)

            if checker is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Permission checker not available",
                )

            if current_user is None:
                # Try to get from args if it's a method
                for arg in args:
                    if isinstance(arg, (PublicUser, AnonymousUser)):
                        current_user = arg
                        break

            if current_user is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            # Extract resource_id from kwargs if specified
            resource_id = None
            if resource_id_param:
                resource_id = kwargs.get(resource_id_param)

            # Extract org_id from kwargs if specified
            org_id = None
            if org_id_param:
                org_id = kwargs.get(org_id_param)
                if org_id is not None:
                    org_id = int(org_id)

            # Build context
            context = None
            if request:
                context = PermissionContext.from_request(
                    user_id=current_user.id,
                    request=request,
                    user_uuid=getattr(current_user, "user_uuid", None),
                    org_id=org_id,
                )

            # Check permission
            checker.require(
                current_user,
                action,
                resource,
                resource_id,
                org_id,
                context,
                error_message,
            )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def require_authenticated(func: Callable) -> Callable:
    """
    Decorator to require authentication for a route.

    This is simpler than require_permission when you just need to check
    that the user is logged in.

    Usage:
        @router.get("/profile")
        @require_authenticated
        async def get_profile(current_user: PublicUser = Depends(get_current_user)):
            ...
    """

    @wraps(func)
    async def wrapper(*args, **kwargs) -> Any:
        current_user = kwargs.get("current_user")

        if current_user is None:
            for arg in args:
                if isinstance(arg, (PublicUser, AnonymousUser)):
                    current_user = arg
                    break

        if current_user is None or isinstance(current_user, AnonymousUser):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if hasattr(current_user, "id") and current_user.id == 0:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authentication required",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return await func(*args, **kwargs)

    return wrapper


def require_org_role(
    role_slug: str,
    org_id_param: str = "org_id",
) -> Callable:
    """
    Decorator to require a specific role within an organization.

    Usage:
        @router.delete("/orgs/{org_id}/users/{user_id}")
        @require_org_role("org-admin", "org_id")
        async def remove_user(org_id: int, user_id: int, ...):
            ...

    Args:
        role_slug: Required role slug (e.g., "org-admin", "instructor")
        org_id_param: Name of the path parameter containing org ID

    Returns:
        Decorated function
    """

    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            from sqlmodel import select

            from src.db.permissions.models import Role, UserRole

            current_user = kwargs.get("current_user")
            db_session = kwargs.get("db_session")
            org_id = kwargs.get(org_id_param)

            if current_user is None or isinstance(current_user, AnonymousUser):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required",
                )

            if db_session is None or org_id is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Missing required dependencies",
                )

            # Check if user has the required role
            statement = (
                select(UserRole)
                .join(Role, Role.id == UserRole.role_id)
                .where(
                    UserRole.user_id == current_user.id,
                    UserRole.org_id == int(org_id),
                    Role.slug == role_slug,
                )
            )
            result = db_session.exec(statement).first()

            if not result:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{role_slug}' required for this action",
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator
