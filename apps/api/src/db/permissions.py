"""
RBAC Database Models & API Schemas

Single source of truth for all permission-related tables and Pydantic models.
"""

from datetime import UTC, datetime

from pydantic import ConfigDict, field_validator
from sqlalchemy import Column, ForeignKey, Index, Integer, UniqueConstraint
from sqlmodel import Field

from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel

# ============================================================================
# Enums - generated from shared/permissions.yaml
# ============================================================================
# These are imported from the generated file and re-exported here
# so the entire codebase can do: from src.db.permissions import Action, ResourceType, ...

from src.db.permission_enums import (  # noqa: E402
    Action,
    ResourceType,
    RoleSlug,
    Scope,
    SYSTEM_ROLES,
)

# ============================================================================
# Permission Table
# ============================================================================


class Permission(SQLModelStrictBaseModel, table=True):
    """Permission definition. Each row is a {resource}:{action}:{scope} triple."""

    __tablename__ = "permissions"
    __table_args__ = (
        Index("idx_permissions_resource_action", "resource_type", "action"),
        Index("idx_permissions_name", "name", unique=True),
    )

    model_config = ConfigDict(use_enum_values=True)

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=100, description="resource:action:scope")
    resource_type: str = Field(max_length=50)
    action: str = Field(max_length=50)
    scope: str = Field(max_length=50)
    description: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    @field_validator("name")
    @classmethod
    def validate_permission_format(cls, v: str) -> str:
        """Enforce 3-part 'resource:action:scope' format."""
        parts = v.split(":")
        if len(parts) != 3:
            raise ValueError(
                f"Permission name must be in format 'resource:action:scope', got: {v}"
            )
        resource, action, scope = parts
        if not all([resource, action, scope]):
            raise ValueError(
                f"Permission name parts cannot be empty, got: {v}"
            )
        return v


# ============================================================================
# Role Table
# ============================================================================


class Role(SQLModelStrictBaseModel, table=True):
    """Role definition. System roles have is_system=True and org_id=NULL."""

    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("slug", "org_id", name="uq_roles_slug_org"),
        Index("idx_roles_org_id", "org_id"),
        Index("idx_roles_slug", "slug"),
    )

    model_config = ConfigDict(use_enum_values=True)

    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(max_length=100)
    name: str = Field(max_length=100)
    description: str | None = Field(default=None)
    is_system: bool = Field(default=False)
    priority: int = Field(default=0)
    org_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")),
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# RolePermission Junction
# ============================================================================


class RolePermission(SQLModelStrictBaseModel, table=True):
    """Many-to-many: which permissions belong to which roles."""

    __tablename__ = "role_permissions"
    __table_args__ = (
        Index("idx_role_permissions_role", "role_id"),
        Index("idx_role_permissions_permission", "permission_id"),
    )

    role_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
        )
    )
    permission_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
        )
    )
    granted_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# UserRole Table
# ============================================================================


class UserRole(SQLModelStrictBaseModel, table=True):
    """Which users have which roles in which orgs."""

    __tablename__ = "user_roles"
    __table_args__ = (
        Index("idx_user_roles_user_org", "user_id", "org_id"),
        Index("idx_user_roles_role", "role_id"),
    )

    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
        )
    )
    role_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True
        )
    )
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("organization.id", ondelete="CASCADE"), primary_key=True
        )
    )
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    assigned_by: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
    )


# ============================================================================
# Pydantic API Schemas
# ============================================================================


class RoleCreate(PydanticStrictBaseModel):
    slug: str
    name: str
    description: str | None = None
    org_id: int  # Required - custom roles must belong to an org


class RoleRead(PydanticStrictBaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: int
    slug: str
    name: str
    description: str | None = None
    is_system: bool = False
    priority: int = 0
    org_id: int | None = None
    created_at: datetime
    updated_at: datetime


class RoleUpdate(PydanticStrictBaseModel):
    name: str | None = None
    description: str | None = None
    priority: int | None = None


class PermissionRead(PydanticStrictBaseModel):
    model_config = ConfigDict(from_attributes=True, use_enum_values=True)

    id: int
    name: str
    resource_type: str
    action: str
    scope: str
    description: str | None = None


# ============================================================================
# Re-exports for convenience
# ============================================================================

__all__ = [
    # Enums
    "Action",
    "ResourceType",
    "Scope",
    "RoleSlug",
    "SYSTEM_ROLES",
    # Tables
    "Permission",
    "Role",
    "RolePermission",
    "UserRole",
    # Schemas
    "RoleCreate",
    "RoleRead",
    "RoleUpdate",
    "PermissionRead",
]
