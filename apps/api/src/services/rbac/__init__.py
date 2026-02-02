"""
RBAC v2 Service - Production Ready

This module provides the new, clean RBAC implementation.

Key components:
- RBACService: Core permission checking and role management
- CacheService: Redis-based caching with invalidation
- AuditService: Security event logging
- Metrics: Prometheus instrumentation

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
from src.services.rbac.service import PermissionCheck, RBACService, CheckResult

__all__ = [
    "RBACService",
    "CacheService",
    "AuditService",
    "PermissionCheck",
    "CheckResult",
    "get_rbac_service",
]
