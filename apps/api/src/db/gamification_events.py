"""
Enhanced Event-Driven Gamification Models

New models to support event sourcing, notifications, and real-time features.
Part of Phase 1: Foundation & Architecture improvements.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import Field, field_validator
from sqlalchemy import JSON, Column, Index, Text, UniqueConstraint
from sqlmodel import Field as SQLField

from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


class EventType(str, Enum):
    """Types of gamification events."""

    # XP Events
    XP_AWARDED = "xp_awarded"
    LEVEL_UP = "level_up"
    DAILY_XP_LIMIT_REACHED = "daily_xp_limit_reached"

    # Streak Events
    STREAK_STARTED = "streak_started"
    STREAK_CONTINUED = "streak_continued"
    STREAK_MILESTONE = "streak_milestone"
    STREAK_BROKEN = "streak_broken"
    STREAK_RECOVERED = "streak_recovered"

    # Achievement Events
    ACHIEVEMENT_PROGRESS = "achievement_progress"
    ACHIEVEMENT_UNLOCKED = "achievement_unlocked"
    BADGE_EARNED = "badge_earned"

    # Social Events
    LEADERBOARD_POSITION_CHANGED = "leaderboard_position_changed"
    COMPETITIVE_MILESTONE = "competitive_milestone"

    # System Events
    PROFILE_CREATED = "profile_created"
    PREFERENCES_UPDATED = "preferences_updated"


class EventStatus(str, Enum):
    """Status of events in the system."""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class NotificationChannel(str, Enum):
    """Channels for delivering notifications."""

    IN_APP = "in_app"
    EMAIL = "email"
    PUSH = "push"
    WEBHOOK = "webhook"
    WEBSOCKET = "websocket"


# ============================================================================
# Event Store
# ============================================================================


class GamificationEvent(SQLModelStrictBaseModel, table=True):
    """
    Event store for all gamification events.
    Enables event sourcing, replay, and comprehensive audit trails.
    """

    __tablename__ = "gamification_events"
    __table_args__ = (
        Index("idx_event_user_org", "user_id", "org_id"),
        Index("idx_event_type", "event_type"),
        Index("idx_event_status", "status"),
        Index("idx_event_created", "created_at"),
        Index("idx_event_aggregate", "aggregate_id", "aggregate_type"),
        UniqueConstraint("event_id", name="uq_event_id"),
    )

    # Primary fields
    id: int = SQLField(primary_key=True)
    event_id: str = SQLField(
        default_factory=lambda: str(uuid4()), unique=True, index=True
    )

    # Event classification
    event_type: EventType = SQLField()
    event_version: int = SQLField(default=1, ge=1)

    # Aggregate information (for event sourcing)
    aggregate_id: str = SQLField(
        max_length=255, index=True
    )  # e.g., user_id or profile_id
    aggregate_type: str = SQLField(
        max_length=100
    )  # e.g., "user_profile", "achievement"
    sequence_number: int = SQLField(ge=0)  # For ordering events within aggregate

    # Context
    user_id: int = SQLField(foreign_key="user.id", index=True)
    org_id: int = SQLField(foreign_key="organization.id", index=True)

    # Event data
    event_data: dict[str, Any] = SQLField(sa_column=Column(JSON))
    previous_state: dict[str, Any] | None = SQLField(
        default=None, sa_column=Column(JSON)
    )
    new_state: dict[str, Any] | None = SQLField(default=None, sa_column=Column(JSON))

    # Processing information
    status: EventStatus = SQLField(default=EventStatus.PENDING)
    processed_at: datetime | None = SQLField(default=None)
    retry_count: int = SQLField(default=0, ge=0)
    error_message: str | None = SQLField(default=None, max_length=2000)

    # Metadata
    correlation_id: str | None = SQLField(
        default=None, max_length=255, index=True
    )  # For tracing
    causation_id: str | None = SQLField(default=None, max_length=255)  # Parent event
    triggered_by: str | None = SQLField(
        default=None, max_length=255
    )  # Admin user, system, etc.

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Notification Queue
# ============================================================================


class GamificationNotification(SQLModelStrictBaseModel, table=True):
    """
    Queue for gamification notifications.
    Supports multiple delivery channels and retry logic.
    """

    __tablename__ = "gamification_notifications"
    __table_args__ = (
        Index("idx_notification_user_org", "user_id", "org_id"),
        Index("idx_notification_status", "status"),
        Index("idx_notification_channel", "channel"),
        Index("idx_notification_scheduled", "scheduled_for"),
        Index("idx_notification_priority", "priority"),
    )

    # Primary fields
    id: int = SQLField(primary_key=True)
    notification_id: str = SQLField(default_factory=lambda: str(uuid4()), unique=True)

    # Target information
    user_id: int = SQLField(foreign_key="user.id", index=True)
    org_id: int = SQLField(foreign_key="organization.id", index=True)

    # Notification details
    title: str = SQLField(max_length=200)
    message: str = SQLField(sa_column=Column(Text))
    channel: NotificationChannel = SQLField()
    priority: int = SQLField(default=5, ge=1, le=10)  # 1=highest, 10=lowest

    # Delivery configuration
    scheduled_for: datetime = SQLField(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime | None = SQLField(default=None)

    # Content customization
    template_id: str | None = SQLField(default=None, max_length=100)
    template_data: dict[str, Any] = SQLField(
        default_factory=dict, sa_column=Column(JSON)
    )

    # Processing status
    status: EventStatus = SQLField(default=EventStatus.PENDING)
    sent_at: datetime | None = SQLField(default=None)
    delivery_attempts: int = SQLField(default=0, ge=0)
    last_attempt_at: datetime | None = SQLField(default=None)
    error_message: str | None = SQLField(default=None, max_length=2000)

    # Engagement tracking
    opened_at: datetime | None = SQLField(default=None)
    clicked_at: datetime | None = SQLField(default=None)
    dismissed_at: datetime | None = SQLField(default=None)

    # Metadata
    source_event_id: str | None = SQLField(
        default=None, max_length=255
    )  # Link to originating event
    correlation_id: str | None = SQLField(default=None, max_length=255)

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Analytics Aggregations
# ============================================================================


class GamificationMetrics(SQLModelStrictBaseModel, table=True):
    """
    Pre-computed metrics for analytics and reporting.
    Updated by background jobs for performance.
    """

    __tablename__ = "gamification_metrics"
    __table_args__ = (
        UniqueConstraint(
            "org_id",
            "metric_type",
            "period",
            "date",
            name="uq_metrics_org_type_period_date",
        ),
        Index("idx_metrics_org_type", "org_id", "metric_type"),
        Index("idx_metrics_date", "date"),
        Index("idx_metrics_period", "period"),
    )

    # Primary fields
    id: int = SQLField(primary_key=True)
    org_id: int = SQLField(foreign_key="organization.id", index=True)

    # Metric identification
    metric_type: str = SQLField(
        max_length=100
    )  # 'daily_active_users', 'xp_distribution', etc.
    period: str = SQLField(max_length=20)  # 'daily', 'weekly', 'monthly'
    date: datetime = SQLField(index=True)  # The date/period this metric represents

    # Metric data
    metric_value: float = SQLField()  # Primary numeric value
    metric_data: dict[str, Any] = SQLField(sa_column=Column(JSON))  # Additional data

    # Quality indicators
    data_quality_score: float = SQLField(default=1.0, ge=0.0, le=1.0)
    sample_size: int = SQLField(default=0, ge=0)

    # Processing metadata
    computed_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))
    computation_duration_ms: int = SQLField(default=0, ge=0)

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Badge System
# ============================================================================


class Badge(SQLModelStrictBaseModel, table=True):
    """
    Badge definitions - collectible items separate from achievements.
    More casual and fun compared to formal achievements.
    """

    __tablename__ = "badges"
    __table_args__ = (
        UniqueConstraint("org_id", "badge_key", name="uq_badge_org_key"),
        Index("idx_badge_org", "org_id"),
        Index("idx_badge_rarity", "rarity_level"),
    )

    # Primary fields
    id: int = SQLField(primary_key=True)
    org_id: int = SQLField(foreign_key="organization.id", index=True)

    # Badge definition
    badge_key: str = SQLField(max_length=100, index=True)
    title: str = SQLField(max_length=200)
    description: str = SQLField(sa_column=Column(Text))

    # Visual and categorization
    icon_url: str | None = SQLField(default=None, max_length=500)
    color: str = SQLField(default="#6B7280", max_length=7)  # Hex color
    category: str = SQLField(max_length=50)  # 'learning', 'social', 'streak', etc.
    rarity_level: int = SQLField(default=1, ge=1, le=5)  # 1=common, 5=legendary

    # Unlock conditions (simpler than achievements)
    unlock_conditions: dict[str, Any] = SQLField(sa_column=Column(JSON))
    is_secret: bool = SQLField(default=False)  # Hidden until unlocked

    # Metadata
    is_active: bool = SQLField(default=True)
    display_order: int = SQLField(default=0)
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))


class UserBadge(SQLModelStrictBaseModel, table=True):
    """
    Badges earned by users.
    """

    __tablename__ = "user_badges"
    __table_args__ = (
        UniqueConstraint("user_id", "badge_id", name="uq_user_badge"),
        Index("idx_user_badge_user", "user_id"),
        Index("idx_user_badge_org", "org_id"),
        Index("idx_user_badge_earned", "earned_at"),
    )

    # Primary fields
    id: int = SQLField(primary_key=True)
    user_id: int = SQLField(foreign_key="user.id", index=True)
    org_id: int = SQLField(foreign_key="organization.id", index=True)
    badge_id: int = SQLField(foreign_key="badges.id")

    # Earning details
    earned_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))
    earning_context: dict[str, Any] = SQLField(
        default_factory=dict, sa_column=Column(JSON)
    )

    # Display preferences
    is_favorited: bool = SQLField(default=False)
    is_publicly_visible: bool = SQLField(default=True)

    # Timestamps
    created_at: datetime = SQLField(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Pydantic Models
# ============================================================================


class GamificationEventRead(PydanticStrictBaseModel):
    """Response model for gamification events."""

    id: int
    event_id: str
    event_type: EventType
    event_version: int
    aggregate_id: str
    aggregate_type: str
    sequence_number: int
    user_id: int
    org_id: int
    event_data: dict[str, Any]
    previous_state: dict[str, Any] | None
    new_state: dict[str, Any] | None
    status: EventStatus
    processed_at: datetime | None
    retry_count: int
    error_message: str | None
    correlation_id: str | None
    causation_id: str | None
    triggered_by: str | None
    created_at: datetime
    updated_at: datetime


class GamificationNotificationRead(PydanticStrictBaseModel):
    """Response model for gamification notifications."""

    id: int
    notification_id: str
    user_id: int
    org_id: int
    title: str
    message: str
    channel: NotificationChannel
    priority: int
    scheduled_for: datetime
    expires_at: datetime | None
    template_id: str | None
    template_data: dict[str, Any]
    status: EventStatus
    sent_at: datetime | None
    delivery_attempts: int
    last_attempt_at: datetime | None
    error_message: str | None
    opened_at: datetime | None
    clicked_at: datetime | None
    dismissed_at: datetime | None
    source_event_id: str | None
    correlation_id: str | None
    created_at: datetime
    updated_at: datetime


class BadgeRead(PydanticStrictBaseModel):
    """Response model for badges."""

    id: int
    org_id: int
    badge_key: str
    title: str
    description: str
    icon_url: str | None
    color: str
    category: str
    rarity_level: int
    unlock_conditions: dict[str, Any]
    is_secret: bool
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime


class UserBadgeRead(PydanticStrictBaseModel):
    """Response model for user badges."""

    id: int
    user_id: int
    org_id: int
    badge_id: int
    earned_at: datetime
    earning_context: dict[str, Any]
    is_favorited: bool
    is_publicly_visible: bool
    created_at: datetime

    # Badge details (joined)
    badge: BadgeRead | None = None


class GamificationMetricsRead(PydanticStrictBaseModel):
    """Response model for gamification metrics."""

    id: int
    org_id: int
    metric_type: str
    period: str
    date: datetime
    metric_value: float
    metric_data: dict[str, Any]
    data_quality_score: float
    sample_size: int
    computed_at: datetime
    computation_duration_ms: int
    created_at: datetime
    updated_at: datetime


class EventCreateRequest(PydanticStrictBaseModel):
    """Request model for creating events."""

    event_type: EventType
    aggregate_id: str
    aggregate_type: str
    user_id: int
    org_id: int
    event_data: dict[str, Any]
    previous_state: dict[str, Any] | None = None
    new_state: dict[str, Any] | None = None
    correlation_id: str | None = None
    causation_id: str | None = None
    triggered_by: str | None = None


class NotificationCreateRequest(PydanticStrictBaseModel):
    """Request model for creating notifications."""

    user_id: int
    org_id: int
    title: str
    message: str
    channel: NotificationChannel
    priority: int = 5
    scheduled_for: datetime | None = None
    expires_at: datetime | None = None
    template_id: str | None = None
    template_data: dict[str, Any] = {}
    source_event_id: str | None = None
    correlation_id: str | None = None
