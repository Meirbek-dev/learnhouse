"""
Clean Gamification Models - Single Source of Truth

Simplified approach:
- One profile model with consistent naming
- Simple XP transaction audit trail
- No over-engineering or unnecessary complexity
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Optional

from sqlalchemy import JSON, CheckConstraint, Column, Index, UniqueConstraint
from sqlmodel import Field, SQLModel

# Simple configuration constants
XP_REWARDS = {
    "activity_completion": 25,
    "course_completion": 200,
    "login_bonus": 10,
    "quiz_completion": 30,
    "assignment_submission": 75,
    "streak_bonus": 50,
    "admin_award": 0,  # Custom amount required
}

DAILY_XP_LIMIT = 500
MAX_LEVEL = 50


class XPSource(str, Enum):
    """XP source types"""

    ACTIVITY_COMPLETION = "activity_completion"
    COURSE_COMPLETION = "course_completion"
    LOGIN_BONUS = "login_bonus"
    QUIZ_COMPLETION = "quiz_completion"
    ASSIGNMENT_SUBMISSION = "assignment_submission"
    STREAK_BONUS = "streak_bonus"
    ADMIN_AWARD = "admin_award"


class StreakType(str, Enum):
    """Streak types"""

    LOGIN = "login"
    LEARNING = "learning"


def calculate_level(total_xp: int) -> int:
    """Calculate level from total XP - 100 XP per level"""
    if total_xp <= 0:
        return 1
    return min((total_xp // 100) + 1, MAX_LEVEL)


def get_xp_for_level(level: int) -> int:
    """Calculate total XP required to reach a given level"""
    if level <= 1:
        return 0
    return (level - 1) * 100


class GamificationProfile(SQLModel, table=True):
    """Single gamification profile model with consistent naming"""

    __tablename__ = "gamification_profiles"

    id: int = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Core progression
    total_xp: int = Field(default=0, ge=0)
    level: int = Field(default=1, ge=1, le=MAX_LEVEL)
    daily_xp_earned: int = Field(default=0, ge=0)

    # Streaks with consistent naming
    login_streak: int = Field(default=0, ge=0)
    learning_streak: int = Field(default=0, ge=0)
    longest_login_streak: int = Field(default=0, ge=0)
    longest_learning_streak: int = Field(default=0, ge=0)

    # Activity counters
    total_activities_completed: int = Field(default=0, ge=0)
    total_courses_completed: int = Field(default=0, ge=0)

    # Timestamps
    last_xp_award_date: datetime | None = Field(default=None)
    last_login_date: datetime | None = Field(default=None)
    last_learning_date: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    # Preferences
    preferences: dict = Field(default_factory=dict, sa_column=Column(JSON))

    # Database constraints
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uq_gamification_profile_user_org"),
        CheckConstraint("total_xp >= 0", name="ck_total_xp_positive"),
        CheckConstraint("level >= 1 AND level <= 50", name="ck_level_range"),
        Index("idx_profile_org_xp", "org_id", "total_xp"),
    )

    # Computed properties
    @property
    def xp_to_next_level(self) -> int:
        """XP needed to reach next level"""
        if self.level >= MAX_LEVEL:
            return 0
        return get_xp_for_level(self.level + 1) - self.total_xp

    @property
    def level_progress_percent(self) -> float:
        """Progress through current level (0.0 to 100.0)"""
        if self.level >= MAX_LEVEL:
            return 100.0
        current_level_xp = get_xp_for_level(self.level)
        next_level_xp = get_xp_for_level(self.level + 1)
        if next_level_xp == current_level_xp:
            return 100.0
        progress = (self.total_xp - current_level_xp) / (
            next_level_xp - current_level_xp
        )
        return round(progress * 100.0, 1)

    @property
    def xp_in_current_level(self) -> int:
        """XP earned in current level"""
        return self.total_xp - get_xp_for_level(self.level)


class XPTransaction(SQLModel, table=True):
    """XP transaction audit trail"""

    __tablename__ = "xp_transactions"

    id: int = Field(primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Transaction data
    amount: int = Field(gt=0)
    source: XPSource = Field(index=True)
    source_id: str | None = Field(default=None)
    reason: str | None = Field(default=None)

    # Level tracking
    previous_level: int = Field(ge=1)
    triggered_level_up: bool = Field(default=False)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)

    # Idempotency
    idempotency_key: str | None = Field(default=None, unique=True)

    __table_args__ = (
        Index("idx_transaction_user_org", "user_id", "org_id"),
        Index("idx_transaction_source", "source", "source_id"),
    )


# NOTE: No backward-compatibility aliases; use GamificationProfile directly
