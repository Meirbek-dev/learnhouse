"""
RBAC module for the permission system.

RBAC v2: This is the only RBAC system.
"""

from src.security.rbac.dependencies import (
    get_permission_service,
    PermissionServiceDep,
    CurrentUserDep,
)
from src.services.rbac.service import RBACService
from src.services.rbac.dependencies import get_rbac_service, RBACServiceDep

__all__ = [
    # RBAC Service
    "RBACService",
    "get_rbac_service",
    "RBACServiceDep",
    # Legacy aliases
    "get_permission_service",
    "PermissionServiceDep",
    "CurrentUserDep",
]
