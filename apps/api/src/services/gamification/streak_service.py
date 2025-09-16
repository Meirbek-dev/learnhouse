"""
Streak Service - Focused service for streak tracking and management

Updated to count streaks strictly by
server-day boundaries (UTC) — a streak increments only when a new server day
starts. Grace-period based calculations are no longer used for incrementing.
"""

from datetime import UTC, datetime, timedelta
import logging
from typing import Optional, Tuple

from sqlmodel import Session, and_, select
from src.db.gamification import (
    StreakRecord,
    StreakType,
    UserGamificationProfile,
    XPSource,
)
from src.services.gamification.cache_service import create_cache_service
from src.services.gamification.config import get_gamification_config
from src.services.gamification.result import Result
from src.services.gamification.xp_service import XPService

logger = logging.getLogger(__name__)


class StreakService:
    """Focused service for streak operations."""

    def __init__(self, db_session: Session) -> None:
        self.db_session = db_session
        self.config = get_gamification_config()
        self.xp_service = XPService(db_session)

    async def update_login_streak(self, user_id: int, org_id: int) -> Result[dict]:
        """Update login streak for user (Result)."""
        if not self.config.enable_streaks:
            return Result.success(
                {"streak_updated": False, "message": "Streaks disabled"}
            )
        data = await self._update_streak(user_id, org_id, StreakType.LOGIN)
        return (
            Result.success(data)
            if data.get("streak_updated") or data.get("message")
            else Result.fail("Failed to update streak", code="streak_error")
        )

    async def update_learning_streak(self, user_id: int, org_id: int) -> Result[dict]:
        """Update learning streak for user (Result)."""
        if not self.config.enable_streaks:
            return Result.success(
                {"streak_updated": False, "message": "Streaks disabled"}
            )
        data = await self._update_streak(user_id, org_id, StreakType.LEARNING)
        return (
            Result.success(data)
            if data.get("streak_updated") or data.get("message")
            else Result.fail("Failed to update streak", code="streak_error")
        )

    async def _update_streak(
        self, user_id: int, org_id: int, streak_type: StreakType
    ) -> dict:
        """Update streak with proper validation and bonus handling."""
        try:
            profile = await self.xp_service._get_or_create_profile(user_id, org_id)
            # Use server time (UTC) for streak day boundaries
            current_time = datetime.now(UTC)
            current_date = current_time.date()

            # Determine last activity date based on streak type
            if streak_type == StreakType.LOGIN:
                last_date = profile.last_login_date
                current_streak_attr = "current_login_streak"
                longest_streak_attr = "longest_login_streak"
                last_date_attr = "last_login_date"
            elif streak_type == StreakType.LEARNING:
                last_date = profile.last_learning_activity_date
                current_streak_attr = "current_learning_streak"
                longest_streak_attr = "longest_learning_streak"
                last_date_attr = "last_learning_activity_date"
            else:
                return {"streak_updated": False, "message": "Unsupported streak type"}

            # Check if already updated today (by server date)
            if last_date and self._to_server_date(last_date) == current_date:
                return {
                    "streak_updated": False,
                    "message": "Streak already updated today",
                    "current_streak": getattr(profile, current_streak_attr),
                }

            current_streak = getattr(profile, current_streak_attr)
            longest_streak = getattr(profile, longest_streak_attr)

            # Calculate new streak
            new_streak, streak_maintained = self._calculate_new_streak(
                last_date, current_time, current_streak
            )

            # Update profile
            setattr(profile, current_streak_attr, new_streak)
            setattr(profile, last_date_attr, current_time)

            # Update longest streak if needed
            if new_streak > longest_streak:
                setattr(profile, longest_streak_attr, new_streak)

            # Update engagement metrics
            if streak_type == StreakType.LOGIN:
                profile.total_sessions += 1

            # Check for milestone bonus
            milestone_bonus = 0
            if new_streak in self.config.streaks.milestone_bonuses:
                milestone_bonus = self.config.streaks.milestone_bonuses[new_streak]

                # Award milestone bonus XP
                if milestone_bonus > 0:
                    bonus_result = await self.xp_service.award_xp(
                        user_id=user_id,
                        org_id=org_id,
                        source=XPSource.STREAK_BONUS,
                        custom_amount=milestone_bonus,
                        source_id=f"{streak_type.value}_milestone_{new_streak}",
                        metadata={
                            "streak_type": streak_type.value,
                            "milestone": new_streak,
                            "bonus_xp": milestone_bonus,
                        },
                    )
                    if not bonus_result.ok:
                        # If failed treat as no bonus awarded
                        milestone_bonus = 0

            # Create streak record
            streak_record = StreakRecord(
                user_id=user_id,
                org_id=org_id,
                streak_type=streak_type,
                date=current_time,
                streak_count=new_streak,
                is_milestone=new_streak in self.config.streaks.milestone_bonuses,
                activities_completed=0,
                xp_earned_today=0,
                streak_metadata={
                    "milestone_bonus": milestone_bonus,
                    "streak_type": streak_type.value,
                },
            )

            # Daily login bonus (separate from milestone bonus). We award only for LOGIN streak
            # and only on first successful streak update of the day. Idempotency guaranteed by
            # (source, source_id) uniqueness: source_id encodes date.
            login_bonus_awarded = 0
            if streak_type == StreakType.LOGIN and (
                last_date is None
                or (last_date and self._to_server_date(last_date) != current_date)
            ):
                # Only award if this call actually advanced/maintained streak for a new day
                try:
                    daily_result = await self.xp_service.award_xp(
                        user_id=user_id,
                        org_id=org_id,
                        source=XPSource.LOGIN_BONUS,
                        source_id=f"login_daily:{current_date.isoformat()}",
                        metadata={
                            "streak_type": streak_type.value,
                            "streak_after": new_streak,
                            "reason": "daily_login_bonus",
                        },
                    )
                    if daily_result.ok:
                        login_bonus_awarded = daily_result.value.transaction.xp_amount
                except Exception:  # pragma: no cover - non critical path
                    logger.exception("Failed awarding daily login bonus")

            self.db_session.add(streak_record)
            self.db_session.add(profile)
            self.db_session.commit()

            # Refresh cache with updated profile (streak + potential XP bonuses)
            try:  # pragma: no cover - cache best effort
                cache = create_cache_service()
                cache.set_profile(user_id, org_id, profile)
            except Exception:  # pragma: no cover
                logger.debug(
                    "Failed updating profile cache after streak update", exc_info=True
                )

            logger.info(
                f"Streak updated: user={user_id}, type={streak_type}, streak={new_streak}, bonus={milestone_bonus}"
            )

            return {
                "streak_updated": True,
                "streak_type": streak_type.value,
                "current_streak": new_streak,
                "longest_streak": max(new_streak, longest_streak),
                "streak_maintained": streak_maintained,
                "milestone_bonus": milestone_bonus,
                "login_bonus_awarded": login_bonus_awarded,
                "message": f"Streak updated to {new_streak} days",
            }

        except Exception as e:
            self.db_session.rollback()
            logger.exception(f"Error updating streak: {e}")
            return {
                "streak_updated": False,
                "message": f"Failed to update streak: {e!s}",
            }

    def _calculate_new_streak(
        self, last_date: datetime | None, current_time: datetime, current_streak: int
    ) -> tuple[int, bool]:
        """
        Calculate new streak count based strictly on server (UTC) calendar days.

        Rules:
        - If it's the same server day as the last activity, don't change the streak.
        - If it's exactly the next server day, increment the streak.
        - If more than one server day has passed, reset the streak to 1.

        Returns a tuple of (new_streak_count, streak_maintained).
        """
        if not last_date:
            # First ever activity
            return 1, True

        # Convert last activity to server date (UTC)
        last_server_date = (
            last_date.astimezone(UTC).date()
            if last_date.tzinfo is not None
            else last_date.date()
        )
        current_server_date = (
            current_time.astimezone(UTC).date()
            if current_time.tzinfo is not None
            else current_time.date()
        )

        days_diff = (current_server_date - last_server_date).days

        # Same server day: no change
        if days_diff == 0:
            return current_streak, True

        # Next server day: increment
        if days_diff == 1:
            return current_streak + 1, True

        # Skipped one or more days: reset
        return 1, False

    def _is_within_grace_period(
        self, last_date: datetime, current_time: datetime
    ) -> bool:
        """Check if current time is within grace period of last activity."""
        grace_period = timedelta(hours=self.config.streaks.grace_period_hours)
        time_diff = current_time - last_date
        return time_diff <= grace_period

    async def get_streak_summary(self, user_id: int, org_id: int) -> Result[dict]:
        """Get comprehensive streak summary for user (Result)."""
        profile = await self.xp_service._get_or_create_profile(user_id, org_id)
        current_time = datetime.now(UTC)

        # Get recent streak records
        recent_records_stmt = (
            select(StreakRecord)
            .where(and_(StreakRecord.user_id == user_id, StreakRecord.org_id == org_id))
            .order_by(StreakRecord.date.desc())
            .limit(10)
        )
        try:
            recent_records = self.db_session.exec(recent_records_stmt).all()
        except Exception:  # pragma: no cover - defensive
            recent_records = []

        payload = {
            "login_streak": {
                "current": profile.current_login_streak,
                "longest": profile.longest_login_streak,
                "last_activity": profile.last_login_date.isoformat()
                if profile.last_login_date
                else None,
                "status": self._get_streak_status(
                    profile.last_login_date, current_time
                ),
                "next_milestone": self._get_next_milestone(
                    profile.current_login_streak
                ),
            },
            "learning_streak": {
                "current": profile.current_learning_streak,
                "longest": profile.longest_learning_streak,
                "last_activity": profile.last_learning_activity_date.isoformat()
                if profile.last_learning_activity_date
                else None,
                "status": self._get_streak_status(
                    profile.last_learning_activity_date, current_time
                ),
                "next_milestone": self._get_next_milestone(
                    profile.current_learning_streak
                ),
            },
            "milestones": self.config.streaks.milestone_bonuses,
            "grace_period_hours": self.config.streaks.grace_period_hours,
            "recent_records": [
                {
                    "streak_type": record.streak_type.value,
                    "streak_count": record.streak_count,
                    "is_milestone": record.is_milestone,
                    "activities_completed": record.activities_completed,
                    "xp_earned_today": record.xp_earned_today,
                    "date": record.date.isoformat(),
                    "metadata": record.streak_metadata,
                }
                for record in recent_records
            ],
        }
        return Result.success(payload)

    def _get_streak_status(
        self, last_date: datetime | None, current_time: datetime
    ) -> str:
        """Get current status of streak using server-day boundaries (UTC)."""
        if not last_date:
            return "inactive"

        last_server_date = (
            last_date.astimezone(UTC).date()
            if last_date.tzinfo is not None
            else last_date.date()
        )
        current_server_date = (
            current_time.astimezone(UTC).date()
            if current_time.tzinfo is not None
            else current_time.date()
        )

        if current_server_date == last_server_date:
            return "active_today"
        if (current_server_date - last_server_date).days == 1:
            return "due_today"
        return "broken"

    @staticmethod
    def _to_server_date(dt: datetime) -> datetime.date:
        """Normalize a datetime to server (UTC) date for comparisons."""
        return dt.astimezone(UTC).date() if dt.tzinfo is not None else dt.date()

    def _get_next_milestone(self, current_streak: int) -> int | None:
        """Get the next milestone the user can reach."""
        milestones = sorted(self.config.streaks.milestone_bonuses.keys())
        for milestone in milestones:
            if milestone > current_streak:
                return milestone
        return None


def create_streak_service(db_session: Session) -> StreakService:
    """Factory function to create streak service."""
    return StreakService(db_session)
