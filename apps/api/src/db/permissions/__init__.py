"""
Permission models and enums for the RBAC system.

This module provides the core data models for the Role-Based Access Control system,
including permissions, roles, user-role assignments, and audit logging.
"""

from src.db.permissions.audit import PermissionAuditLog
from src.db.permissions.enums import Action, ResourceType, Scope
from src.db.permissions.models import (
    Permission,
    PermissionCreate,
    PermissionRead,
    ResourcePermission,
    ResourcePermissionCreate,
    ResourcePermissionRead,
    RoleNew,
    RoleNewCreate,
    RoleNewRead,
    RoleNewUpdate,
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
    # Permission models
    "Permission",
    # Audit
    "PermissionAuditLog",
    "PermissionCreate",
    "PermissionRead",
    # Resource-level permissions
    "ResourcePermission",
    "ResourcePermissionCreate",
    "ResourcePermissionRead",
    "ResourceType",
    # Role models
    "RoleNew",
    "RoleNewCreate",
    "RoleNewRead",
    "RoleNewUpdate",
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
