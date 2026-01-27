"""
Permission models and enums for the RBAC system.

This module provides the core data models for the Role-Based Access Control system,
including permissions, roles, user-role assignments, and audit logging.
"""

from src.db.permissions.audit import PermissionAuditLog
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
    PermissionErrorCode,
    ResourceType,
    Scope,
)
from src.db.permissions.models import (
    BatchPermissionCheckRequest,
    BatchPermissionCheckResponse,
    Permission,
    PermissionCheckRequest,
    PermissionCheckResult,
    PermissionCreate,
    PermissionRead,
    ResourcePermission,
    ResourcePermissionCreate,
    ResourcePermissionRead,
    Role,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    RolePermission,
    RolePermissionCreate,
    RoleWithPermissions,
    UserPermissionsResponse,
    UserRole,
    UserRoleAssign,
    UserRoleCreate,
    UserRoleRead,
)

__all__ = [
    # Enums
    "Action",
    "AuditAction",
    # Batch permission check models
    "BatchPermissionCheckRequest",
    "BatchPermissionCheckResponse",
    # Permission models
    "Permission",
    # Audit
    "PermissionAuditLog",
    "PermissionCheckRequest",
    "PermissionCheckResult",
    "PermissionCreate",
    "PermissionErrorCode",
    "PermissionRead",
    # Resource-level permissions
    "ResourcePermission",
    "ResourcePermissionCreate",
    "ResourcePermissionRead",
    "ResourceType",
    # Role models (new names)
    "Role",
    "RoleCreate",
    "RoleRead",
    "RoleUpdate",
    # Role-Permission junction
    "RolePermission",
    "RolePermissionCreate",
    # Composite models
    "RoleWithPermissions",
    "Scope",
    "UserPermissionsResponse",
    # User-Role assignment
    "UserRole",
    "UserRoleAssign",
    "UserRoleCreate",
    "UserRoleRead",
    # Constants
    "RoleSlug",
    "ADMIN_ROLE_SLUGS",
    "ADMIN_OR_MAINTAINER_SLUGS",
    "INSTRUCTOR_OR_HIGHER_SLUGS",
    "CONTENT_CREATOR_SLUGS",
    "is_admin_role",
    "is_admin_or_maintainer_role",
    "is_instructor_or_higher_role",
    "is_content_creator_role",
]
