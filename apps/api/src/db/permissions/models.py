"""
Database models for the RBAC permission system.

This module defines the SQLModel tables for:
- permissions: Individual permission definitions
- roles: Role definitions with hierarchy support
- role_permissions: Junction table for role-permission assignments
- user_roles: User-role assignments per organization
- resource_permissions: Resource-level permission overrides
"""

from datetime import UTC, datetime

from pydantic import ConfigDict, field_validator
from sqlalchemy import JSON, Column, ForeignKey, Index, Integer, UniqueConstraint
from sqlmodel import Field

from src.db.permissions.generated_enums import Action, ResourceType, Scope
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel

# ---------------------------------------------------------------------------
# Permission Model
# ---------------------------------------------------------------------------


class PermissionBase(SQLModelStrictBaseModel):
    """Base model for Permission."""

    model_config = ConfigDict(use_enum_values=True)

    name: str = Field(
        max_length=100, description="Unique permission name, e.g., 'course:create:org'"
    )
    resource_type: ResourceType = Field(
        description="Type of resource this permission applies to"
    )
    action: Action = Field(description="Action this permission allows")
    scope: Scope = Field(default=Scope.ALL, description="Scope of the permission")
    description: str | None = Field(
        default=None, description="Human-readable description"
    )


class Permission(PermissionBase, table=True):
    """Permission table - defines individual permissions."""

    __tablename__ = "permissions"

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("resource_type", mode="before")
    @classmethod
    def validate_resource_type(cls, v):
        if isinstance(v, str):
            return ResourceType(v)
        return v

    @field_validator("action", mode="before")
    @classmethod
    def validate_action(cls, v):
        if isinstance(v, str):
            return Action(v)
        return v

    @field_validator("scope", mode="before")
    @classmethod
    def validate_scope(cls, v):
        if isinstance(v, str):
            return Scope(v)
        return v


class PermissionCreate(PermissionBase):
    """Model for creating a new permission."""


class PermissionRead(PermissionBase):
    """Model for reading a permission."""

    id: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Role Model (New - with hierarchy)
# ---------------------------------------------------------------------------


class RoleBase(SQLModelStrictBaseModel):
    """Base model for the new Role system with hierarchy support."""

    model_config = ConfigDict(use_enum_values=True)

    name: str = Field(max_length=100, description="Role display name")
    slug: str = Field(
        max_length=100, description="Unique role slug, e.g., 'org-admin', 'instructor'"
    )
    description: str | None = Field(default=None, description="Role description")
    is_system: bool = Field(
        default=False, description="Whether this is a built-in system role"
    )
    priority: int = Field(
        default=0,
        description="Role priority for conflict resolution (higher = more privileged)",
    )


class Role(RoleBase, table=True):
    """New Role table with hierarchy support."""

    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("slug", "org_id", name="uq_role_slug_org"),
        Index("ix_roles_org_id", "org_id"),
        Index("ix_roles_slug", "slug"),
    )

    id: int | None = Field(default=None, primary_key=True)
    org_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")),
        description="Organization ID (NULL for global roles)",
    )
    parent_role_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("roles.id", ondelete="SET NULL")),
        description="Parent role for hierarchy inheritance",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RoleCreate(RoleBase):
    """Model for creating a new role."""

    org_id: int | None = None
    parent_role_id: int | None = None


class RoleRead(RoleBase):
    """Model for reading a role with full details."""

    id: int
    org_id: int | None
    parent_role_id: int | None
    created_at: datetime
    updated_at: datetime


class RoleUpdate(SQLModelStrictBaseModel):
    """Model for updating a role."""

    name: str | None = None
    description: str | None = None
    parent_role_id: int | None = None
    priority: int | None = None


# ---------------------------------------------------------------------------

# Role-Permission Junction (DEPRECATED - Replaced by user_permissions)
# ---------------------------------------------------------------------------
# NOTE: These models are kept for backward compatibility during migration.
# They will be removed once rbac_schema_flatten migration is applied.
# New code should use UserPermission instead.


class RolePermissionBase(SQLModelStrictBaseModel):
    """Base model for role-permission assignment. DEPRECATED."""

    model_config = ConfigDict(use_enum_values=True)

    conditions: dict | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="ABAC conditions for this permission (optional)",
    )


class RolePermission(RolePermissionBase, table=True):
    """Junction table for role-permission assignments. DEPRECATED - Use UserPermission."""

    __tablename__ = "role_permissions"
    __table_args__ = (Index("ix_role_permissions_role_id", "role_id"),)

    role_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    permission_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    granted_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    granted_by: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
    )


class RolePermissionCreate(SQLModelStrictBaseModel):
    """Model for assigning a permission to a role. DEPRECATED."""

    role_id: int
    permission_id: int
    conditions: dict | None = None


# ---------------------------------------------------------------------------
# User-Role Assignment (DEPRECATED - Replaced by user_permissions)
# ---------------------------------------------------------------------------
# NOTE: These models are kept for backward compatibility during migration.
# They will be removed once rbac_schema_flatten migration is applied.
# New code should use UserPermission instead.


class UserRoleBase(SQLModelStrictBaseModel):
    """Base model for user-role assignment. DEPRECATED."""


