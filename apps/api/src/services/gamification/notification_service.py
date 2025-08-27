"""
Enhanced Notification Service

Comprehensive notification system with multiple channels and templates.
Part of Phase 1: Foundation & Architecture improvements.
"""

import json
import logging
from datetime import UTC, datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel
from sqlmodel import Session, and_, select

from src.db.gamification_events import (
    GamificationNotification,
    NotificationChannel,
    NotificationStatus,
    NotificationType,
)
from src.services.gamification.config import get_gamification_config

logger = logging.getLogger(__name__)


class NotificationPriority(str, Enum):
    """Notification priority levels."""

    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    URGENT = "urgent"


class NotificationTemplate(BaseModel):
    """Notification template definition."""

    name: str
    title_template: str
    body_template: str
    channels: list[NotificationChannel]
    priority: NotificationPriority = NotificationPriority.NORMAL
    ttl_hours: int = 24
    requires_action: bool = False
    action_url: str | None = None
    category: str | None = None


class NotificationContext(BaseModel):
    """Context data for notification templates."""

    user_id: int
    org_id: int
    data: dict[str, Any] = {}

    # User information
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None

    # Organization information
    org_name: str | None = None

    # Gamification context
    total_xp: int = 0
    current_level: int = 1
    current_streak: int = 0


class NotificationBatch(BaseModel):
    """Batch notification request."""

    template_name: str
    contexts: list[NotificationContext]
    send_at: datetime | None = None
    channels: list[NotificationChannel] | None = None


class NotificationStats(BaseModel):
    """Notification statistics."""

    total_sent: int = 0
    total_delivered: int = 0
    total_failed: int = 0
    total_pending: int = 0
    delivery_rate: float = 0.0

    by_channel: dict[str, dict[str, int]] = {}
    by_type: dict[str, dict[str, int]] = {}


