"""
RBAC Audit Service - Security Event Logging

Logs all security-relevant events:
- Permission checks (especially denials)
- Role assignments/revocations
- Permission grants/revocations
- Suspicious activity patterns

All audit logs are immutable and retained for compliance.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from fastapi import Request
from sqlmodel import Session

if TYPE_CHECKING:
    from src.services.rbac.service import CheckResult

logger = logging.getLogger(__name__)


class AuditService:
    """Security audit logging for RBAC v2."""

    def __init__(self, db: Session, redis=None, log_all: bool = False):
        """
        Initialize audit service.

        Args:
            db: Database session
            redis: Optional Redis client for metrics
            log_all: If True, log all permission checks (not just denials)
        """
        self.db = db
        self.redis = redis
        self.log_all = log_all

    # ========================================================================
    # Permission Check Logging
    # ========================================================================

    def log_permission_check(
        self,
        user_id: int,
        permission: str,
        resource_id: str | None,
        org_id: int | None,
        result: "CheckResult",
        reason: str,
        request: Request | None = None,
    ) -> None:
        """
        Log permission check event.

        Always logs denials. Only logs grants if log_all=True.
        """
        from src.db.permissions.models_v2 import PermissionAuditLogV2

        # Extract request context
        ip_address = None
        user_agent = None
        request_id = None

        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            # Extract request ID from headers if available
            request_id = request.headers.get("x-request-id")

        # Create audit log entry
        audit_log = PermissionAuditLogV2(
            user_id=user_id,
            action="permission_check",
            permission_name=permission,
            resource_type=self._extract_resource_type(permission),
            resource_id=resource_id,
            org_id=org_id,
            result=result.value,
            reason=reason,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )

        try:
            self.db.add(audit_log)
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to log permission check: {e}")
            self.db.rollback()

    # ========================================================================
    # Role Management Logging
    # ========================================================================

    def log_role_assignment(
        self,
        user_id: int,
        role_slug: str,
        org_id: int,
        assigned_by: int | None,
        request: Request | None = None,
    ) -> None:
        """Log role assignment event."""
        from src.db.permissions.models_v2 import PermissionAuditLogV2

        ip_address = None
        user_agent = None
        request_id = None

        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            request_id = request.headers.get("x-request-id")

        audit_log = PermissionAuditLogV2(
            user_id=user_id,
            action="role_assigned",
            permission_name=None,
            resource_type="role",
            resource_id=role_slug,
            org_id=org_id,
            result="granted",
            reason=f"assigned_by_user_{assigned_by}" if assigned_by else "system",
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )

        try:
            self.db.add(audit_log)
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to log role assignment: {e}")
            self.db.rollback()

    def log_role_revocation(
        self,
        user_id: int,
        role_slug: str,
        org_id: int,
        revoked_by: int | None,
        request: Request | None = None,
    ) -> None:
        """Log role revocation event."""
        from src.db.permissions.models_v2 import PermissionAuditLogV2

        ip_address = None
        user_agent = None
        request_id = None

        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            request_id = request.headers.get("x-request-id")

        audit_log = PermissionAuditLogV2(
            user_id=user_id,
            action="role_revoked",
            permission_name=None,
            resource_type="role",
            resource_id=role_slug,
            org_id=org_id,
            result="denied",
            reason=f"revoked_by_user_{revoked_by}" if revoked_by else "system",
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )

        try:
            self.db.add(audit_log)
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to log role revocation: {e}")
            self.db.rollback()

    def log_role_creation(
        self,
        role_slug: str,
        org_id: int | None,
        created_by: int | None,
        request: Request | None = None,
    ) -> None:
        """Log role creation event."""
        from src.db.permissions.models_v2 import PermissionAuditLogV2

        ip_address = None
        user_agent = None
        request_id = None

        if request:
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")
            request_id = request.headers.get("x-request-id")

        audit_log = PermissionAuditLogV2(
            user_id=created_by,
            action="role_created",
            permission_name=None,
            resource_type="role",
            resource_id=role_slug,
            org_id=org_id,
            result="granted",
            reason=f"created_by_user_{created_by}" if created_by else "system",
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
        )

        try:
            self.db.add(audit_log)
            self.db.commit()
        except Exception as e:
            logger.error(f"Failed to log role creation: {e}")
            self.db.rollback()

    # ========================================================================
    # Analytics & Monitoring
    # ========================================================================

    def get_recent_denials(
        self, user_id: int | None = None, limit: int = 100
    ) -> list[dict]:
        """Get recent permission denials for security monitoring."""
        from src.db.permissions.models_v2 import PermissionAuditLogV2
        from sqlmodel import select

        query = (
            select(PermissionAuditLogV2)
            .where(PermissionAuditLogV2.result == "denied")
            .order_by(PermissionAuditLogV2.created_at.desc())
            .limit(limit)
        )

        if user_id:
            query = query.where(PermissionAuditLogV2.user_id == user_id)

        results = self.db.exec(query).all()

        return [
            {
                "user_id": log.user_id,
                "permission": log.permission_name,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "reason": log.reason,
                "created_at": log.created_at.isoformat(),
                "ip_address": log.ip_address,
            }
            for log in results
        ]

    def get_user_activity(
        self, user_id: int, days: int = 30, limit: int = 1000
    ) -> list[dict]:
        """Get user's recent RBAC activity."""
        from src.db.permissions.models_v2 import PermissionAuditLogV2
        from sqlmodel import select
        from datetime import timedelta

        since = datetime.now(UTC) - timedelta(days=days)

        query = (
            select(PermissionAuditLogV2)
            .where(PermissionAuditLogV2.user_id == user_id)
            .where(PermissionAuditLogV2.created_at >= since)
            .order_by(PermissionAuditLogV2.created_at.desc())
            .limit(limit)
        )

        results = self.db.exec(query).all()

        return [
            {
                "action": log.action,
                "permission": log.permission_name,
                "result": log.result,
                "reason": log.reason,
                "created_at": log.created_at.isoformat(),
            }
            for log in results
        ]

    # ========================================================================
    # Helpers
    # ========================================================================

    def _extract_resource_type(self, permission_name: str) -> str:
        """Extract resource type from permission name (e.g., 'course:update:org' → 'course')."""
        parts = permission_name.split(":")
        return parts[0] if parts else "unknown"
