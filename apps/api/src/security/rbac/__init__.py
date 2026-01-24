"""
New RBAC module for the permission system.

This module provides the core RBAC functionality including:
- PermissionChecker: Central permission checking with caching and audit
- Decorators: @require_permission for route protection
- Dependencies: FastAPI dependency injection for permissions
- Context: Permission context for tracking user, org, and resource
- Compat: Compatibility layer for legacy RBAC migration
"""

from src.security.rbac.checker import PermissionChecker
from src.security.rbac.compat import (
    authorization_verify_based_on_org_admin_status as compat_verify_org_admin,
)
from src.security.rbac.compat import (
    authorization_verify_based_on_roles as compat_verify_roles,
)
from src.security.rbac.compat import (
    authorization_verify_based_on_roles_and_authorship as compat_verify_roles_authorship,
)
from src.security.rbac.compat import (
    authorization_verify_if_element_is_public as compat_verify_public,
)

# Compatibility layer for legacy code migration
from src.security.rbac.compat import (
    authorization_verify_if_user_is_anon as compat_verify_anon,
)
from src.security.rbac.compat import (
    authorization_verify_if_user_is_author as compat_verify_author,
)
from src.security.rbac.compat import (
    courses_rbac_check_compat,
    rbac_check_generic,
)
from src.security.rbac.context import PermissionContext
from src.security.rbac.decorators import require_permission
from src.security.rbac.dependencies import get_permission_checker

__all__ = [
    # New RBAC
    "PermissionChecker",
    "PermissionContext",
    # Compatibility layer
    "compat_verify_anon",
    "compat_verify_author",
    "compat_verify_org_admin",
    "compat_verify_public",
    "compat_verify_roles",
    "compat_verify_roles_authorship",
    "courses_rbac_check_compat",
    "get_permission_checker",
    "rbac_check_generic",
    "require_permission",
]