class EnhancedNotificationService:
    """Enhanced notification service with templates and multiple channels."""

    def __init__(self, db_session: Session, cache_client=None) -> None:
        self.db_session = db_session
        self.cache = cache_client
        self.config = get_gamification_config()

        # Initialize templates
        self.templates = self._initialize_templates()

    async def send_notification(
        self,
        template_name: str,
        context: NotificationContext,
        channels: list[NotificationChannel] | None = None,
        priority: NotificationPriority | None = None,
        send_at: datetime | None = None,
    ) -> list[str]:
        """Send notification using template."""

        template = self.templates.get(template_name)
        if not template:
            logger.error(f"Unknown notification template: {template_name}")
            return []

        # Use provided channels or template defaults
        target_channels = channels or template.channels
        notification_priority = priority or template.priority

        # Render notification content
        try:
            title = self._render_template(template.title_template, context)
            body = self._render_template(template.body_template, context)
        except Exception as e:
            logger.exception(f"Failed to render template {template_name}: {e!s}")
            return []

        # Create notifications for each channel
        notification_ids = []

        for channel in target_channels:
            try:
                notification = GamificationNotification(
                    user_id=context.user_id,
                    org_id=context.org_id,
                    type=NotificationType.ACHIEVEMENT_UNLOCKED,  # Would be dynamic based on template
                    channel=channel,
                    status=NotificationStatus.PENDING
                    if send_at
                    else NotificationStatus.QUEUED,
                    title=title,
                    body=body,
                    priority=notification_priority.value,
                    metadata={
                        "template_name": template_name,
                        "context_data": context.data,
                        "requires_action": template.requires_action,
                        "action_url": template.action_url,
                        "category": template.category,
                    },
                    scheduled_at=send_at,
                    expires_at=datetime.now(UTC) + timedelta(hours=template.ttl_hours),
                )

                self.db_session.add(notification)
                self.db_session.commit()
                self.db_session.refresh(notification)

                notification_ids.append(str(notification.id))

                # Send immediately if no schedule
                if not send_at:
                    await self._dispatch_notification(notification)

            except Exception as e:
                logger.exception(
                    f"Failed to create notification for channel {channel}: {e!s}"
                )
                continue

        return notification_ids

    async def send_batch_notifications(
        self, batch: NotificationBatch
    ) -> dict[str, Any]:
        """Send batch of notifications."""

        results = {
            "total_requested": len(batch.contexts),
            "successful": 0,
            "failed": 0,
            "notification_ids": [],
        }

        for context in batch.contexts:
            try:
                notification_ids = await self.send_notification(
                    template_name=batch.template_name,
                    context=context,
                    channels=batch.channels,
                    send_at=batch.send_at,
                )

                if notification_ids:
                    results["successful"] += 1
                    results["notification_ids"].extend(notification_ids)
                else:
                    results["failed"] += 1

            except Exception as e:
                logger.exception(
                    f"Failed to send notification to user {context.user_id}: {e!s}"
                )
                results["failed"] += 1

        return results

    async def get_user_notifications(
        self,
        user_id: int,
        org_id: int,
        limit: int = 50,
        offset: int = 0,
        unread_only: bool = False,
        channels: list[NotificationChannel] | None = None,
    ) -> dict[str, Any]:
        """Get user's notifications."""

        # Build query
        stmt = select(GamificationNotification).where(
            GamificationNotification.user_id == user_id,
            GamificationNotification.org_id == org_id,
        )

        if unread_only:
            stmt = stmt.where(GamificationNotification.read_at.is_(None))

        if channels:
            stmt = stmt.where(GamificationNotification.channel.in_(channels))

        stmt = (
            stmt.order_by(GamificationNotification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        notifications = list(self.db_session.exec(stmt).all())

        # Get total count
        count_stmt = select(GamificationNotification).where(
            GamificationNotification.user_id == user_id,
            GamificationNotification.org_id == org_id,
        )

        if unread_only:
            count_stmt = count_stmt.where(GamificationNotification.read_at.is_(None))

        total_count = len(list(self.db_session.exec(count_stmt).all()))

        # Get unread count
        unread_stmt = select(GamificationNotification).where(
            GamificationNotification.user_id == user_id,
            GamificationNotification.org_id == org_id,
            GamificationNotification.read_at.is_(None),
        )

        unread_count = len(list(self.db_session.exec(unread_stmt).all()))

        return {
            "notifications": [
                {
                    "id": str(n.id),
                    "type": n.type.value if n.type else None,
                    "channel": n.channel.value,
                    "title": n.title,
                    "body": n.body,
                    "priority": n.priority,
                    "created_at": n.created_at.isoformat(),
                    "read_at": n.read_at.isoformat() if n.read_at else None,
                    "metadata": n.metadata or {},
                    "status": n.status.value,
                }
                for n in notifications
            ],
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset,
                "unread_count": unread_count,
            },
        }

    async def mark_as_read(self, notification_ids: list[str], user_id: int) -> int:
        """Mark notifications as read."""

        try:
            stmt = select(GamificationNotification).where(
                GamificationNotification.id.in_(notification_ids),
                GamificationNotification.user_id == user_id,
                GamificationNotification.read_at.is_(None),
            )

            notifications = list(self.db_session.exec(stmt).all())

            read_count = 0
            for notification in notifications:
                notification.read_at = datetime.now(UTC)
                self.db_session.add(notification)
                read_count += 1

            self.db_session.commit()
            return read_count

        except Exception as e:
            logger.exception(f"Failed to mark notifications as read: {e!s}")
            self.db_session.rollback()
            return 0

    async def mark_all_as_read(
        self,
        user_id: int,
        org_id: int,
        channels: list[NotificationChannel] | None = None,
    ) -> int:
        """Mark all user notifications as read."""

        try:
            stmt = select(GamificationNotification).where(
                GamificationNotification.user_id == user_id,
                GamificationNotification.org_id == org_id,
                GamificationNotification.read_at.is_(None),
            )

            if channels:
                stmt = stmt.where(GamificationNotification.channel.in_(channels))

            notifications = list(self.db_session.exec(stmt).all())

            read_count = 0
            for notification in notifications:
                notification.read_at = datetime.now(UTC)
                self.db_session.add(notification)
                read_count += 1

            self.db_session.commit()
            return read_count

        except Exception as e:
            logger.exception(f"Failed to mark all notifications as read: {e!s}")
            self.db_session.rollback()
            return 0

    async def delete_notification(self, notification_id: str, user_id: int) -> bool:
        """Delete notification."""

        try:
            stmt = select(GamificationNotification).where(
                GamificationNotification.id == notification_id,
                GamificationNotification.user_id == user_id,
            )

            notification = self.db_session.exec(stmt).first()
            if not notification:
                return False

            self.db_session.delete(notification)
            self.db_session.commit()
            return True

        except Exception as e:
            logger.exception(f"Failed to delete notification {notification_id}: {e!s}")
            self.db_session.rollback()
            return False

    async def get_notification_stats(
        self, org_id: int | None = None, days: int = 30
    ) -> NotificationStats:
        """Get notification statistics."""

        start_date = datetime.now(UTC) - timedelta(days=days)

        # Build base query
        stmt = select(GamificationNotification).where(
            GamificationNotification.created_at >= start_date
        )

        if org_id:
            stmt = stmt.where(GamificationNotification.org_id == org_id)

        notifications = list(self.db_session.exec(stmt).all())

        stats = NotificationStats()
        stats.total_sent = len(notifications)

        # Count by status
        for notification in notifications:
            if notification.status == NotificationStatus.DELIVERED:
                stats.total_delivered += 1
            elif notification.status == NotificationStatus.FAILED:
                stats.total_failed += 1
            elif notification.status in [
                NotificationStatus.PENDING,
                NotificationStatus.QUEUED,
            ]:
                stats.total_pending += 1

        # Calculate delivery rate
        if stats.total_sent > 0:
            stats.delivery_rate = stats.total_delivered / stats.total_sent

        # Group by channel
        stats.by_channel = {}
        for notification in notifications:
            channel = notification.channel.value
            if channel not in stats.by_channel:
                stats.by_channel[channel] = {"sent": 0, "delivered": 0, "failed": 0}

            stats.by_channel[channel]["sent"] += 1
            if notification.status == NotificationStatus.DELIVERED:
                stats.by_channel[channel]["delivered"] += 1
            elif notification.status == NotificationStatus.FAILED:
                stats.by_channel[channel]["failed"] += 1

        # Group by type
        stats.by_type = {}
        for notification in notifications:
            if notification.type:
                type_name = notification.type.value
                if type_name not in stats.by_type:
                    stats.by_type[type_name] = {"sent": 0, "delivered": 0, "failed": 0}

                stats.by_type[type_name]["sent"] += 1
                if notification.status == NotificationStatus.DELIVERED:
                    stats.by_type[type_name]["delivered"] += 1
                elif notification.status == NotificationStatus.FAILED:
                    stats.by_type[type_name]["failed"] += 1

        return stats

    async def cleanup_expired_notifications(self) -> int:
        """Clean up expired notifications."""

        try:
            now = datetime.now(UTC)

            stmt = select(GamificationNotification).where(
                GamificationNotification.expires_at < now
            )

            expired_notifications = list(self.db_session.exec(stmt).all())

            for notification in expired_notifications:
                self.db_session.delete(notification)

            self.db_session.commit()

            logger.info(
                f"Cleaned up {len(expired_notifications)} expired notifications"
            )
            return len(expired_notifications)

        except Exception as e:
            logger.exception(f"Failed to cleanup expired notifications: {e!s}")
            self.db_session.rollback()
            return 0

    async def process_pending_notifications(self) -> int:
        """Process pending scheduled notifications."""

        try:
            now = datetime.now(UTC)

            stmt = select(GamificationNotification).where(
                GamificationNotification.status == NotificationStatus.PENDING,
                GamificationNotification.scheduled_at <= now,
            )

            pending_notifications = list(self.db_session.exec(stmt).all())

            processed = 0
            for notification in pending_notifications:
                try:
                    await self._dispatch_notification(notification)
                    processed += 1
                except Exception as e:
                    logger.exception(
                        f"Failed to dispatch notification {notification.id}: {e!s}"
                    )

            return processed

        except Exception as e:
            logger.exception(f"Failed to process pending notifications: {e!s}")
            return 0

    # ============================================================================
    # Template system
    # ============================================================================

    def _initialize_templates(self) -> dict[str, NotificationTemplate]:
        """Initialize notification templates."""

        return {
            "xp_awarded": NotificationTemplate(
                name="xp_awarded",
                title_template="XP Earned! 🎉",
                body_template="You earned {xp_amount} XP for {activity}! Total: {total_xp} XP",
                channels=[NotificationChannel.IN_APP],
                priority=NotificationPriority.LOW,
                category="xp",
            ),
            "level_up": NotificationTemplate(
                name="level_up",
                title_template="Level Up! 🚀",
                body_template="Congratulations {first_name}! You've reached level {new_level}!",
                channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                priority=NotificationPriority.HIGH,
                category="level",
            ),
            "achievement_unlocked": NotificationTemplate(
                name="achievement_unlocked",
                title_template="Achievement Unlocked! 🏆",
                body_template="You've unlocked the '{achievement_name}' achievement! {achievement_description}",
                channels=[NotificationChannel.IN_APP, NotificationChannel.PUSH],
                priority=NotificationPriority.HIGH,
                requires_action=True,
                action_url="/achievements",
                category="achievement",
            ),
            "badge_earned": NotificationTemplate(
                name="badge_earned",
                title_template="Badge Earned! 🏅",
                body_template="You've earned the '{badge_name}' badge! Keep up the great work!",
                channels=[NotificationChannel.IN_APP],
                priority=NotificationPriority.NORMAL,
                category="badge",
            ),
            "streak_milestone": NotificationTemplate(
                name="streak_milestone",
                title_template="Streak Milestone! 🔥",
                body_template="Amazing! You've maintained a {streak_days}-day learning streak!",
                channels=[NotificationChannel.IN_APP, NotificationChannel.PUSH],
                priority=NotificationPriority.HIGH,
                category="streak",
            ),
            "leaderboard_position": NotificationTemplate(
                name="leaderboard_position",
                title_template="Leaderboard Update! 📊",
                body_template="You're now #{rank} on the {leaderboard_type} leaderboard!",
                channels=[NotificationChannel.IN_APP],
                priority=NotificationPriority.NORMAL,
                category="leaderboard",
            ),
            "daily_reminder": NotificationTemplate(
                name="daily_reminder",
                title_template="Don't break your streak! 🎯",
                body_template="You have a {streak_days}-day streak going. Complete an activity to keep it alive!",
                channels=[NotificationChannel.PUSH],
                priority=NotificationPriority.NORMAL,
                category="reminder",
            ),
            "course_completion": NotificationTemplate(
                name="course_completion",
                title_template="Course Completed! ✅",
                body_template="Congratulations on completing '{course_name}'! You earned {xp_earned} XP!",
                channels=[NotificationChannel.IN_APP, NotificationChannel.EMAIL],
                priority=NotificationPriority.HIGH,
                requires_action=True,
                action_url="/certificates",
                category="completion",
            ),
        }

    def _render_template(self, template: str, context: NotificationContext) -> str:
        """Render notification template with context data."""

        # Prepare template variables
        variables = {
            "user_id": context.user_id,
            "org_id": context.org_id,
            "username": context.username or "User",
            "first_name": context.first_name or "User",
            "last_name": context.last_name or "",
            "org_name": context.org_name or "Organization",
            "total_xp": context.total_xp,
            "current_level": context.current_level,
            "current_streak": context.current_streak,
            **context.data,
        }

        # Simple template rendering (could use Jinja2 for more complex templates)
        try:
            return template.format(**variables)
        except KeyError as e:
            logger.warning(f"Missing template variable: {e!s}")
            return template  # Return template as-is if rendering fails

    async def _dispatch_notification(
        self, notification: GamificationNotification
    ) -> None:
        """Dispatch notification to appropriate channel."""

        try:
            if notification.channel == NotificationChannel.IN_APP:
                await self._send_in_app_notification(notification)
            elif notification.channel == NotificationChannel.EMAIL:
                await self._send_email_notification(notification)
            elif notification.channel == NotificationChannel.PUSH:
                await self._send_push_notification(notification)
            elif notification.channel == NotificationChannel.SMS:
                await self._send_sms_notification(notification)

            # Mark as delivered
            notification.status = NotificationStatus.DELIVERED
            notification.sent_at = datetime.now(UTC)
            self.db_session.add(notification)
            self.db_session.commit()

        except Exception as e:
            logger.exception(
                f"Failed to dispatch notification {notification.id}: {e!s}"
            )

            # Mark as failed
            notification.status = NotificationStatus.FAILED
            notification.failure_reason = str(e)
            notification.retry_count = (notification.retry_count or 0) + 1
            self.db_session.add(notification)
            self.db_session.commit()

    async def _send_in_app_notification(
        self, notification: GamificationNotification
    ) -> None:
        """Send in-app notification (already stored in DB)."""
        # In-app notifications are just stored in database
        # Real-time delivery would be handled by WebSocket/SSE

    async def _send_email_notification(
        self, notification: GamificationNotification
    ) -> None:
        """Send email notification."""
        # Placeholder for email service integration
        logger.info(f"Would send email notification: {notification.title}")

    async def _send_push_notification(
        self, notification: GamificationNotification
    ) -> None:
        """Send push notification."""
        # Placeholder for push notification service integration
        logger.info(f"Would send push notification: {notification.title}")

    async def _send_sms_notification(
        self, notification: GamificationNotification
    ) -> None:
        """Send SMS notification."""
        # Placeholder for SMS service integration
        logger.info(f"Would send SMS notification: {notification.title}")


# ============================================================================
# Factory Function
# ============================================================================


def create_notification_service(
    db_session: Session, cache_client=None
) -> EnhancedNotificationService:
    """Create notification service."""
    return EnhancedNotificationService(db_session, cache_client)
