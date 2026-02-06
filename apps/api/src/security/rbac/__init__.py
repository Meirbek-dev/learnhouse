"""
RBAC module for the permission system.
"""

from src.security.rbac.dependencies import (
    CurrentUserDep,
    RBACServiceDep,
    get_rbac_service,
)
from src.services.rbac.service import RBACService

# Backwards-compatible aliases
PermissionServiceDep = RBACServiceDep
get_permission_service = get_rbac_service

__all__ = [
    "CurrentUserDep",
    "PermissionServiceDep",
    "RBACService",
    "RBACServiceDep",
    "get_permission_service",
    "get_rbac_service",
]
