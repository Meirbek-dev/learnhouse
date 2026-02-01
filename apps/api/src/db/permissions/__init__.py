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
from src.db.permissions.errors import (
    AuthenticationRequiredError,
    PermissionDeniedError,
    PermissionErrorDetail,
    ResourceNotFoundError,
    raise_authentication_required,
    raise_permission_denied,
    raise_resource_not_found,
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
    RoleWithPermissions,
    UserPermission,
    UserPermissionCreate,
    UserPermissionRead,
    UserPermissionsResponse,
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
    # Error classes
    "AuthenticationRequiredError",
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
    "PermissionDeniedError",
    "PermissionErrorCode",
    "PermissionErrorDetail",
    "PermissionRead",
    # Resource-level permissions
    "ResourceNotFoundError",
    "ResourcePermission",
    "ResourcePermissionCreate",
    "ResourcePermissionRead",
    "ResourceType",
    # Role models
    "Role",
    "RoleCreate",
    "RoleRead",
    # Constants
    "RoleSlug",
    "RoleUpdate",
    # Composite models
    "RoleWithPermissions",
    "Scope",
    # User permissions (new flattened schema)
    "UserPermission",
    "UserPermissionCreate",
    "UserPermissionRead",
    "UserPermissionsResponse",
    "is_admin_or_maintainer_role",
    "is_admin_role",
    "is_content_creator_role",
    "is_instructor_or_higher_role",
    "raise_authentication_required",
    "raise_permission_denied",
    "raise_resource_not_found",
]
