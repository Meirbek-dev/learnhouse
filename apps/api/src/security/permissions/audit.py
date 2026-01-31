"""
Audit Logger for Permission Checks

Handles tiered audit logging of permission checks to database and Redis.
Implements configurable logging levels to balance security and performance.
"""

import logging
from datetime import UTC, datetime
from typing import Any

from sqlmodel import Session

from src.db.permissions.enums import AuditAction, AuditLevel
from src.db.permissions.generated_enums import Action, ResourceType
from src.services.cache.redis_client import get_redis_client

_logger = logging.getLogger(__name__)


class AuditLogger:
    """
    Audit logger for permission system.

    Implements tiered logging based on configured level:
    - NONE: No logging
    - FAILURES_ONLY: Log only denied permissions
    - WRITES_ONLY: Log writes (create/update/delete) and failures
    - ALL_EXCEPT_READS: Log everything except successful reads (default)
    - ALL: Log every permission check
    """

    def __init__(
        self,
        db: Session,
        level: AuditLevel = AuditLevel.ALL_EXCEPT_READS,
    ):
        """
        Initialize audit logger.

        Args:
            db: Database session
            level: Audit logging level
        """
        self.db = db
        self.level = level
        self.redis = get_redis_client()

    def should_log(self, action: Action, granted: bool) -> bool:
        """
        Determine if this permission check should be logged.

        Args:
            action: Action being checked
            granted: Whether permission was granted

        Returns:
            True if should be logged
        """
        if self.level == AuditLevel.NONE:
            return False

        if self.level == AuditLevel.FAILURES_ONLY:
            return not granted

        if self.level == AuditLevel.WRITES_ONLY:
            is_write = action in [Action.CREATE, Action.UPDATE, Action.DELETE]
            return is_write or not granted

        if self.level == AuditLevel.ALL_EXCEPT_READS:
            if action == Action.READ and granted:
                return False
            return True

        # AuditLevel.ALL
        return True

    async def log_check(
        self,
        user_id: int,
        action: Action,
        resource_type: ResourceType,
        granted: bool,
        resource_id: str | None = None,
        org_id: int | None = None,
        scope: str = "all",
        reason: str | None = None,
        ip_address: str | None = None,
    ) -> None:
        """
        Log a permission check.

        Args:
            user_id: User ID
            action: Action attempted
            resource_type: Resource type
            granted: Whether permission was granted
            resource_id: Optional resource ID
            org_id: Optional organization ID
            scope: Permission scope
            reason: Optional reason for denial
            ip_address: Optional client IP address
        """
        if not self.should_log(action, granted):
            return

        try:
            # For now, just log to application logs
            # In a full implementation, this would write to audit table
            log_level = logging.WARNING if not granted else logging.INFO

            audit_data = {
                "user_id": user_id,
                "action": action.value,
                "resource_type": resource_type.value,
                "resource_id": resource_id,
                "org_id": org_id,
                "scope": scope,
                "granted": granted,
                "reason": reason,
                "ip_address": ip_address,
                "timestamp": datetime.now(UTC).isoformat(),
            }

            _logger.log(
                log_level,
                f"Permission check: user={user_id} "
                f"action={resource_type.value}:{action.value}:{scope} "
                f"granted={granted} "
                f"resource={resource_id or 'N/A'} "
                f"{f'reason={reason}' if reason else ''}",
            )

            # Store in Redis for recent audit trail
            if self.redis:
                self._store_in_redis(audit_data)

        except Exception as e:
            _logger.error(f"Failed to log audit event: {e}")

    def _store_in_redis(self, audit_data: dict[str, Any]) -> None:
        """Store audit event in Redis for recent history."""
        try:
            if not self.redis:
                return

            # Store in a sorted set by timestamp
            key = f"audit:{audit_data['user_id']}"
            score = datetime.fromisoformat(audit_data["timestamp"]).timestamp()

            import json

            self.redis.zadd(key, {json.dumps(audit_data): score})

            # Keep only last 100 events per user
            self.redis.zremrangebyrank(key, 0, -101)

            # Set expiry of 7 days
            self.redis.expire(key, 7 * 24 * 60 * 60)

        except Exception as e:
            _logger.warning(f"Failed to store audit in Redis: {e}")

    async def get_recent_checks(
        self,
        user_id: int,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """
        Get recent permission checks for a user.

        Args:
            user_id: User ID
            limit: Maximum number of events to return

        Returns:
            List of audit events
        """
        try:
            if not self.redis:
                return []

            key = f"audit:{user_id}"
            events = self.redis.zrevrange(key, 0, limit - 1)

            import json

            return [json.loads(event.decode()) for event in events]

        except Exception as e:
            _logger.warning(f"Failed to get recent checks: {e}")
            return []
