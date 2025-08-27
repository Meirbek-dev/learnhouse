"""
Enhanced Gamification Database Models

Comprehensive gamification system with proper constraints, indexes, and validation.
Designed for scalability, performance, and extensibility.
"""

from datetime import UTC, datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import ConfigDict, field_validator
from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlmodel import Field

from src.db.organizations import Organization
from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel

# Import referenced models to ensure they're available during schema creation
from src.db.users import User


class StreakType(str, Enum):
    """Types of streaks that can be tracked."""

    LOGIN = "login"
    LEARNING = "learning"
    DAILY_GOAL = "daily_goal"
    ACTIVITY = "activity"


class XPSource(str, Enum):
    """Sources of XP that can be awarded to users."""

    ACTIVITY_COMPLETION = "activity_completion"
    COURSE_COMPLETION = "course_completion"
    LOGIN_BONUS = "login_bonus"
    STREAK_BONUS = "streak_bonus"
    ASSIGNMENT_SUBMISSION = "assignment_submission"
    PEER_REVIEW = "peer_review"
    FORUM_PARTICIPATION = "forum_participation"
    QUIZ_COMPLETION = "quiz_completion"
    MILESTONE_ACHIEVEMENT = "milestone_achievement"
    DAILY_GOAL_COMPLETION = "daily_goal_completion"
    ADMIN_AWARD = "admin_award"


class AchievementType(str, Enum):
    """Types of achievements that can be unlocked."""

    LEVEL_MILESTONE = "level_milestone"
    STREAK_MILESTONE = "streak_milestone"
    COURSE_MASTERY = "course_mastery"
    SOCIAL_ENGAGEMENT = "social_engagement"
    CONTENT_CREATOR = "content_creator"
    EARLY_ADOPTER = "early_adopter"
    PERFECT_STUDENT = "perfect_student"


# ============================================================================
# Main Gamification Profile
# ============================================================================


class UserGamificationProfile(SQLModelStrictBaseModel, table=True):
    """
    Central gamification profile for users within organizations.
    Contains all XP, level, streak, and preference data.
    """

    __tablename__ = "user_gamification_profiles"
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uq_profile_user_org"),
        Index("idx_profile_org_xp", "org_id", "total_xp"),
        Index("idx_profile_org_level", "org_id", "current_level"),
        Index("idx_profile_user_org", "user_id", "org_id"),
        Index("idx_profile_last_login", "last_login_date"),
        Index("idx_profile_last_activity", "last_learning_activity_date"),
        Index("idx_profile_created", "created_at"),
        Index("idx_profile_updated", "updated_at"),
        # Composite indexes for leaderboards
        Index(
            "idx_profile_org_xp_desc",
            "org_id",
            "total_xp",
            postgresql_ops={"total_xp": "DESC"},
        ),
        Index("idx_profile_org_level_xp", "org_id", "current_level", "total_xp"),
        Index(
            "idx_profile_streak_login",
            "org_id",
            "current_login_streak",
            postgresql_ops={"current_login_streak": "DESC"},
        ),
        Index(
            "idx_profile_streak_learning",
            "org_id",
            "current_learning_streak",
            postgresql_ops={"current_learning_streak": "DESC"},
        ),
        CheckConstraint("total_xp >= 0", name="ck_profile_total_xp_positive"),
        CheckConstraint("current_level >= 1", name="ck_profile_current_level_positive"),
        CheckConstraint(
            "xp_to_next_level >= 0", name="ck_profile_xp_to_next_level_positive"
        ),
        CheckConstraint(
            "level_progress_percent >= 0 AND level_progress_percent <= 100",
            name="ck_profile_progress_percent",
        ),
        CheckConstraint(
            "daily_xp_limit >= daily_goal_xp", name="ck_profile_daily_limit_goal"
        ),
        CheckConstraint(
            "current_login_streak <= longest_login_streak",
            name="ck_profile_login_streak_logic",
        ),
        CheckConstraint(
            "current_learning_streak <= longest_learning_streak",
            name="ck_profile_learning_streak_logic",
        ),
    )

    # Primary fields
    id: int = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # XP and leveling (server authoritative; xp_in_level + xp_to_next_level allow cheap progress calc)
    total_xp: int = Field(default=0, ge=0)
    current_level: int = Field(default=1, ge=1)
    xp_in_level: int = Field(default=0, ge=0)
    xp_to_next_level: int = Field(default=100, ge=0)  # Remaining XP for next level
    level_progress_percent: float = Field(default=0.0, ge=0.0, le=100.0)

    # Streak tracking
    current_login_streak: int = Field(default=0, ge=0)
    longest_login_streak: int = Field(default=0, ge=0)
    current_learning_streak: int = Field(default=0, ge=0)
    longest_learning_streak: int = Field(default=0, ge=0)
    current_daily_goal_streak: int = Field(default=0, ge=0)
    longest_daily_goal_streak: int = Field(default=0, ge=0)

    # Activity tracking
    last_login_date: datetime | None = Field(default=None)
    last_learning_activity_date: datetime | None = Field(default=None)
    last_xp_award_date: datetime | None = Field(default=None)

    # Daily limits and tracking
    daily_xp_earned: int = Field(default=0, ge=0)
    daily_xp_limit: int = Field(default=500, ge=0)
    daily_goal_xp: int = Field(default=50, ge=0)

    # Engagement metrics
    total_sessions: int = Field(default=0, ge=0)
    total_activities_completed: int = Field(default=0, ge=0)
    total_courses_completed: int = Field(default=0, ge=0)
    avg_session_duration: float = Field(default=0.0, ge=0.0)  # In minutes

    # Preferences (embedded for performance)
    preferences: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Soft delete support
    is_active: bool = Field(default=True, index=True)
    deleted_at: datetime | None = Field(default=None)

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Optimistic locking
    version: int = Field(default=1, ge=1)


