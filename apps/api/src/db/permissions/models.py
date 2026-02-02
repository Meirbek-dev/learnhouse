"""
API Models for the RBAC permission system.

This module defines Pydantic models for API requests/responses.
For database table models, use models_v2.py (PermissionV2, RoleV2, UserRoleV2, etc.)

LEGACY TABLES REMOVED:
- Permission -> Use PermissionV2
- Role -> Use RoleV2
- UserPermission -> Use UserRoleV2
- ResourcePermission -> Feature never implemented, removed
"""

from datetime import datetime

from pydantic import ConfigDict

from src.db.permissions.generated_enums import Action, ResourceType, Scope
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel

# ---------------------------------------------------------------------------
# Permission API Models
# ---------------------------------------------------------------------------


class PermissionBase(SQLModelStrictBaseModel):
    """Base model for Permission."""

    model_config = ConfigDict(use_enum_values=True)

    name: str
    resource_type: ResourceType
    action: Action
    scope: Scope = Scope.ALL
    description: str | None = None


class PermissionRead(PermissionBase):
    """Model for reading a permission."""

    id: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Role API Models
# ---------------------------------------------------------------------------


class RoleBase(SQLModelStrictBaseModel):
    """Base model for Role."""

    model_config = ConfigDict(use_enum_values=True)

    name: str
    slug: str
    description: str | None = None
    is_system: bool = False
    priority: int = 0


class RoleCreate(RoleBase):
    """Model for creating a new role."""

    org_id: int | None = None
    parent_role_id: int | None = None


class RoleRead(RoleBase):
    """Model for reading a role with full details."""

    id: int
    org_id: int | None
    parent_role_id: int | None = None
    created_at: datetime
    updated_at: datetime


class RoleUpdate(SQLModelStrictBaseModel):
    """Model for updating a role."""

    name: str | None = None
    description: str | None = None
    parent_role_id: int | None = None
    priority: int | None = None


# ---------------------------------------------------------------------------
# Permission Check Request/Response Models
# ---------------------------------------------------------------------------


class PermissionCheckRequest(PydanticStrictBaseModel):
    """Request model for a single permission check."""

    model_config = ConfigDict(use_enum_values=True)

    action: Action
    resource: ResourceType
    resource_id: str | None = None
    org_id: int | None = None


class PermissionCheckResult(PydanticStrictBaseModel):
    """Result of a single permission check."""

    model_config = ConfigDict(use_enum_values=True)

    action: Action
    resource: ResourceType
    resource_id: str | None = None
    org_id: int | None = None
    allowed: bool


class BatchPermissionCheckRequest(PydanticStrictBaseModel):
    """Request model for batch permission checks."""

    checks: list[PermissionCheckRequest]


class BatchPermissionCheckResponse(PydanticStrictBaseModel):
    """Response model for batch permission checks."""

    results: list[PermissionCheckResult]
    # Convenience dict mapping "resource:action[:resource_id]" -> allowed
    permissions: dict[str, bool]


# ---------------------------------------------------------------------------
# Composite Response Models
# ---------------------------------------------------------------------------


class RoleWithPermissions(RoleRead):
    """Role with its assigned permissions."""

    permissions: list[PermissionRead] = []


class UserPermissionsResponse(PydanticStrictBaseModel):
    """Response model for user's effective permissions."""

    model_config = ConfigDict(use_enum_values=True)

    user_id: int
    org_id: int | None
    roles: list[RoleRead]
    permissions: dict[str, bool]  # e.g., {"course:create:org": True, ...}
    # Note: resource_permissions feature was never implemented
    resource_permissions: list = []
