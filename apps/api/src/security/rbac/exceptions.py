"""
Permission-specific exceptions with error codes.

This module provides custom exceptions for RBAC operations that include
specific error codes for better client-side error handling.
"""

from fastapi import HTTPException, status

from src.db.permissions.enums import PermissionErrorCode


class PermissionError(HTTPException):
    """Base exception for permission-related errors."""

    def __init__(
        self,
        status_code: int,
        code: PermissionErrorCode,
        detail: str,
        headers: dict | None = None,
    ) -> None:
        super().__init__(
            status_code=status_code,
            detail={"code": code.value, "message": detail},
            headers=headers,
        )
        self.code = code


class AuthenticationRequiredError(PermissionError):
    """Raised when authentication is required but not provided."""

    def __init__(self, detail: str = "Authentication required") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=PermissionErrorCode.PERM_001,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


class PermissionDeniedError(PermissionError):
    """Raised when user doesn't have required permission."""

    def __init__(self, detail: str = "Permission denied") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code=PermissionErrorCode.PERM_002,
            detail=detail,
        )


class InsufficientRoleLevelError(PermissionError):
    """Raised when user's role level is insufficient."""

    def __init__(self, detail: str = "Insufficient role level") -> None:
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            code=PermissionErrorCode.PERM_003,
            detail=detail,
        )


class PermissionNotFoundError(PermissionError):
    """Raised when a permission is not found."""

    def __init__(self, detail: str = "Permission not found") -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code=PermissionErrorCode.PERM_004,
            detail=detail,
        )


class RoleNotFoundError(PermissionError):
    """Raised when a role is not found."""

    def __init__(self, detail: str = "Role not found") -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            code=PermissionErrorCode.PERM_005,
            detail=detail,
        )


class RoleAlreadyExistsError(PermissionError):
    """Raised when trying to create a role that already exists."""

    def __init__(self, detail: str = "Role already exists") -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            code=PermissionErrorCode.PERM_006,
            detail=detail,
        )


class PermissionAlreadyAssignedError(PermissionError):
    """Raised when trying to assign a permission that's already assigned."""

    def __init__(self, detail: str = "Permission already assigned") -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            code=PermissionErrorCode.PERM_007,
            detail=detail,
        )


class SystemRoleModificationError(PermissionError):
    """Raised when trying to modify a system role in a prohibited way."""

    def __init__(self, detail: str = "Cannot modify system role") -> None:
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            code=PermissionErrorCode.PERM_008,
            detail=detail,
        )