# ============================================================================
# XP Transactions
# ============================================================================


class XPTransaction(SQLModelStrictBaseModel, table=True):
    """
    Individual XP transactions with complete audit trail.
    Immutable once created for compliance and debugging.
    """

    __tablename__ = "xp_transactions"
    __table_args__ = (
        Index("idx_xp_user_org", "user_id", "org_id"),
        Index("idx_xp_source", "source"),
        Index("idx_xp_created", "created_at"),
        Index("idx_xp_user_source", "user_id", "source"),
        Index("idx_xp_org_created", "org_id", "created_at"),
        Index(
            "idx_xp_date_partition", "created_at", postgresql_using="btree"
        ),  # For partitioning
        UniqueConstraint("idempotency_key", name="uq_xp_idempotency_key"),
        # Prevent awarding same (source, source_id) twice to same user/org (e.g. duplicate activity completion)
        UniqueConstraint(
            "user_id",
            "org_id",
            "source",
            "source_id",
            name="uq_xp_user_org_source_sourceid",
        ),
        CheckConstraint("xp_amount > 0", name="ck_xp_transaction_amount_positive"),
        CheckConstraint("multiplier_applied > 0", name="ck_xp_multiplier_positive"),
        CheckConstraint("bonus_xp >= 0", name="ck_xp_bonus_non_negative"),
    )

    # Primary fields
    id: int = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Transaction details
    xp_amount: int = Field(gt=0)  # Must be positive
    source: XPSource = Field()
    source_id: str | None = Field(
        default=None, max_length=255
    )  # Reference to source entity
    idempotency_key: str | None = Field(default=None, max_length=100, index=True)

    # Additional context
    multiplier_applied: float = Field(default=1.0, ge=0.1, le=10.0)
    bonus_xp: int = Field(default=0, ge=0)
    reason: str | None = Field(default=None, max_length=500)

    # Metadata for debugging and analysis
    transaction_metadata: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )

    # Audit fields
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_by_admin: bool = Field(default=False)
    admin_user_id: int | None = Field(default=None, foreign_key="user.id")

    # Achievement tracking
    triggered_level_up: bool = Field(default=False)
    previous_level: int = Field(default=1, ge=1)
    new_level: int = Field(default=1, ge=1)


# ============================================================================
# Streak Records
# ============================================================================


class StreakRecord(SQLModelStrictBaseModel, table=True):
    """
    Historical streak data for detailed analytics and recovery.
    Tracks streak milestones and provides data for insights.
    """

    __tablename__ = "streak_records"
    __table_args__ = (
        Index("idx_streak_user_type", "user_id", "streak_type"),
        Index("idx_streak_org_type", "org_id", "streak_type"),
        Index("idx_streak_date", "date"),
        UniqueConstraint(
            "user_id", "org_id", "streak_type", "date", name="uq_streak_daily"
        ),
    )

    # Primary fields
    id: int = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Streak details
    streak_type: StreakType = Field()
    date: datetime = Field(index=True)  # Date of this streak record
    streak_count: int = Field(ge=0)  # Current streak count on this date
    is_milestone: bool = Field(default=False)  # Was this a milestone day?

    # Context
    activities_completed: int = Field(default=0, ge=0)
    xp_earned_today: int = Field(default=0, ge=0)

    # Metadata
    streak_metadata: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Achievements
