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
    # Enums
    "Action",
    "AuditAction",
    # API Models (Request/Response schemas)
    "BatchPermissionCheckRequest",
    "BatchPermissionCheckResponse",
    "PermissionCheckRequest",
    "PermissionCheckResult",
    "PermissionRead",
    "ResourceType",
    "RoleCreate",
    "RoleRead",
    "RoleSlug",
    "RoleUpdate",
    "RoleWithPermissions",
    "Scope",
    "UserPermissionsResponse",
    "is_admin_or_maintainer_role",
    "is_admin_role",
    "is_content_creator_role",
    "is_instructor_or_higher_role",
]
