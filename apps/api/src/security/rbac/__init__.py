"""
New RBAC module for the permission system.

This module provides the core RBAC functionality including:
- UnifiedPermissionService: Central permission checking with caching and audit
- Decorators: @require_permission for route protection
- Dependencies: FastAPI dependency injection for permissions
- Context: Permission context for tracking user, org, and resource
- Service utilities: Helper functions for services (rbac_check, is_admin_or_maintainer, etc.)
- Course-specific RBAC: Unified course permission checks
- Exceptions: Permission-specific exceptions with error codes
"""

from src.security.rbac.context import PermissionContext
from src.security.rbac.decorators import require_permission
from src.security.rbac.dependencies import get_permission_service
from src.security.rbac.exceptions import (
    AuthenticationRequiredError,
    InsufficientRoleLevelError,
    PermissionAlreadyAssignedError,
    PermissionDeniedError,
    PermissionError,
    PermissionNotFoundError,
    RoleAlreadyExistsError,
    RoleNotFoundError,
    SystemRoleModificationError,
)

__all__ = [
    "AuthenticationRequiredError",
    "InsufficientRoleLevelError",
    "PermissionAlreadyAssignedError",
    # Core RBAC
    "PermissionContext",
    "PermissionDeniedError",
    # Exceptions
    "PermissionError",
    "PermissionNotFoundError",
    "RoleAlreadyExistsError",
    "RoleNotFoundError",
    "SystemRoleModificationError",
    "get_permission_service",
    "require_permission",
]
