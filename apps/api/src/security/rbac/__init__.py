"""
New RBAC module for the permission system.

This module provides the core RBAC functionality including:
- PermissionChecker: Central permission checking with caching and audit
- Decorators: @require_permission for route protection
- Dependencies: FastAPI dependency injection for permissions
- Context: Permission context for tracking user, org, and resource
- Service utilities: Helper functions for services (rbac_check, is_admin_or_maintainer, etc.)
- Course-specific RBAC: Unified course permission checks
- Exceptions: Permission-specific exceptions with error codes
"""

from src.security.rbac.checker import PermissionChecker
from src.security.rbac.context import PermissionContext
from src.security.rbac.decorators import require_permission
from src.security.rbac.dependencies import get_permission_checker
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
from src.security.rbac.service_utils import (
    check_is_resource_author,
    get_user_id,
    has_authenticated_user_role,
    has_instructor_role,
    infer_resource_type,
    is_admin_or_maintainer,
    is_anonymous,
    is_resource_owner,
    is_resource_public,
    map_action,
    verify_not_anonymous,
)

__all__ = [
    "AuthenticationRequiredError",
    "InsufficientRoleLevelError",
    "PermissionAlreadyAssignedError",
    # Core RBAC
    "PermissionChecker",
    "PermissionContext",
    "PermissionDeniedError",
    # Exceptions
    "PermissionError",
    "PermissionNotFoundError",
    "RoleAlreadyExistsError",
    "RoleNotFoundError",
    "SystemRoleModificationError",
    "check_is_resource_author",
    "get_permission_checker",
    "get_user_id",
    "has_authenticated_user_role",
    "has_instructor_role",
    "infer_resource_type",
    "is_admin_or_maintainer",
    "is_anonymous",
    "is_resource_owner",
    "is_resource_public",
    "map_action",
    "require_permission",
    "verify_not_anonymous",
]
