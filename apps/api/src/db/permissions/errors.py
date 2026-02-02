"""
Standardized error response models for the RBAC system.

Provides consistent error structure across all API endpoints with
detailed permission information for better debugging and user feedback.
"""

from typing import Any

from fastapi import HTTPException, status
from pydantic import Field as PydanticField

from src.db.permissions.enums import PermissionErrorCode
from src.db.strict_base_model import PydanticStrictBaseModel


class PermissionErrorDetail(PydanticStrictBaseModel):
    """
    Detailed permission error response.

    This model provides comprehensive information about why a permission
    check failed, including the required permission and suggested actions.
    """

    code: PermissionErrorCode = PydanticField(description="Machine-readable error code")
    message: str = PydanticField(description="Human-readable error message")
    required_permission: str | None = PydanticField(
        default=None,
        description="The permission string that is required (e.g., 'course:update:own')",
    )
    resource_type: str | None = PydanticField(
        default=None, description="The type of resource being accessed"
    )
    resource_id: int | str | None = PydanticField(
        default=None, description="The ID of the resource being accessed"
    )
    action: str | None = PydanticField(
        default=None, description="The action being attempted"
    )
    user_permissions: list[str] | None = PydanticField(
        default=None, description="User's current permissions (for debugging, optional)"
    )
    suggestion: str | None = PydanticField(
        default=None, description="Suggested action to resolve the error"
    )


class PermissionDeniedError(HTTPException):
    """
    Standardized Permission Denied exception.

    Use this instead of generic HTTPException for permission-related errors
    to ensure consistent error responses across the API.
    """

    def __init__(
        self,
        message: str = "Permission denied",
        required_permission: str | None = None,
        resource_type: str | None = None,
        resource_id: int | str | None = None,
        action: str | None = None,
        code: PermissionErrorCode = PermissionErrorCode.PERM_002,
        suggestion: str | None = None,
        include_user_permissions: bool = False,
        user_permissions: list[str] | None = None,
    ) -> None:
        """
        Initialize PermissionDeniedError.

        Args:
            message: Human-readable error message
            required_permission: The permission required (e.g., "course:update:own")
            resource_type: Type of resource (e.g., "course")
            resource_id: ID of the resource
            action: Action being attempted (e.g., "update")
            code: Permission error code
            suggestion: Suggested resolution
            include_user_permissions: Whether to include user's permissions in response
            user_permissions: User's current permissions list
        """
        detail = PermissionErrorDetail(
            code=code,
            message=message,
            required_permission=required_permission,
            resource_type=resource_type,
            resource_id=resource_id,
            action=action,
            suggestion=suggestion or self._get_default_suggestion(code),
        )

        if include_user_permissions and user_permissions:
            detail.user_permissions = user_permissions

        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail.model_dump(exclude_none=True),
        )

    @staticmethod
    def _get_default_suggestion(code: PermissionErrorCode) -> str:
        """Get default suggestion based on error code."""
        suggestions = {
            PermissionErrorCode.PERM_001: "Please log in to access this resource",
            PermissionErrorCode.PERM_002: "Contact your organization administrator to request access",
            PermissionErrorCode.PERM_003: "You need a higher role level to perform this action",
            PermissionErrorCode.PERM_004: "The requested permission does not exist",
            PermissionErrorCode.PERM_005: "The requested role does not exist",
            PermissionErrorCode.PERM_008: "System roles cannot be modified",
        }
        return suggestions.get(code, "Contact support for assistance")


class ResourceNotFoundError(HTTPException):
    """Standardized Resource Not Found exception."""

    def __init__(
        self,
        resource_type: str,
        resource_id: int | str,
        message: str | None = None,
    ) -> None:
        """
        Initialize ResourceNotFoundError.

        Args:
            resource_type: Type of resource (e.g., "course")
            resource_id: ID of the resource
            message: Optional custom message
        """
        if not message:
            message = f"{resource_type.capitalize()} with ID {resource_id} not found"

        detail = {
            "code": "RESOURCE_NOT_FOUND",
            "message": message,
            "resource_type": resource_type,
            "resource_id": resource_id,
        }

        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class AuthenticationRequiredError(HTTPException):
    """Standardized Authentication Required exception."""

    def __init__(
        self,
        message: str = "Authentication required",
        resource_type: str | None = None,
    ) -> None:
        """
        Initialize AuthenticationRequiredError.

        Args:
            message: Human-readable error message
            resource_type: Optional resource type being accessed
        """
        detail = PermissionErrorDetail(
            code=PermissionErrorCode.PERM_001,
            message=message,
            resource_type=resource_type,
            suggestion="Please log in to access this resource",
        )

        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail.model_dump(exclude_none=True),
            headers={"WWW-Authenticate": "Bearer"},
        )
