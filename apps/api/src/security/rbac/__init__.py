"""
New RBAC module for the permission system.

This module provides the core RBAC functionality including:
- PermissionChecker: Central permission checking with caching and audit
- Decorators: @require_permission for route protection
- Dependencies: FastAPI dependency injection for permissions
- Context: Permission context for tracking user, org, and resource
"""

from src.security.rbac.checker import PermissionChecker
from src.security.rbac.context import PermissionContext
from src.security.rbac.decorators import require_permission
from src.security.rbac.dependencies import get_permission_checker

__all__ = [
    "PermissionChecker",
    "PermissionContext",
    "require_permission",
    "get_permission_checker",
]
