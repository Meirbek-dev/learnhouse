"""
Simplified Permission System

This module provides a clean, focused permission system that replaces
the overcomplicated UnifiedPermissionService.

Key components:
- PermissionChecker: Core permission checking logic
- OwnershipChecker: Resource ownership verification
- PermissionCache: Redis caching layer
- AuditLogger: Tiered audit logging
- Exceptions: Standardized error responses
- Dependencies: FastAPI dependency injection

Usage:
    from src.security.permissions import (
        PermissionChecker,
        require_permission,
        PermissionDenied,
    )
    from src.db.permissions.generated_enums import Action, ResourceType, Scope

    # In routes:
    @router.post("/courses")
    async def create_course(
        _: Annotated[None, Depends(require_permission(
            Action.CREATE,
            ResourceType.COURSE,
            Scope.ORG
        ))],
    ):
        # Permission already checked
        ...

    # In services:
    async def update_course(checker: PermissionChecker, user: PublicUser):
        await checker.require(user, Action.UPDATE, ResourceType.COURSE)
        # ... business logic
"""

from src.security.permissions.audit import AuditLogger
from src.security.permissions.cache import PermissionCache, get_permission_cache
from src.security.permissions.checker import PermissionChecker, get_permission_checker
from src.security.permissions.dependencies import (
    CurrentUserDep,
    PermissionCheckerDep,
    require_all_permissions,
    require_any_permission,
    require_authentication,
    require_permission,
)
from src.security.permissions.exceptions import (
    AuthenticationRequired,
    InsufficientRole,
    PermissionDenied,
    ResourceNotFound,
)
from src.security.permissions.ownership import OwnershipChecker

__all__ = [
    # Core classes
    "PermissionChecker",
    "OwnershipChecker",
    "PermissionCache",
    "AuditLogger",
    # Exceptions
    "PermissionDenied",
    "AuthenticationRequired",
    "InsufficientRole",
    "ResourceNotFound",
    # Dependencies
    "require_permission",
    "require_any_permission",
    "require_all_permissions",
    "require_authentication",
    "PermissionCheckerDep",
    "CurrentUserDep",
    # Functions
    "get_permission_checker",
    "get_permission_cache",
]
