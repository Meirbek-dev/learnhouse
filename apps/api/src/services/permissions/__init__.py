"""
Permission services - compatibility shim.

Redirects to src.services.rbac. Import from there directly for new code.
"""

from src.services.rbac.dependencies import get_rbac_service
from src.services.rbac.service import RBACService

# Backwards-compatible aliases
PermissionService = RBACService
get_permission_service = get_rbac_service

__all__ = [
    "PermissionService",
    "RBACService",
    "get_permission_service",
    "get_rbac_service",
]