# ============================================================================


class Achievement(SQLModelStrictBaseModel, table=True):
    """
    Available achievements within an organization.
    Templates for what users can unlock.
    """

    __tablename__ = "achievements"
    __table_args__ = (
        UniqueConstraint("org_id", "achievement_key", name="uq_achievement_org_key"),
        Index("idx_achievement_org", "org_id"),
        Index("idx_achievement_type", "achievement_type"),
    )

    # Primary fields
    id: int = Field(primary_key=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Achievement definition
    achievement_key: str = Field(max_length=100, index=True)  # Unique identifier
    achievement_type: AchievementType = Field()

    # Display information
    title: str = Field(max_length=200)
    description: str = Field(sa_column=Column(Text))
    icon_url: str | None = Field(default=None, max_length=500)

    # Requirements and rewards
    requirements: dict[str, Any] = Field(
        sa_column=Column(JSON)
    )  # Flexible requirement system
    xp_reward: int = Field(default=0, ge=0)
    unlock_level: int = Field(default=1, ge=1)

    # Metadata
    is_active: bool = Field(default=True)
    sort_order: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class UserAchievement(SQLModelStrictBaseModel, table=True):
    """
    Achievements unlocked by users.
    Tracks progress and completion.
    """

    __tablename__ = "user_achievements"
    __table_args__ = (
        UniqueConstraint("user_id", "achievement_id", name="uq_user_achievement"),
        Index("idx_user_achievement_user", "user_id"),
        Index("idx_user_achievement_org", "org_id"),
        Index("idx_user_achievement_unlocked", "unlocked_at"),
    )

    # Primary fields
    id: int = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)
    achievement_id: int = Field(foreign_key="achievements.id")

    # Progress tracking
    progress_percent: float = Field(default=0.0, ge=0.0, le=100.0)
    is_unlocked: bool = Field(default=False)
    unlocked_at: datetime | None = Field(default=None)

    # Context
    progress_data: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Leaderboard Snapshots
# ============================================================================