class UserRole(UserRoleBase, table=True):
    """User-role assignment per organization. DEPRECATED - Use UserPermission."""

    __tablename__ = "user_roles"
    __table_args__ = (
        Index("ix_user_roles_user_id", "user_id"),
        Index("ix_user_roles_org_id", "org_id"),
        Index(
            "ix_user_roles_user_org", "user_id", "org_id"
        ),  # Composite index for common lookups
    )

    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    role_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("organization.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    granted_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    granted_by: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
    )
    expires_at: datetime | None = Field(
        default=None, description="Optional role expiry"
    )


class UserRoleCreate(SQLModelStrictBaseModel):
    """Model for assigning a role to a user. DEPRECATED."""

    role_id: int
    org_id: int
    expires_at: datetime | None = None


class UserRoleAssign(SQLModelStrictBaseModel):
    """Model for assigning a role to a user (with user_id for batch operations). DEPRECATED."""

    user_id: int
    role_id: int
    org_id: int
    expires_at: datetime | None = None


class UserRoleRead(SQLModelStrictBaseModel):
    """Model for reading user-role assignment. DEPRECATED."""

    user_id: int
    role_id: int
    org_id: int
    granted_at: datetime
    granted_by: int | None
    expires_at: datetime | None
    role: RoleRead | None = None


# ---------------------------------------------------------------------------
# User Permissions (NEW - Replaces user_roles + role_permissions)
# ---------------------------------------------------------------------------


class UserPermissionBase(SQLModelStrictBaseModel):
    """Base model for flattened user permissions."""

    model_config = ConfigDict(use_enum_values=True)

    scope: Scope = Field(description="Permission scope (all, org, own, assigned)")


class UserPermission(UserPermissionBase, table=True):
    """Flattened user permissions - replaces user_roles + role_permissions junction tables.

    This table denormalizes the relationship between users, roles, and permissions
    for better query performance (1 join instead of 3).

    Migration: Created by rbac_schema_flatten migration which expands
    user_roles + role_permissions into individual user-permission entries.
    """

    __tablename__ = "user_permissions"
    __table_args__ = (
        Index("idx_user_perms_lookup", "user_id", "org_id"),  # Primary lookup
        Index("idx_user_perms_permission", "permission_id"),  # Permission queries
        Index("idx_user_perms_role", "granted_via_role_id"),  # Audit queries
    )

    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
        ),
        description="User ID",
    )
    permission_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
        ),
        description="Permission ID",
    )
    org_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("organization.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        description="Organization ID",
    )
    granted_via_role_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("roles.id", ondelete="SET NULL")),
        description="Role that granted this permission (NULL for direct assignments) - preserves audit trail",
    )
    granted_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="When permission was granted",
    )
    expires_at: datetime | None = Field(
        default=None, description="Optional permission expiry"
    )

    @field_validator("scope", mode="before")
    @classmethod
    def validate_scope(cls, v):
        if isinstance(v, str):
            return Scope(v)
        return v


class UserPermissionCreate(SQLModelStrictBaseModel):
    """Model for creating a user permission."""

    model_config = ConfigDict(use_enum_values=True)

    user_id: int
    permission_id: int
    org_id: int
    scope: Scope
    granted_via_role_id: int | None = None
    expires_at: datetime | None = None


class UserPermissionRead(UserPermissionBase):
    """Model for reading a user permission."""

    user_id: int
    permission_id: int
    org_id: int
    granted_via_role_id: int | None
    granted_at: datetime
    expires_at: datetime | None
    permission: PermissionRead | None = None  # Can include permission details


# ---------------------------------------------------------------------------
# Resource-Level Permissions
# ---------------------------------------------------------------------------


class ResourcePermissionBase(SQLModelStrictBaseModel):
    """Base model for resource-level permission overrides."""

    model_config = ConfigDict(use_enum_values=True)

    resource_type: ResourceType = Field(description="Type of resource")
    resource_id: str = Field(
        max_length=100, description="UUID of the specific resource"
    )


class ResourcePermission(ResourcePermissionBase, table=True):
    """Resource-level permission overrides for specific resources."""

    __tablename__ = "resource_permissions"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "resource_type",
            "resource_id",
            "permission_id",
            name="uq_resource_permission",
        ),
        Index(
            "ix_resource_permissions_user_resource",
            "user_id",
            "resource_type",
            "resource_id",
        ),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE")),
    )
    permission_id: int = Field(
        sa_column=Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE")),
    )
    granted_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    granted_by: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
    )
    expires_at: datetime | None = Field(default=None)

    @field_validator("resource_type", mode="before")
    @classmethod
    def validate_resource_type(cls, v):
        if isinstance(v, str):
            return ResourceType(v)
        return v


class ResourcePermissionCreate(SQLModelStrictBaseModel):
    """Model for creating a resource-level permission."""

    model_config = ConfigDict(use_enum_values=True)

    user_id: int
    resource_type: ResourceType
    resource_id: str
    permission_id: int
    expires_at: datetime | None = None


class ResourcePermissionRead(ResourcePermissionBase):
    """Model for reading a resource-level permission."""

    id: int
    user_id: int
    permission_id: int
    granted_at: datetime
    granted_by: int | None
    expires_at: datetime | None


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
    resource_permissions: list[ResourcePermissionRead]
