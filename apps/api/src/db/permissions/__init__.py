"""
Permission models and enums for the RBAC system.

This module provides the core data models for the Role-Based Access Control system,
including permissions, roles, user-role assignments, and audit logging.
"""

from src.db.permissions.audit import PermissionAuditLog
from src.db.permissions.enums import Action, ResourceType, Scope
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
]
