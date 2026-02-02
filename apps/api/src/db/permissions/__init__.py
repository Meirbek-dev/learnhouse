"""
Permission models and enums for the RBAC system.

This module provides the core data models for the Role-Based Access Control system.
RBAC v2 is the only supported system - all legacy tables have been removed.

For v2 table models, import from src.db.permissions.models_v2:
- PermissionV2, RoleV2, UserRoleV2, RolePermissionV2, PermissionAuditLogV2
"""

from src.db.permissions.constants import (
    ADMIN_OR_MAINTAINER_SLUGS,
    ADMIN_ROLE_SLUGS,
    CONTENT_CREATOR_SLUGS,
    INSTRUCTOR_OR_HIGHER_SLUGS,
    RoleSlug,
    is_admin_or_maintainer_role,
    is_admin_role,
    is_content_creator_role,
    is_instructor_or_higher_role,
)
from src.db.permissions.enums import (
    Action,
    AuditAction,
    ResourceType,
    Scope,
)
# API Models (Pydantic schemas for request/response)
from src.db.permissions.models import (
    BatchPermissionCheckRequest,
    BatchPermissionCheckResponse,
    PermissionCheckRequest,
    PermissionCheckResult,
    PermissionRead,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    RoleWithPermissions,
    UserPermissionsResponse,
)

__all__ = [
    # Constants
    "ADMIN_OR_MAINTAINER_SLUGS",
    "ADMIN_ROLE_SLUGS",
    "CONTENT_CREATOR_SLUGS",
    "INSTRUCTOR_OR_HIGHER_SLUGS",
    "RoleSlug",
    "is_admin_or_maintainer_role",
    "is_admin_role",
    "is_content_creator_role",
    "is_instructor_or_higher_role",
    # Enums
    "Action",
    "AuditAction",
    "ResourceType",
    "Scope",
    # API Models (Request/Response schemas)
    "BatchPermissionCheckRequest",
    "BatchPermissionCheckResponse",
    "PermissionCheckRequest",
    "PermissionCheckResult",
    "PermissionRead",
    "RoleCreate",
    "RoleRead",
    "RoleUpdate",
    "RoleWithPermissions",
    "UserPermissionsResponse",
]
