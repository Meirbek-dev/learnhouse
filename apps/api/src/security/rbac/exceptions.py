"""
Standardized Permission Exceptions

Provides consistent error responses across the system with proper
error codes and structured details for frontend consumption.
"""

from fastapi import HTTPException, status

from src.db.permissions.generated_enums import Action, ResourceType


class PermissionDenied(HTTPException):
    """
    Standardized permission denied exception.

    Replaces all instances of:
    - HTTPException(status_code=403, ...)
    - raise_permission_denied(...)
    - Custom permission errors

    Usage:
        raise PermissionDenied(Action.UPDATE, ResourceType.COURSE)
        raise PermissionDenied(Action.DELETE, ResourceType.USER, resource_id="user_123")
    """

    def __init__(
        self,
        action: Action,
        resource_type: ResourceType,
        resource_id: str | None = None,
        reason: str | None = None,
        org_id: int | None = None,
    ) -> None:
        """
        Initialize permission denied exception.

        Args:
            action: Action that was attempted
            resource_type: Type of resource
            resource_id: Optional specific resource ID
            reason: Optional human-readable reason
            org_id: Optional organization ID
        """
        detail = {
            "error_code": "PERMISSION_DENIED",
            "message": f"Permission denied: {resource_type.value}:{action.value}",
            "action": action.value,
            "resource_type": resource_type.value,
            "resource_id": resource_id,
            "org_id": org_id,
            "reason": reason,
        }

        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class AuthenticationRequired(HTTPException):
    """
    Standardized authentication required exception.

    Replaces all instances of:
    - HTTPException(status_code=401, ...)
    - raise HTTPException(401, "Not authenticated")

    Usage:
        raise AuthenticationRequired()
        raise AuthenticationRequired(reason="This resource requires authentication")
    """

    def __init__(
        self,
        reason: str | None = None,
        resource_type: ResourceType | None = None,
        action: Action | None = None,
    ) -> None:
        """
        Initialize authentication required exception.

        Args:
            reason: Optional human-readable reason
            resource_type: Optional resource type being accessed
            action: Optional action being attempted
        """
        message = "Authentication required"
        if resource_type and action:
            message = f"Authentication required to {action.value} {resource_type.value}"

        detail = {
            "error_code": "AUTHENTICATION_REQUIRED",
            "message": message,
            "reason": reason,
            "resource_type": resource_type.value if resource_type else None,
            "action": action.value if action else None,
        }

        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
        )


class InsufficientRole(HTTPException):
    """
    Exception for when user has insufficient role level.

    Usage:
        raise InsufficientRole(required_role="instructor", user_role="user")
    """

    def __init__(
        self,
        required_role: str,
        user_role: str | None = None,
    ) -> None:
        """
        Initialize insufficient role exception.

        Args:
            required_role: Required role slug
            user_role: User's current role slug
        """
        detail = {
            "error_code": "INSUFFICIENT_ROLE",
            "message": f"Role '{required_role}' or higher required",
            "required_role": required_role,
            "user_role": user_role,
        }

        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
        )


class ResourceNotFound(HTTPException):
    """
    Exception for when resource is not found.

    Usage:
        raise ResourceNotFound(ResourceType.COURSE, "course_123")
    """

    def __init__(
        self,
        resource_type: ResourceType,
        resource_id: str,
    ) -> None:
        """
        Initialize resource not found exception.

        Args:
            resource_type: Type of resource
            resource_id: Resource identifier
        """
        detail = {
            "error_code": "RESOURCE_NOT_FOUND",
            "message": f"{resource_type.value.title()} not found",
            "resource_type": resource_type.value,
            "resource_id": resource_id,
        }

        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )
