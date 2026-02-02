"""
RBAC module for the permission system.

RBAC v2: This is the only RBAC system.
"""

from src.security.rbac.dependencies import (
    CurrentUserDep,
    PermissionServiceDep,
    get_permission_service,
)
from src.services.rbac.dependencies import RBACServiceDep, get_rbac_service
from src.services.rbac.service import RBACService

__all__ = [
    "CurrentUserDep",
    "PermissionServiceDep",
    # RBAC Service
    "RBACService",
    "RBACServiceDep",
    # Legacy aliases
    "get_permission_service",
    "get_rbac_service",
]
