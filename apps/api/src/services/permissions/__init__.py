"""
Permission services - RBAC v2.

This module redirects to the new RBAC service.
All legacy permission code has been removed.

Usage:
    from src.services.rbac import RBACService, get_rbac_service

    # Or for backwards compatibility:
    from src.services.permissions import get_permission_service
"""

# Re-export from new RBAC service for backwards compatibility
from src.services.rbac.service import RBACService
from src.services.rbac.dependencies import get_rbac_service
from src.services.rbac.audit import AuditService
from src.services.rbac.cache import CacheService

# Backwards compatible aliases
PermissionService = RBACService
get_permission_service = get_rbac_service


# ============================================================================
# Cache Invalidation (backwards compatible)
# ============================================================================

class PermissionCache:
    """Backwards compatible permission cache interface."""

    @staticmethod
    def invalidate_user_permissions(user_id: int):
        """Invalidate cache for a specific user."""
        try:
            cache = CacheService()
            cache.invalidate_user(user_id)
        except Exception:
            pass  # Redis down, ignore

    @staticmethod
    def invalidate_role_permissions(role_id: int):
        """Invalidate cache for a specific role."""
        try:
            cache = CacheService()
            cache.invalidate_role(role_id)
        except Exception:
            pass  # Redis down, ignore

    @staticmethod
    def invalidate_org_permissions(org_id: int):
        """Invalidate cache for a specific org."""
        try:
            cache = CacheService()
            cache.invalidate_org(org_id)
        except Exception:
            pass  # Redis down, ignore


# Singleton for backwards compatibility
permission_cache = PermissionCache()


__all__ = [
    # New RBAC service
    "RBACService",
    "get_rbac_service",
    "AuditService",
    "CacheService",
    # Backwards compatible aliases
    "PermissionService",
    "get_permission_service",
    # Cache interface
    "permission_cache",
    "PermissionCache",
]
