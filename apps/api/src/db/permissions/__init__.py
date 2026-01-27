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
    RolePermission,
    RolePermissionCreate,
    RoleRead,
    RoleUpdate,
    RoleWithPermissions,
    UserPermissionsResponse,
    UserRole,
    UserRoleAssign,
    UserRoleCreate,
    UserRoleRead,
)

__all__ = [
    "ADMIN_OR_MAINTAINER_SLUGS",
    "ADMIN_ROLE_SLUGS",
    "CONTENT_CREATOR_SLUGS",
    "INSTRUCTOR_OR_HIGHER_SLUGS",
    # Enums
    "Action",
    "AuditAction",
    "AuditLevel",
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
    # Role-Permission junction
    "RolePermission",
    "RolePermissionCreate",
    "RoleRead",
    # Constants
    "RoleSlug",
    "RoleUpdate",
    # Composite models
    "RoleWithPermissions",
    "Scope",
    "UserPermissionsResponse",
    # User-Role assignment
    "UserRole",
    "UserRoleAssign",
    "UserRoleCreate",
    "UserRoleRead",
    "is_admin_or_maintainer_role",
    "is_admin_role",
    "is_content_creator_role",
    "is_instructor_or_higher_role",
]
