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
    check_user_permission,
    courses_rbac_check,
    courses_rbac_check_for_activities,
    courses_rbac_check_for_assignments,
    courses_rbac_check_for_certifications,
    courses_rbac_check_for_chapters,
    courses_rbac_check_for_collections,
    courses_rbac_check_with_course_lookup,
    has_authenticated_user_role,
    has_instructor_role,
    infer_resource_type,
    is_admin_or_maintainer,
    is_resource_owner,
    is_resource_public,
    map_action,
    rbac_check,
    rbac_check_org,
    rbac_check_role,
    rbac_check_user,
    rbac_check_usergroup,
    verify_not_anonymous,
)

__all__ = [
    # Core RBAC
    "PermissionChecker",
    "PermissionContext",
    "get_permission_checker",
    "require_permission",
    # Exceptions
    "PermissionError",
    "AuthenticationRequiredError",
    "PermissionDeniedError",
    "InsufficientRoleLevelError",
    "PermissionNotFoundError",
    "RoleNotFoundError",
    "RoleAlreadyExistsError",
    "PermissionAlreadyAssignedError",
    "SystemRoleModificationError",
    # Service utilities
    "rbac_check",
    "rbac_check_org",
    "rbac_check_role",
    "rbac_check_user",
    "rbac_check_usergroup",
    "verify_not_anonymous",
    "check_is_resource_author",
    "check_user_permission",
    "is_admin_or_maintainer",
    "has_instructor_role",
    "has_authenticated_user_role",
    "is_resource_owner",
    "is_resource_public",
    "infer_resource_type",
    "map_action",
    # Course-specific RBAC
    "courses_rbac_check",
    "courses_rbac_check_with_course_lookup",
    "courses_rbac_check_for_activities",
    "courses_rbac_check_for_assignments",
    "courses_rbac_check_for_chapters",
    "courses_rbac_check_for_certifications",
    "courses_rbac_check_for_collections",
]
