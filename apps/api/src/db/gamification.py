from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import ConfigDict, Field as PydanticField
from sqlalchemy import JSON, Column, Integer, ForeignKey, DateTime
from sqlmodel import Field

from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


class StreakTypeEnum(str, Enum):
    """Types of streaks that can be tracked"""

    LOGIN = "LOGIN"
    LEARNING = "LEARNING"
    ACTIVITY_COMPLETION = "ACTIVITY_COMPLETION"
    COURSE_COMPLETION = "COURSE_COMPLETION"


class UserGamificationProfile(SQLModelStrictBaseModel, table=True):
    """
    Core gamification profile for each user.
    Tracks overall XP, level, and gamification status.
    """

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )

    # Core gamification metrics
    total_xp: int = Field(default=0)
    current_level: int = Field(default=1)
    xp_to_next_level: int = Field(default=100)

    # Streak data
    current_login_streak: int = Field(default=0)
    longest_login_streak: int = Field(default=0)
    current_learning_streak: int = Field(default=0)
    longest_learning_streak: int = Field(default=0)

    # Last activity tracking for streak calculations
    last_login_date: str | None = None
    last_learning_activity_date: str | None = None

    # Additional gamification metadata
    profile_data: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
    )

    # Timestamps
    creation_date: str = str(datetime.now())
    update_date: str = str(datetime.now())


class UserGamificationProfileBase(SQLModelStrictBaseModel):
    user_id: int
    org_id: int
    total_xp: int = 0
    current_level: int = 1
    xp_to_next_level: int = 100
    current_login_streak: int = 0
    longest_login_streak: int = 0
    current_learning_streak: int = 0
    longest_learning_streak: int = 0
    last_login_date: str | None = None
    last_learning_activity_date: str | None = None
    profile_data: dict[str, Any] = Field(default_factory=dict)


class UserGamificationProfileCreate(UserGamificationProfileBase):
    pass


class UserGamificationProfileUpdate(SQLModelStrictBaseModel):
    total_xp: int | None = None
    current_level: int | None = None
    xp_to_next_level: int | None = None
    current_login_streak: int | None = None
    longest_login_streak: int | None = None
    current_learning_streak: int | None = None
    longest_learning_streak: int | None = None
    last_login_date: str | None = None
    last_learning_activity_date: str | None = None
    profile_data: dict[str, Any] | None = None


class UserGamificationProfileRead(UserGamificationProfileBase):
    id: int
    creation_date: str
    update_date: str


class XPTransaction(SQLModelStrictBaseModel, table=True):
    """
    Records all XP transactions for transparency and analytics.
    Tracks every XP gain/loss with detailed context.
    """

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )

    # Transaction details
    xp_amount: int = Field(description="XP gained/lost (negative for penalties)")
    xp_source: str = Field(
        description="Source of XP (activity_completion, login_streak, etc.)"
    )
    xp_context: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
        description="Additional context about the XP transaction",
    )

    # Related entity tracking (optional)
    related_activity_id: int | None = None
    related_course_id: int | None = None
    related_trail_step_id: int | None = None

    # Timestamps
    creation_date: str = str(datetime.now())


class XPTransactionBase(SQLModelStrictBaseModel):
    user_id: int
    org_id: int
    xp_amount: int
    xp_source: str
    xp_context: dict[str, Any] = Field(default_factory=dict)
    related_activity_id: int | None = None
    related_course_id: int | None = None
    related_trail_step_id: int | None = None


class XPTransactionCreate(XPTransactionBase):
    pass


class XPTransactionRead(XPTransactionBase):
    id: int
    creation_date: str


class StreakRecord(SQLModelStrictBaseModel, table=True):
    """
    Detailed streak tracking for different types of streaks.
    Maintains historical data for analytics and recovery.
    """

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(
        sa_column=Column(Integer, ForeignKey("user.id", ondelete="CASCADE"))
    )
    org_id: int = Field(
        sa_column=Column(Integer, ForeignKey("organization.id", ondelete="CASCADE"))
    )

    # Streak details
    streak_type: StreakTypeEnum
    current_count: int = Field(default=0)
    longest_count: int = Field(default=0)

    # Date tracking
    streak_start_date: str | None = None
    last_activity_date: str | None = None
    streak_end_date: str | None = None  # Set when streak is broken

    # Streak metadata
    streak_data: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON),
        description="Additional streak context and metadata",
    )

    # Active status
    is_active: bool = Field(default=True)

    # Timestamps
    creation_date: str = str(datetime.now())
    update_date: str = str(datetime.now())

    @classmethod
    def validate_streak_type(cls, v):
        if isinstance(v, str):
            return StreakTypeEnum(v)
        return v


class StreakRecordBase(SQLModelStrictBaseModel):
    user_id: int
    org_id: int
    streak_type: StreakTypeEnum
    current_count: int = 0
    longest_count: int = 0
    streak_start_date: str | None = None
    last_activity_date: str | None = None
    streak_end_date: str | None = None
    streak_data: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True


class StreakRecordCreate(StreakRecordBase):
    pass


class StreakRecordUpdate(SQLModelStrictBaseModel):
    current_count: int | None = None
    longest_count: int | None = None
    streak_start_date: str | None = None
    last_activity_date: str | None = None
    streak_end_date: str | None = None
    streak_data: dict[str, Any] | None = None
    is_active: bool | None = None


class StreakRecordRead(StreakRecordBase):
    id: int
    creation_date: str
    update_date: str


# Response models for comprehensive data
class GamificationDashboard(PydanticStrictBaseModel):
    """
    Comprehensive gamification data for dashboard display.
    """

    profile: UserGamificationProfileRead
    recent_xp_transactions: list[XPTransactionRead]
    active_streaks: list[StreakRecordRead]

    # Computed statistics
    total_activities_completed: int = 0
    total_courses_completed: int = 0
    total_certificates: int = 0
    rank_in_organization: int | None = None

    model_config = ConfigDict(arbitrary_types_allowed=True)


class OrganizationLeaderboard(PydanticStrictBaseModel):
    """
    Organization-wide leaderboard data.
    """

    org_id: int
    leaderboard_entries: list[dict[str, Any]]  # User profiles with rankings
    total_participants: int

    model_config = ConfigDict(arbitrary_types_allowed=True)