class LeaderboardSnapshot(SQLModelStrictBaseModel, table=True):
    """
    Pre-computed leaderboard snapshots for performance.
    Updated periodically and cached for fast retrieval.
    """

    __tablename__ = "leaderboard_snapshots"
    __table_args__ = (
        UniqueConstraint(
            "org_id",
            "leaderboard_type",
            "period",
            "snapshot_date",
            name="uq_leaderboard_snapshot",
        ),
        Index("idx_leaderboard_org_type", "org_id", "leaderboard_type"),
        Index("idx_leaderboard_date", "snapshot_date"),
    )

    # Primary fields
    id: int = Field(primary_key=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Snapshot details
    leaderboard_type: str = Field(max_length=50)  # 'xp', 'streaks', 'achievements'
    period: str = Field(max_length=20)  # 'daily', 'weekly', 'monthly', 'all_time'
    snapshot_date: datetime = Field(index=True)

    # Leaderboard data
    leaderboard_data: list[dict[str, Any]] = Field(sa_column=Column(JSON))
    total_participants: int = Field(default=0, ge=0)

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


# ============================================================================
# Preference Models
# ============================================================================


class UserGamificationPreferenceRead(PydanticStrictBaseModel):
    """Response model for user gamification preferences."""

    user_id: int
    org_id: int
    notifications_enabled: bool = True
    daily_goal_xp: int = 50
    show_leaderboard: bool = True
    show_streaks: bool = True
    show_achievements: bool = True


class UserGamificationPreferenceUpsert(PydanticStrictBaseModel):
    """Request model for updating user gamification preferences."""

    notifications_enabled: bool | None = None
    daily_goal_xp: int | None = None
    show_leaderboard: bool | None = None
    show_streaks: bool | None = None
    show_achievements: bool | None = None


# ============================================================================
# Pydantic Response Models
# ============================================================================


class UserGamificationProfileRead(PydanticStrictBaseModel):
    """Response model for user gamification profiles."""

    id: int
    user_id: int
    org_id: int
    total_xp: int
    current_level: int
    xp_to_next_level: int
    level_progress_percent: float
    xp_in_level: int | None = None
    current_login_streak: int
    longest_login_streak: int
    current_learning_streak: int
    longest_learning_streak: int
    last_login_date: datetime | None
    last_learning_activity_date: datetime | None
    last_xp_award_date: datetime | None
    daily_xp_earned: int
    daily_xp_limit: int
    daily_goal_xp: int
    total_sessions: int
    total_activities_completed: int
    total_courses_completed: int
    avg_session_duration: float
    preferences: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    version: int


class UserGamificationProfileCreate(PydanticStrictBaseModel):
    """Request model for creating user gamification profiles."""

    user_id: int
    org_id: int
    daily_goal_xp: int = 50


class UserGamificationProfileUpdate(PydanticStrictBaseModel):
    """Request model for updating user gamification profiles."""

    daily_goal_xp: int | None = None
    preferences: dict[str, Any] | None = None


class XPTransactionRead(PydanticStrictBaseModel):
    """Response model for XP transactions."""

    id: int
    user_id: int
    org_id: int
    xp_amount: int
    source: XPSource
    source_id: str | None
    multiplier_applied: float
    bonus_xp: int
    reason: str | None
    transaction_metadata: dict[str, Any]
    created_at: datetime
    created_by_admin: bool
    admin_user_id: int | None
    triggered_level_up: bool
    previous_level: int
    new_level: int
    idempotency_key: str | None

    # Accept cached JSON where 'source' was serialized as plain string
    @field_validator("source", mode="before")
    @classmethod
    def _coerce_source(cls, v):  # type: ignore[override]
        if isinstance(v, XPSource):
            return v
        if isinstance(v, str):
            try:
                return XPSource(v)
            except ValueError:
                # Unknown source: keep raw string to avoid hard failure; caller can handle
                return v  # type: ignore[return-value]
        return v


class XPAwardResponse(PydanticStrictBaseModel):
    """Response model for XP awards aligned with frontend expectations.

    Contains full transaction + updated profile snapshot and achievement info.
    """

    transaction: XPTransactionRead
    profile: UserGamificationProfileRead
    level_up_occurred: bool
    previous_level: int
    achievements_unlocked: list[str] | None = None
    # Indicates whether this award created a NEW transaction (True) or returned a cached/idempotent existing one (False)
    is_new_transaction: bool = True


class StreakRecordRead(PydanticStrictBaseModel):
    """Response model for streak records."""

    id: int
    user_id: int
    org_id: int
    streak_type: StreakType
    date: datetime
    streak_count: int
    is_milestone: bool
    activities_completed: int
    xp_earned_today: int
    streak_metadata: dict[str, Any]
    created_at: datetime


class OrganizationLeaderboard(PydanticStrictBaseModel):
    """Organization leaderboard data."""

    org_id: int
    leaderboard_type: str
    period: str
    leaderboard_entries: list[dict[str, Any]]
    total_participants: int
    current_user_rank: int | None = None
    last_updated: datetime

    # Strict mode disallows automatic coercion of str -> datetime; cached JSON restores
    # datetimes as ISO strings. We accept ISO 8601 strings and convert explicitly.
    @field_validator("last_updated", mode="before")
    @classmethod
    def _coerce_last_updated(cls, v):  # type: ignore[override]
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                # fromisoformat supports the offset like +00:00 used in cache
                return datetime.fromisoformat(v)
            except ValueError:
                # Fallback: try parsing without microseconds / Z replacement
                v2 = v.replace("Z", "+00:00")
                try:
                    return datetime.fromisoformat(v2)
                except Exception as e:  # pragma: no cover - defensive
                    msg = f"Invalid datetime string for last_updated: {v}"
                    raise ValueError(msg) from e
        msg = "last_updated must be datetime or ISO 8601 string"
        raise TypeError(msg)


class AchievementRead(PydanticStrictBaseModel):
    """Response model for achievements."""

    id: int
    org_id: int
    achievement_key: str
    achievement_type: AchievementType
    title: str
    description: str
    icon_url: str | None
    requirements: dict[str, Any]
    xp_reward: int
    unlock_level: int
    is_active: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class UserAchievementRead(PydanticStrictBaseModel):
    """Response model for user achievements."""

    id: int
    user_id: int
    org_id: int
    achievement_id: int
    progress_percent: float
    is_unlocked: bool
    unlocked_at: datetime | None
    progress_data: dict[str, Any]
    created_at: datetime
    updated_at: datetime

    # Achievement details (joined)
    achievement: AchievementRead | None = None
    longest_streaks: list[dict[str, Any]]

    # Activity breakdown
    xp_by_source: dict[str, int]
    completion_rates: dict[str, float]
