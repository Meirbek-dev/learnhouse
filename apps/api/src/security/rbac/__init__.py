"""
RBAC module for the permission system.

This module provides the core RBAC functionality including:
- RBACService: Central permission checking with caching and audit
- Dependencies: FastAPI dependency injection for permissions
- Context: Permission context for tracking user, org, and resource
- Exceptions: Permission-specific exceptions with error codes

RBAC v2: This is the only RBAC system - all legacy code has been removed.
"""

from src.security.rbac.context import PermissionContext
from src.security.rbac.dependencies import (
    get_permission_service,
    PermissionServiceDep,
    PermissionContextDep,
    PermissionDeps,
    PermissionDepsDep,
    CurrentUserDep,
)
from src.services.rbac.service import RBACService
from src.services.rbac.dependencies import get_rbac_service, RBACServiceDep

__all__ = [
    # RBAC Service
    "RBACService",
    "get_rbac_service",
    "RBACServiceDep",
    # Legacy aliases (prefer RBACService)
    "get_permission_service",
    "PermissionServiceDep",
    # Context
    "PermissionContext",
    "PermissionContextDep",
    # Combined deps
    "PermissionDeps",
    "PermissionDepsDep",
    "CurrentUserDep",
]
