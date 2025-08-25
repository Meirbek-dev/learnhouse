from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Optional

from pydantic import ConfigDict, Field as PydanticField
from sqlalchemy import JSON, Column, ForeignKey, Integer, UniqueConstraint, Index
from sqlmodel import Field

from src.db.strict_base_model import PydanticStrictBaseModel, SQLModelStrictBaseModel


class StreakTypeEnum(str, Enum):
    LOGIN = "login"
    LEARNING = "learning"


class UserGamificationProfile(SQLModelStrictBaseModel, table=True):
    __tablename__ = "usergamificationprofile"
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uk_gamification_user_org"),
        Index("idx_gamification_leaderboard", "org_id", "total_xp"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # XP and Level data
    total_xp: int = Field(default=0, ge=0)
    current_level: int = Field(default=1, ge=1)

    # Streak data
    current_login_streak: int = Field(default=0, ge=0)
    longest_login_streak: int = Field(default=0, ge=0)
    current_learning_streak: int = Field(default=0, ge=0)
    longest_learning_streak: int = Field(default=0, ge=0)

    # Date tracking
    last_login_date: Optional[datetime] = Field(default=None)
    last_learning_activity_date: Optional[datetime] = Field(default=None)

    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Version field for optimistic locking
    version: int = Field(default=1)


class UserGamificationProfileBase(SQLModelStrictBaseModel):
    user_id: int
    org_id: int
    total_xp: int = Field(default=0, ge=0)
    current_level: int = Field(default=1, ge=1)
    current_login_streak: int = Field(default=0, ge=0)
    longest_login_streak: int = Field(default=0, ge=0)
    current_learning_streak: int = Field(default=0, ge=0)
    longest_learning_streak: int = Field(default=0, ge=0)
    last_login_date: Optional[datetime] = None
    last_learning_activity_date: Optional[datetime] = None


class UserGamificationProfileCreate(UserGamificationProfileBase):
    pass


class UserGamificationProfileUpdate(SQLModelStrictBaseModel):
    total_xp: Optional[int] = Field(default=None, ge=0)
    current_level: Optional[int] = Field(default=None, ge=1)
    current_login_streak: Optional[int] = Field(default=None, ge=0)
    longest_login_streak: Optional[int] = Field(default=None, ge=0)
    current_learning_streak: Optional[int] = Field(default=None, ge=0)
    longest_learning_streak: Optional[int] = Field(default=None, ge=0)
    last_login_date: Optional[datetime] = None
    last_learning_activity_date: Optional[datetime] = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: Optional[int] = None


class UserGamificationProfileRead(UserGamificationProfileBase):
    id: int
    created_at: datetime
    updated_at: datetime
    version: int


class XPTransaction(SQLModelStrictBaseModel, table=True):
    __tablename__ = "xptransaction"
    __table_args__ = (
        Index("idx_xp_user_org_date", "user_id", "org_id", "created_at"),
        Index("idx_xp_idempotency", "idempotency_key", postgresql_where=Column("idempotency_key").isnot(None), unique=True),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Transaction data
    xp_amount: int = Field(ge=0)
    source: str = Field(max_length=100)  # e.g., "activity_completion", "login_daily"
    source_id: Optional[str] = Field(default=None, max_length=255)  # e.g., activity UUID

    # Idempotency and metadata
    idempotency_key: Optional[str] = Field(default=None, max_length=255, unique=True)
    transaction_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), index=True)


class XPTransactionBase(SQLModelStrictBaseModel):
    user_id: int
    org_id: int
    xp_amount: int = Field(ge=0)
    source: str = Field(max_length=100)
    source_id: Optional[str] = Field(default=None, max_length=255)
    idempotency_key: Optional[str] = Field(default=None, max_length=255)
    transaction_metadata: Optional[Dict[str, Any]] = None


class XPTransactionCreate(XPTransactionBase):
    pass


class XPTransactionRead(XPTransactionBase):
    id: int
    created_at: datetime


class StreakRecord(SQLModelStrictBaseModel, table=True):
    __tablename__ = "streakrecord"
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", "streak_type", "date", name="uk_streak_user_org_type_date"),
        Index("idx_streak_user_org_type", "user_id", "org_id", "streak_type"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Streak data
    streak_type: StreakTypeEnum
    date: datetime = Field(index=True)  # Date of the streak activity (date only, no time)
    streak_count: int = Field(ge=0)

    # Metadata
    record_metadata: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class StreakRecordBase(SQLModelStrictBaseModel):
    user_id: int
    org_id: int
    streak_type: StreakTypeEnum
    date: datetime
    streak_count: int = Field(ge=0)
    record_metadata: Optional[Dict[str, Any]] = None


class StreakRecordCreate(StreakRecordBase):
    pass


class StreakRecordUpdate(SQLModelStrictBaseModel):
    streak_count: Optional[int] = Field(default=None, ge=0)
    record_metadata: Optional[Dict[str, Any]] = None


class StreakRecordRead(StreakRecordBase):
    id: int
    created_at: datetime


class UserGamificationPreference(SQLModelStrictBaseModel, table=True):
    __tablename__ = "usergamificationpreference"
    __table_args__ = (
        UniqueConstraint("user_id", "org_id", name="uk_gamification_pref_user_org"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    org_id: int = Field(foreign_key="organization.id", index=True)

    # Preference data stored as JSON
    preferences: Dict[str, Any] = Field(sa_column=Column(JSON))

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class UserGamificationPreferenceRead(SQLModelStrictBaseModel):
    id: int
    user_id: int
    org_id: int
    preferences: Dict[str, Any]
    created_at: datetime
    updated_at: datetime


class UserGamificationPreferenceUpsert(SQLModelStrictBaseModel):
    preferences: Dict[str, Any]


# Response models for comprehensive data
class GamificationDashboard(PydanticStrictBaseModel):
    model_config = ConfigDict(from_attributes=True)

    profile: UserGamificationProfileRead
    recent_transactions: list[XPTransactionRead]
    daily_xp_history: list[Dict[str, Any]]  # Last 30 days
    weekly_summary: Dict[str, Any]
    achievements_unlocked: list[str]
    next_level_info: Dict[str, Any]


class OrganizationLeaderboard(PydanticStrictBaseModel):
    model_config = ConfigDict(from_attributes=True)

    org_id: int
    leaderboard_entries: list[Dict[str, Any]]  # Will include user details + XP
    total_participants: int
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class XPAwardRequest(SQLModelStrictBaseModel):
    source: str = Field(max_length=100)
    source_id: Optional[str] = Field(default=None, max_length=255)
    xp_amount: Optional[int] = Field(default=None, ge=0)  # If None, use default from source
    idempotency_key: str = Field(max_length=255)
    transaction_metadata: Optional[Dict[str, Any]] = None


class XPAwardResponse(PydanticStrictBaseModel):
    model_config = ConfigDict(from_attributes=True)

    transaction: XPTransactionRead
    profile_updated: UserGamificationProfileRead
    level_up: bool = False
    previous_level: Optional[int] = None
