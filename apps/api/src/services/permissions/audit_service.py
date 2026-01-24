"""
Audit service for permission-related logging.

This service provides methods for logging permission checks, grants,
and revocations for security auditing and compliance.
"""

from datetime import datetime

from sqlmodel import Session, select

from src.db.permissions.audit import (
    PermissionAuditLog,
    PermissionAuditLogCreate,
    PermissionAuditLogRead,
)
from src.db.permissions.enums import Action, AuditAction, ResourceType


class AuditService:
    """Service for permission audit logging."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def log(
        self,
        user_id: int | None,
        audit_action: AuditAction,
        result: bool,
        resource_type: ResourceType | str | None = None,
        resource_id: str | None = None,
        permission_name: str | None = None,
        context: dict | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> PermissionAuditLog:
        """
        Log a permission-related event.

        Args:
            user_id: User who performed/requested the action
            audit_action: Type of audit event (check, grant, revoke, deny)
            result: Result of the action (True=success, False=failure)
            resource_type: Type of resource involved
            resource_id: UUID of the resource
            permission_name: Name of the permission checked/modified
            context: Additional context (org_id, conditions, etc.)
            ip_address: IP address of the request
            user_agent: User agent string

        Returns:
            The created audit log entry
        """
        resource_type_str = (
            resource_type.value
            if isinstance(resource_type, ResourceType)
            else resource_type
        )

        log_entry = PermissionAuditLog(
            user_id=user_id,
            action=audit_action,
            resource_type=resource_type_str,
            resource_id=resource_id,
            permission_name=permission_name,
            result=result,
            context=context,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        self.db.add(log_entry)
        self.db.commit()
        self.db.refresh(log_entry)
        return log_entry

    def log_check(
        self,
        user_id: int | None,
        action: Action,
        resource: ResourceType,
        result: bool,
        resource_id: str | None = None,
        org_id: int | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> PermissionAuditLog:
        """
        Log a permission check event.

        Args:
            user_id: User who performed the check
            action: Action that was checked
            resource: Resource type
            result: Whether the check passed
            resource_id: Optional specific resource UUID
            org_id: Optional organization context
            ip_address: IP address of the request
            user_agent: User agent string

        Returns:
            The created audit log entry
        """
        permission_name = f"{resource.value}:{action.value}"
        context = {}
        if org_id:
            context["org_id"] = org_id
        if resource_id:
            context["resource_id"] = resource_id

        return self.log(
            user_id=user_id,
            audit_action=AuditAction.CHECK if result else AuditAction.DENY,
            result=result,
            resource_type=resource,
            resource_id=resource_id,
            permission_name=permission_name,
            context=context if context else None,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    def log_grant(
        self,
        granted_by: int | None,
        granted_to: int,
        permission_name: str,
        resource_type: ResourceType | None = None,
        resource_id: str | None = None,
        context: dict | None = None,
    ) -> PermissionAuditLog:
        """
        Log a permission grant event.

        Args:
            granted_by: User who granted the permission
            granted_to: User who received the permission
            permission_name: Name of the granted permission
            resource_type: Optional resource type
            resource_id: Optional resource UUID
            context: Additional context

        Returns:
            The created audit log entry
        """
        ctx = context or {}
        ctx["granted_to"] = granted_to

        return self.log(
            user_id=granted_by,
            audit_action=AuditAction.GRANT,
            result=True,
            resource_type=resource_type,
            resource_id=resource_id,
            permission_name=permission_name,
            context=ctx,
        )

    def log_revoke(
        self,
        revoked_by: int | None,
        revoked_from: int,
        permission_name: str,
        resource_type: ResourceType | None = None,
        resource_id: str | None = None,
        context: dict | None = None,
    ) -> PermissionAuditLog:
        """
        Log a permission revoke event.

        Args:
            revoked_by: User who revoked the permission
            revoked_from: User who lost the permission
            permission_name: Name of the revoked permission
            resource_type: Optional resource type
            resource_id: Optional resource UUID
            context: Additional context

        Returns:
            The created audit log entry
        """
        ctx = context or {}
        ctx["revoked_from"] = revoked_from

        return self.log(
            user_id=revoked_by,
            audit_action=AuditAction.REVOKE,
            result=True,
            resource_type=resource_type,
            resource_id=resource_id,
            permission_name=permission_name,
            context=ctx,
        )

    def get_user_audit_log(
        self,
        user_id: int,
        limit: int = 100,
        offset: int = 0,
        action_filter: AuditAction | None = None,
    ) -> list[PermissionAuditLogRead]:
        """
        Get audit log entries for a specific user.

        Args:
            user_id: User ID
            limit: Maximum number of entries to return
            offset: Number of entries to skip
            action_filter: Optional filter by action type

        Returns:
            List of audit log entries
        """
        statement = (
            select(PermissionAuditLog)
            .where(PermissionAuditLog.user_id == user_id)
            .order_by(PermissionAuditLog.created_at.desc())
        )

        if action_filter:
            statement = statement.where(PermissionAuditLog.action == action_filter)

        statement = statement.offset(offset).limit(limit)
        results = self.db.exec(statement).all()
        return [PermissionAuditLogRead.model_validate(r) for r in results]

    def get_resource_audit_log(
        self,
        resource_type: ResourceType,
        resource_id: str,
        limit: int = 100,
        offset: int = 0,
    ) -> list[PermissionAuditLogRead]:
        """
        Get audit log entries for a specific resource.

        Args:
            resource_type: Resource type
            resource_id: Resource UUID
            limit: Maximum number of entries to return
            offset: Number of entries to skip

        Returns:
            List of audit log entries
        """
        statement = (
            select(PermissionAuditLog)
            .where(
                PermissionAuditLog.resource_type == resource_type.value,
                PermissionAuditLog.resource_id == resource_id,
            )
            .order_by(PermissionAuditLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        results = self.db.exec(statement).all()
        return [PermissionAuditLogRead.model_validate(r) for r in results]

    def get_denied_attempts(
        self,
        since: datetime | None = None,
        limit: int = 100,
    ) -> list[PermissionAuditLogRead]:
        """
        Get recent denied permission attempts.

        Useful for security monitoring and detecting potential attacks.

        Args:
            since: Optional datetime to filter from
            limit: Maximum number of entries to return

        Returns:
            List of denied permission audit log entries
        """
        statement = (
            select(PermissionAuditLog)
            .where(PermissionAuditLog.action == AuditAction.DENY)
            .order_by(PermissionAuditLog.created_at.desc())
            .limit(limit)
        )

        if since:
            statement = statement.where(PermissionAuditLog.created_at >= since)

        results = self.db.exec(statement).all()
        return [PermissionAuditLogRead.model_validate(r) for r in results]

    def cleanup_old_logs(self, days: int = 90) -> int:
        """
        Delete audit logs older than specified days.

        Args:
            days: Number of days to keep logs

        Returns:
            Number of deleted entries
        """
        from datetime import timedelta

        cutoff = datetime.utcnow() - timedelta(days=days)

        statement = select(PermissionAuditLog).where(
            PermissionAuditLog.created_at < cutoff
        )
        old_logs = self.db.exec(statement).all()

        count = len(old_logs)
        for log in old_logs:
            self.db.delete(log)

        self.db.commit()
        return count
