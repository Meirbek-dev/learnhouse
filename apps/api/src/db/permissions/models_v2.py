
from datetime import UTC, datetime

from pydantic import ConfigDict
from sqlalchemy import Column, ForeignKey, Index, Integer, UniqueConstraint
from sqlmodel import Field

from src.db.strict_base_model import SQLModelStrictBaseModel

# ============================================================================
# Permission Model
# ============================================================================


class PermissionBase(SQLModelStrictBaseModel):
    """Base model for Permission."""

    model_config = ConfigDict(use_enum_values=True)

    name: str = Field(
        max_length=100, description="Permission name: resource:action:scope"
    )
    resource_type: str = Field(
        max_length=50, description="Resource type (course, user, etc.)"
    )
    action: str = Field(
        max_length=50, description="Action (create, read, update, delete, etc.)"
    )
    scope: str = Field(max_length=50, description="Scope (all, org, own)")
    description: str | None = Field(
        default=None, description="Human-readable description"
    )
    category: str | None = Field(
        default=None, max_length=50, description="Permission category"
    )
    is_dangerous: bool = Field(default=False, description="Requires extra confirmation")


class Permission(PermissionBase, table=True):
    """Permission table."""

    __tablename__ = "permissions_v2"
    __table_args__ = (
        Index("idx_permissions_v2_resource_action", "resource_type", "action"),
        Index("idx_permissions_v2_scope", "scope"),
        Index("idx_permissions_v2_category", "category"),
    )

    id: int | None = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Role Model
# ============================================================================


class RoleBase(SQLModelStrictBaseModel):
    """Base model for Role."""

    model_config = ConfigDict(use_enum_values=True)

    slug: str = Field(max_length=100, description="Unique role slug")
    name: str = Field(max_length=100, description="Role display name")
    description: str | None = Field(default=None, description="Role description")
    is_system: bool = Field(
        default=False, description="System role (cannot be deleted)"
    )
    priority: int = Field(
        default=0, description="Role priority (higher = more privileged)"
    )


class Role(RoleBase, table=True):
    """Role table."""

    __tablename__ = "roles_v2"
    __table_args__ = (
        UniqueConstraint("slug", "org_id", name="uq_roles_v2_slug_org"),
        Index("idx_roles_v2_org_id", "org_id"),
        Index("idx_roles_v2_slug", "slug"),
        Index("idx_roles_v2_system", "is_system"),
    )

    id: int | None = Field(default=None, primary_key=True)
    org_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE")),
        description="Organization ID (NULL for global roles)",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# RolePermission Junction Table
# ============================================================================


class RolePermission(SQLModelStrictBaseModel, table=True):
    """Role-Permission assignment table."""

    __tablename__ = "role_permissions_v2"
    __table_args__ = (
        Index("idx_role_permissions_v2_role", "role_id"),
        Index("idx_role_permissions_v2_permission", "permission_id"),
    )

    role_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("roles_v2.id", ondelete="CASCADE"), primary_key=True
        )
    )
    permission_id: int = Field(
        sa_column=Column(
            Integer,
            ForeignKey("permissions_v2.id", ondelete="CASCADE"),
            primary_key=True,
        )
    )
    granted_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    granted_by_user_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
    )


# ============================================================================
# UserRole Table
# ============================================================================


class UserRole(SQLModelStrictBaseModel, table=True):
    """User-Role assignment table."""

    __tablename__ = "user_roles_v2"
    __table_args__ = (
        Index("idx_user_roles_v2_user_org", "user_id", "org_id"),
        Index("idx_user_roles_v2_role", "role_id"),
    )

    user_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True
        )
    )
    role_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("roles_v2.id", ondelete="CASCADE"), primary_key=True
        )
    )
    org_id: int = Field(
        sa_column=Column(
            Integer, ForeignKey("organization.id", ondelete="CASCADE"), primary_key=True
        )
    )
    assigned_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    assigned_by_user_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
    )
    expires_at: datetime | None = Field(default=None, description="Optional expiration")


# ============================================================================
# Audit Log Table
# ============================================================================


class PermissionAuditLog(SQLModelStrictBaseModel, table=True):
    """Permission audit log table."""

    __tablename__ = "permission_audit_log_v2"
    __table_args__ = (
        Index("idx_audit_v2_user_created", "user_id", "created_at"),
        Index("idx_audit_v2_resource", "resource_type", "resource_id"),
        Index("idx_audit_v2_org", "org_id", "created_at"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
    )
    action: str = Field(max_length=50, description="Action performed")
    permission_name: str | None = Field(default=None, max_length=100)
    resource_type: str | None = Field(default=None, max_length=50)
    resource_id: str | None = Field(default=None, max_length=255)
    org_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="SET NULL")),
    )
    result: str = Field(max_length=20, description="Result: granted, denied, error")
    reason: str | None = Field(default=None, description="Reason for result")
    ip_address: str | None = Field(default=None, max_length=45)
    user_agent: str | None = Field(default=None)
    request_id: str | None = Field(default=None, max_length=36)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Backwards-compatible aliases (will be removed in a future cleanup)
# ============================================================================

PermissionV2Base = PermissionBase
PermissionV2 = Permission
RoleV2Base = RoleBase
RoleV2 = Role
RolePermissionV2 = RolePermission
UserRoleV2 = UserRole
PermissionAuditLogV2 = PermissionAuditLog
