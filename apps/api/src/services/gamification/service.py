"""
Legacy Gamification Service

NOTE: This service is being replaced by simple_service.py
Only critical fixes applied here to prevent breaking changes.
"""

from datetime import UTC, datetime
from typing import List, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, and_, select

from src.db.gamification import (
    DAILY_XP_LIMIT,
    XP_REWARDS,
    GamificationProfile,
    StreakType,
    XPSource,
    XPTransaction,
    calculate_level,
)


class GamificationError(Exception):
    """Base gamification error"""


class DailyLimitExceededError(GamificationError):
    """Daily XP limit exceeded"""


class GamificationService:
    """Legacy gamification service - being replaced"""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_or_create_profile(self, user_id: int, org_id: int) -> GamificationProfile:
        """Get or create user profile"""
        stmt = select(GamificationProfile).where(
            and_(
                GamificationProfile.user_id == user_id,
                GamificationProfile.org_id == org_id,
            )
        )
        profile = self.db.exec(stmt).first()

        if not profile:
            profile = GamificationProfile(user_id=user_id, org_id=org_id)
            self.db.add(profile)
            self.db.commit()
            self.db.refresh(profile)

        return profile
