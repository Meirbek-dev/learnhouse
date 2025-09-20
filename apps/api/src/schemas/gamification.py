"""Simple API schemas for gamification (unified with database models)."""

from datetime import datetime
from typing import Any

from src.db.gamification import XPSource
from src.db.strict_base_model import PydanticStrictBaseModel


class ProfileRead(PydanticStrictBaseModel):
    """User gamification profile for API responses."""

    user_id: int
    org_id: int
    total_xp: int
    level: int
    xp_in_current_level: int
    xp_to_next_level: int
    level_progress_percent: float
    login_streak: int
    longest_login_streak: int
    learning_streak: int
    longest_learning_streak: int
    last_xp_award_date: datetime | None
    last_login_date: datetime | None
    last_learning_date: datetime | None
    daily_xp_earned: int
    total_activities_completed: int
    total_courses_completed: int
    preferences: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class TransactionRead(PydanticStrictBaseModel):
    """XP transaction for API responses."""

    id: int
    user_id: int
    org_id: int
    amount: int
    source: XPSource
    source_id: str | None
    triggered_level_up: bool
    previous_level: int
    created_at: datetime


class DashboardRead(PydanticStrictBaseModel):
    """Dashboard data combining profile and recent transactions."""

    profile: ProfileRead
    recent_transactions: list[TransactionRead]


class LeaderboardEntryRead(PydanticStrictBaseModel):
    """Single leaderboard entry.

    Optional username included for richer leaderboard displays. Avatar or other
    profile data intentionally omitted to keep payload small; can be added later.
    """

    rank: int
    user_id: int
    total_xp: int
    level: int
    username: str | None = None


class LeaderboardRead(PydanticStrictBaseModel):
    """Organization leaderboard."""

    org_id: int
    entries: list[LeaderboardEntryRead]
    total_participants: int


class StreakUpdateRead(PydanticStrictBaseModel):
    """Streak update response."""

    streak_type: str
    current_count: int
    longest_count: int
    is_new_record: bool


class XPAwardRequest(PydanticStrictBaseModel):
    """Request to award XP."""

    source: XPSource
    source_id: str | None = None
    custom_amount: int | None = None
    idempotency_key: str | None = None


class XPAwardResponse(PydanticStrictBaseModel):
    """Response from XP award operation."""

    transaction: TransactionRead
    profile: ProfileRead
    level_up_occurred: bool
    previous_level: int
    is_new_transaction: bool
