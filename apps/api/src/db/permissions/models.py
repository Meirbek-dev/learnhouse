"""
Database models for the RBAC permission system.

This module defines the SQLModel tables for:
- permissions: Individual permission definitions
- roles_new: Role definitions with hierarchy support
- role_permissions: Junction table for role-permission assignments
- user_roles: User-role assignments per organization
- resource_permissions: Resource-level permission overrides
"""

from datetime import datetime, UTC

from pydantic import ConfigDict, field_validator
from sqlalchemy import JSON, Column, ForeignKey, Index, Integer, UniqueConstraint
from sqlmodel import Field

from src.db.permissions.enums import Action, ResourceType, Scope
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


class RoleNewBase(SQLModelStrictBaseModel):
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


class RoleNew(RoleNewBase, table=True):
    """New Role table with hierarchy support."""

    __tablename__ = "roles_new"
    __table_args__ = (
        UniqueConstraint("slug", "org_id", name="uq_role_slug_org"),
        Index("ix_roles_new_org_id", "org_id"),
        Index("ix_roles_new_slug", "slug"),
    )

    id: int | None = Field(default=None, primary_key=True)
    org_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")),
        description="Organization ID (NULL for global roles)",
    )
    parent_role_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("roles_new.id", ondelete="SET NULL")),
        description="Parent role for hierarchy inheritance",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RoleNewCreate(RoleNewBase):
    """Model for creating a new role."""

    org_id: int | None = None
    parent_role_id: int | None = None


class RoleNewRead(RoleNewBase):
    """Model for reading a role with full details."""

    id: int
    org_id: int | None
    parent_role_id: int | None
    created_at: datetime
    updated_at: datetime


class RoleNewUpdate(SQLModelStrictBaseModel):
    """Model for updating a role."""

    name: str | None = None
    description: str | None = None
    parent_role_id: int | None = None
    priority: int | None = None


# ---------------------------------------------------------------------------
# Role-Permission Junction
# ---------------------------------------------------------------------------


class RolePermissionBase(SQLModelStrictBaseModel):
    """Base model for role-permission assignment."""

    model_config = ConfigDict(use_enum_values=True)

    conditions: dict | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="ABAC conditions for this permission (optional)",
    )


class RolePermission(RolePermissionBase, table=True):
    """Junction table for role-permission assignments."""

    __tablename__ = "role_permissions"
    __table_args__ = (Index("ix_role_permissions_role_id", "role_id"),)

    role_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("roles_new.id", ondelete="CASCADE"), primary_key=True
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
    """Model for assigning a permission to a role."""

    role_id: int
    permission_id: int
    conditions: dict | None = None


# ---------------------------------------------------------------------------
# User-Role Assignment
# ---------------------------------------------------------------------------


class UserRoleBase(SQLModelStrictBaseModel):
    """Base model for user-role assignment."""


class UserRole(UserRoleBase, table=True):
    """User-role assignment per organization."""

    __tablename__ = "user_roles"
    __table_args__ = (
        Index("ix_user_roles_user_id", "user_id"),
        Index("ix_user_roles_org_id", "org_id"),
    )

    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
        ),
    )
    role_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("roles_new.id", ondelete="CASCADE"), primary_key=True
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
    """Model for assigning a role to a user."""

    role_id: int
    org_id: int
    expires_at: datetime | None = None


class UserRoleAssign(SQLModelStrictBaseModel):
    """Model for assigning a role to a user (with user_id for batch operations)."""

    user_id: int
    role_id: int
    org_id: int
    expires_at: datetime | None = None


class UserRoleRead(SQLModelStrictBaseModel):
    """Model for reading user-role assignment."""

    user_id: int
    role_id: int
    org_id: int
    granted_at: datetime
    granted_by: int | None
    expires_at: datetime | None
    role: RoleNewRead | None = None


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
# Composite Response Models
# ---------------------------------------------------------------------------


class RoleWithPermissions(RoleNewRead):
    """Role with its assigned permissions."""

    permissions: list[PermissionRead] = []


class UserPermissionsResponse(PydanticStrictBaseModel):
    """Response model for user's effective permissions."""

    model_config = ConfigDict(use_enum_values=True)

    user_id: int
    org_id: int | None
    roles: list[RoleNewRead]
    permissions: dict[str, bool]  # e.g., {"course:create:org": True, ...}
    resource_permissions: list[ResourcePermissionRead]
