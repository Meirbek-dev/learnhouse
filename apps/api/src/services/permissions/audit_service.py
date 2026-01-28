"""
Audit service for permission-related logging.

This service provides methods for logging permission checks, grants,
and revocations for security auditing and compliance.

Tiered logging strategy:
- CRITICAL (grants, revokes, denials): Always log to DB
- IMPORTANT (successful permission checks): 10% sampling + Redis aggregation
- ROUTINE (repeated successful checks): Redis counters only
"""

import hashlib
import json
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlmodel import Session, select

from src.db.permissions.audit import (
    PermissionAuditLog,
    PermissionAuditLogCreate,
    PermissionAuditLogRead,
)
from src.db.permissions.enums import Action, AuditAction, ResourceType

if TYPE_CHECKING:
    from redis import Redis


class AuditService:
    """Service for permission audit logging with tiered strategy."""

    # Sampling rates
    IMPORTANT_SAMPLE_RATE = 0.1  # Log 10% of successful checks to DB
    ROUTINE_SAMPLE_RATE = 0.0  # Never log routine checks to DB

    # Redis key prefixes
    REDIS_AGGREGATE_KEY = "audit:aggregate"
    REDIS_COUNTER_KEY = "audit:counter"
    REDIS_TTL = 3600  # 1 hour

    def __init__(self, db: Session, redis: "Redis | None" = None) -> None:
        self.db = db
        self.redis = redis

    def _should_sample(self, audit_action: AuditAction, result: bool) -> bool:
        """
        Determine if this event should be logged to database.

        CRITICAL events (always log):
        - GRANT, REVOKE: Permission changes
        - DENY: Security-relevant denials

        IMPORTANT events (sample 10%):
        - CHECK with result=True: Successful permission checks

        ROUTINE events (never log to DB):
        - Repeated successful checks (aggregated in Redis)
        """
        # Critical: Always log to DB
        if audit_action in (AuditAction.GRANT, AuditAction.REVOKE, AuditAction.DENY):
            return True

        # Important: Sample successful checks
        if audit_action == AuditAction.CHECK and result:
            import random

            return random.random() < self.IMPORTANT_SAMPLE_RATE

        # Default: Don't log to DB
        return False

    def _aggregate_in_redis(
        self,
        user_id: int | None,
        audit_action: AuditAction,
        resource_type: str | None,
        permission_name: str | None,
    ) -> None:
        """Increment Redis counter for this event."""
        if not self.redis:
            return

        # Create aggregation key
        key_parts = [
            str(user_id or "anonymous"),
            audit_action.value,
            resource_type or "unknown",
            permission_name or "unknown",
        ]
        key_hash = hashlib.md5(":".join(key_parts).encode()).hexdigest()[:8]
        redis_key = f"{self.REDIS_COUNTER_KEY}:{key_hash}"

        # Increment counter and set TTL
        self.redis.incr(redis_key)
        self.redis.expire(redis_key, self.REDIS_TTL)

        # Store metadata for the aggregated events
        metadata_key = f"{self.REDIS_AGGREGATE_KEY}:{key_hash}"
        if not self.redis.exists(metadata_key):
            metadata = {
                "user_id": user_id,
                "action": audit_action.value,
                "resource_type": resource_type,
                "permission_name": permission_name,
                "first_seen": datetime.now(UTC).isoformat(),
            }
            self.redis.setex(metadata_key, self.REDIS_TTL, json.dumps(metadata))

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
    ) -> PermissionAuditLog | None:
        """
        Log a permission-related event with tiered strategy.

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
            The created audit log entry if logged to DB, None if only aggregated
        """
        resource_type_str = (
            resource_type.value
            if isinstance(resource_type, ResourceType)
            else resource_type
        )

        # Aggregate in Redis (always, for metrics)
        self._aggregate_in_redis(
            user_id=user_id,
            audit_action=audit_action,
            resource_type=resource_type_str,
            permission_name=permission_name,
        )

        # Decide if we should log to DB based on tiering strategy
        if not self._should_sample(audit_action, result):
            return None

        # Log to database (critical/sampled events only)
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
    ) -> PermissionAuditLog | None:
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
            The created audit log entry if logged to DB, None if only aggregated
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

        cutoff = datetime.now(UTC) - timedelta(days=days)

        statement = select(PermissionAuditLog).where(
            PermissionAuditLog.created_at < cutoff
        )
        old_logs = self.db.exec(statement).all()

        count = len(old_logs)
        for log in old_logs:
            self.db.delete(log)

        self.db.commit()
        return count

    def get_aggregated_stats(self, limit: int = 100) -> list[dict]:
        """
        Get aggregated statistics from Redis.

        Returns recent aggregated permission check data that wasn't logged to DB.

        Args:
            limit: Maximum number of aggregated stats to return

        Returns:
            List of dicts with aggregated event data and counts
        """
        if not self.redis:
            return []

        stats = []
        # Get all aggregate metadata keys
        pattern = f"{self.REDIS_AGGREGATE_KEY}:*"
        for key in self.redis.scan_iter(match=pattern, count=limit):
            # Get metadata and counter
            metadata_str = self.redis.get(key)
            if not metadata_str:
                continue

            key_hash = key.decode().split(":")[-1]
            counter_key = f"{self.REDIS_COUNTER_KEY}:{key_hash}"
            count = self.redis.get(counter_key)

            metadata = json.loads(metadata_str)
            metadata["count"] = int(count) if count else 0
            stats.append(metadata)

        # Sort by count descending
        return sorted(stats, key=lambda x: x["count"], reverse=True)[:limit]
