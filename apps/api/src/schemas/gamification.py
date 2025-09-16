"""Public API Schemas for Gamification (decoupled from persistence).

These Pydantic models represent the stable wire contracts that the API returns.
Keep these lean and independent from SQLModel DB entities to avoid coupling
and import cycles.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from src.db.strict_base_model import PydanticStrictBaseModel


class ProfileRead(PydanticStrictBaseModel):
    user_id: int
    org_id: int
    total_xp: int
    current_level: int
    xp_in_level: int
    xp_to_next: int
    progress: float
    updated_at: datetime
    # Simplified streaks contract: counts only; detailed info is in streak summary endpoint
    streaks: dict[str, int] | None = None


class RecentTransactionRead(PydanticStrictBaseModel):
    transaction_id: int
    amount: int
    source: str
    source_id: str | None = None
    created_at: datetime
    metadata: dict[str, Any] | None = None


class DashboardRead(PydanticStrictBaseModel):
    profile: ProfileRead
    recent_tx: list[RecentTransactionRead]
    preferences: dict[str, Any] | None = None


class LeaderboardEntryRead(PydanticStrictBaseModel):
    rank: int
    user_id: int
    username: str | None
    total_xp: int
    current_level: int
    is_current_user: bool = False


class LeaderboardRead(PydanticStrictBaseModel):
    org_id: int
    entries: list[LeaderboardEntryRead]
    total_participants: int
    last_updated: datetime
    current_user_rank: int | None = None


class StreakUpdateRead(PydanticStrictBaseModel):
    profile: ProfileRead
    streak_updated: bool
    message: str | None = None


class StreakDetailRead(PydanticStrictBaseModel):
    current: int
    longest: int
    last_activity: datetime | None
    status: str  # 'active_today' | 'due_today' | 'inactive' | 'broken'
    next_milestone: int | None = None


class StreakRecordItemRead(PydanticStrictBaseModel):
    streak_type: str
    streak_count: int
    is_milestone: bool
    activities_completed: int
    xp_earned_today: int
    date: datetime
    metadata: dict[str, Any] | None = None


class StreakSummaryRead(PydanticStrictBaseModel):
    login_streak: StreakDetailRead
    learning_streak: StreakDetailRead
    milestones: dict[int, int]
    grace_period_hours: int
    recent_records: list[StreakRecordItemRead]
