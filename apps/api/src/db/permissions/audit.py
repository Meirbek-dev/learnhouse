"""
Audit logging models for the RBAC permission system.

This module provides the database model for tracking permission checks,
grants, and revocations for security auditing and compliance.
"""

from datetime import datetime

from pydantic import ConfigDict, field_validator
from sqlalchemy import JSON, Column, ForeignKey, Index, Integer, String, Text
from sqlmodel import Field

from src.db.permissions.enums import AuditAction
from src.db.strict_base_model import SQLModelStrictBaseModel


class PermissionAuditLogBase(SQLModelStrictBaseModel):
    """Base model for permission audit log entries."""

    model_config = ConfigDict(use_enum_values=True)

    action: AuditAction = Field(description="Type of action: check, grant, revoke, deny")
    resource_type: str | None = Field(default=None, max_length=50, description="Type of resource")
    resource_id: str | None = Field(default=None, max_length=100, description="UUID of resource")
    permission_name: str | None = Field(default=None, max_length=100, description="Permission that was checked/modified")
    result: bool = Field(description="Result of the action (True=allowed, False=denied)")


class PermissionAuditLog(PermissionAuditLogBase, table=True):
    """Audit log for permission checks and modifications."""

    __tablename__ = "permission_audit_log"
    __table_args__ = (
        Index("ix_permission_audit_user", "user_id", "created_at"),
        Index("ix_permission_audit_resource", "resource_type", "resource_id"),
        Index("ix_permission_audit_action", "action", "created_at"),
    )

    id: int | None = Field(default=None, primary_key=True)
    user_id: int | None = Field(
        default=None,
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="SET NULL")),
        description="User who performed/requested the action",
    )
    context: dict | None = Field(
        default=None,
        sa_column=Column(JSON),
        description="Additional context (org_id, conditions, etc.)",
    )
    ip_address: str | None = Field(
        default=None,
        sa_column=Column(String(45)),  # Supports IPv6
        description="IP address of the request",
    )
    user_agent: str | None = Field(
        default=None,
        sa_column=Column(Text),
        description="User agent string",
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("action", mode="before")
    @classmethod
    def validate_action(cls, v):
        if isinstance(v, str):
            return AuditAction(v)
        return v


class PermissionAuditLogCreate(SQLModelStrictBaseModel):
    """Model for creating an audit log entry."""

    model_config = ConfigDict(use_enum_values=True)

    user_id: int | None = None
    action: AuditAction
    resource_type: str | None = None
    resource_id: str | None = None
    permission_name: str | None = None
    result: bool
    context: dict | None = None
    ip_address: str | None = None
    user_agent: str | None = None


class PermissionAuditLogRead(PermissionAuditLogBase):
    """Model for reading audit log entries."""

    id: int
    user_id: int | None
    context: dict | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
