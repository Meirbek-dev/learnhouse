"""
RBAC Service

Core permission checking and role management.

Usage:
    from src.services.rbac import RBACService, get_rbac_service

    # Via dependency injection
    rbac = Depends(get_rbac_service)
    result = rbac.check(user_id=123, action="update", resource="course", org_id=1)

    # Direct instantiation
    rbac = RBACService(db_session)
    result = rbac.check(user_id=123, action="update", resource="course")
"""

from src.services.rbac.audit import AuditService
from src.services.rbac.cache import CacheService
from src.services.rbac.dependencies import get_rbac_service
from src.services.rbac.service import CheckResult, PermissionCheck, RBACService

__all__ = [
    "AuditService",
    "CacheService",
    "CheckResult",
    "PermissionCheck",
    "RBACService",
    "get_rbac_service",
]
