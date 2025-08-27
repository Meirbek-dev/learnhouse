"""
Achievement Service

Enhanced achievement system with progress tracking, conditions, and unlocks.
Part of Phase 1: Foundation & Architecture improvements.
"""

import logging
from datetime import UTC, datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel
from sqlmodel import Session, and_, select

from src.db.gamification import (
    Achievement,
    AchievementType,
    UserAchievement,
    UserGamificationProfile,
)
from src.db.gamification_events import Badge, UserBadge
from src.services.gamification.event_bus import (
    AchievementUnlockedEvent,
    BadgeEarnedEvent,
    EventBus,
)

from .result import Result

logger = logging.getLogger(__name__)


class AchievementCondition(str, Enum):
    """Types of achievement conditions."""

    # XP-based conditions
    TOTAL_XP_REACHED = "total_xp_reached"
    XP_FROM_SOURCE = "xp_from_source"
    DAILY_XP_GOAL = "daily_xp_goal"

    # Level-based conditions
    LEVEL_REACHED = "level_reached"
    LEVELS_GAINED = "levels_gained"

    # Streak conditions
    LOGIN_STREAK = "login_streak"
    LEARNING_STREAK = "learning_streak"

    # Activity conditions
    ACTIVITIES_COMPLETED = "activities_completed"
    COURSES_COMPLETED = "courses_completed"
    ASSIGNMENTS_SUBMITTED = "assignments_submitted"

    # Time-based conditions
    CONSECUTIVE_DAYS_ACTIVE = "consecutive_days_active"
    TOTAL_SESSION_TIME = "total_session_time"

    # Social conditions
    PEER_REVIEWS_GIVEN = "peer_reviews_given"
    FORUM_POSTS_MADE = "forum_posts_made"

    # Special conditions
    PERFECT_SCORE_ACHIEVED = "perfect_score_achieved"
    EARLY_ADOPTER = "early_adopter"


class AchievementProgress(BaseModel):
    """Progress tracking for achievements."""

    current_value: float
    target_value: float
    progress_percent: float
    is_completed: bool
    metadata: dict[str, Any] = {}


class AchievementService:
    """Service for managing achievements and badges."""

    def __init__(self, db_session: Session, event_bus: EventBus | None = None) -> None:
        self.db_session = db_session
        self.event_bus = event_bus

    async def create_achievement(
        self,
        org_id: int,
        achievement_key: str,
        title: str,
        description: str,
        achievement_type: AchievementType,
        requirements: dict[str, Any],
        xp_reward: int = 0,
        unlock_level: int = 1,
        icon_url: str | None = None,
    ) -> Result[Achievement]:
        """Create a new achievement definition (Result)."""
        try:
            achievement = Achievement(
                org_id=org_id,
                achievement_key=achievement_key,
                achievement_type=achievement_type,
                title=title,
                description=description,
                icon_url=icon_url,
                requirements=requirements,
                xp_reward=xp_reward,
                unlock_level=unlock_level,
                is_active=True,
                sort_order=0,
            )
            self.db_session.add(achievement)
            self.db_session.commit()
            logger.info(f"Created achievement: {achievement_key} for org {org_id}")
            return Result.success(achievement)
        except Exception as e:  # pragma: no cover - defensive
            self.db_session.rollback()
            logger.exception("Failed creating achievement %s: %s", achievement_key, e)
            return Result.fail(
                "Failed to create achievement", code="achievement_create_failed"
            )

    async def check_user_achievements(
        self, user_id: int, org_id: int, trigger_data: dict[str, Any] | None = None
    ) -> Result[list[Achievement]]:
        """Check and unlock achievements for a user (Result)."""
        try:
            profile = await self._get_user_profile(user_id, org_id)
            if not profile:
                return Result.success([])  # No profile yet; not an error

            unlocked_achievement_ids = self._get_unlocked_achievement_ids(
                user_id, org_id
            )
            stmt = select(Achievement).where(
                Achievement.org_id == org_id,
                Achievement.is_active,
                Achievement.unlock_level <= profile.current_level,
                ~Achievement.id.in_(unlocked_achievement_ids),
            )
            available_achievements = list(self.db_session.exec(stmt).all())
            newly_unlocked: list[Achievement] = []
            for achievement in available_achievements:
                progress = await self._evaluate_achievement_progress(
                    achievement, profile, trigger_data
                )
                await self._update_achievement_progress(
                    user_id, org_id, achievement.id, progress
                )
                if progress.is_completed:
                    await self._unlock_achievement(
                        user_id, org_id, achievement, progress
                    )
                    newly_unlocked.append(achievement)
            return Result.success(newly_unlocked)
        except Exception as e:  # pragma: no cover - defensive
            logger.exception(
                "Failed checking achievements user=%s org=%s: %s", user_id, org_id, e
            )
            return Result.fail(
                "Failed to check achievements", code="achievement_check_failed"
            )

    async def get_user_achievement_progress(
        self, user_id: int, org_id: int
    ) -> Result[list[dict[str, Any]]]:
        """Get achievement progress for a user (Result)."""
        try:
            profile = await self._get_user_profile(user_id, org_id)
            if not profile:
                return Result.success([])
            stmt = (
                select(Achievement)
                .where(
                    Achievement.org_id == org_id,
                    Achievement.is_active,
                    Achievement.unlock_level <= profile.current_level,
                )
                .order_by(Achievement.sort_order, Achievement.created_at)
            )
            achievements = list(self.db_session.exec(stmt).all())
            user_achievements: dict[int, UserAchievement] = {}
            if achievements:
                user_stmt = select(UserAchievement).where(
                    UserAchievement.user_id == user_id,
                    UserAchievement.org_id == org_id,
                    UserAchievement.achievement_id.in_([a.id for a in achievements]),
                )
                for ua in self.db_session.exec(user_stmt).all():
                    user_achievements[ua.achievement_id] = ua
            result: list[dict[str, Any]] = []
            for achievement in achievements:
                ua = user_achievements.get(achievement.id)
                if ua:
                    progress_data = {
                        "achievement": achievement,
                        "progress_percent": ua.progress_percent,
                        "is_unlocked": ua.is_unlocked,
                        "unlocked_at": ua.unlocked_at,
                        "progress_data": ua.progress_data,
                    }
                else:
                    progress = await self._evaluate_achievement_progress(
                        achievement, profile
                    )
                    progress_data = {
                        "achievement": achievement,
                        "progress_percent": progress.progress_percent,
                        "is_unlocked": False,
                        "unlocked_at": None,
                        "progress_data": {
                            "current_value": progress.current_value,
                            "target_value": progress.target_value,
                            "metadata": progress.metadata,
                        },
                    }
                result.append(progress_data)
            return Result.success(result)
        except Exception as e:  # pragma: no cover
            logger.exception(
                "Failed getting achievement progress user=%s org=%s: %s",
                user_id,
                org_id,
                e,
            )
            return Result.fail(
                "Failed to get achievement progress", code="achievement_progress_failed"
            )

    async def create_badge(
        self,
        org_id: int,
        badge_key: str,
        title: str,
        description: str,
        category: str,
        rarity_level: int = 1,
        unlock_conditions: dict[str, Any] | None = None,
        icon_url: str | None = None,
        color: str = "#6B7280",
        is_secret: bool = False,
    ) -> Result[Badge]:
        """Create a new badge definition (Result)."""
        try:
            badge = Badge(
                org_id=org_id,
                badge_key=badge_key,
                title=title,
                description=description,
                icon_url=icon_url,
                color=color,
                category=category,
                rarity_level=rarity_level,
                unlock_conditions=unlock_conditions or {},
                is_secret=is_secret,
                is_active=True,
                display_order=0,
            )
            self.db_session.add(badge)
            self.db_session.commit()
            logger.info(f"Created badge: {badge_key} for org {org_id}")
            return Result.success(badge)
        except Exception as e:  # pragma: no cover
            self.db_session.rollback()
            logger.exception("Failed creating badge %s: %s", badge_key, e)
            return Result.fail("Failed to create badge", code="badge_create_failed")

    async def award_badge(
        self,
        user_id: int,
        org_id: int,
        badge_key: str,
        earning_context: dict[str, Any] | None = None,
    ) -> Result[UserBadge]:
        """Award a badge to a user (Result).

        Returns:
            Success: Result.ok with UserBadge (existing or newly created)
            Failure: badge_not_found / badge_award_failed codes
        """
        try:
            stmt = select(Badge).where(
                Badge.org_id == org_id, Badge.badge_key == badge_key, Badge.is_active
            )
            badge = self.db_session.exec(stmt).first()
            if not badge:
                logger.warning(
                    "Badge not found: %s org=%s user=%s", badge_key, org_id, user_id
                )
                return Result.fail("Badge not found", code="badge_not_found")

            existing_stmt = select(UserBadge).where(
                UserBadge.user_id == user_id, UserBadge.badge_id == badge.id
            )
            existing = self.db_session.exec(existing_stmt).first()
            if existing:
                logger.info(
                    "User already owns badge %s (returning existing)", badge_key
                )
                return Result.success(existing)

            user_badge = UserBadge(
                user_id=user_id,
                org_id=org_id,
                badge_id=badge.id,
                earning_context=earning_context or {},
                is_favorited=False,
                is_publicly_visible=True,
            )
            self.db_session.add(user_badge)
            self.db_session.commit()

            if self.event_bus:
                try:
                    event = BadgeEarnedEvent(
                        aggregate_id=f"user_profile_{user_id}",
                        aggregate_type="user_profile",
                        user_id=user_id,
                        org_id=org_id,
                        event_data={
                            "badge_id": badge.id,
                            "badge_key": badge_key,
                            "badge_title": badge.title,
                            "badge_category": badge.category,
                            "rarity_level": badge.rarity_level,
                            "earning_context": earning_context,
                        },
                    )
                    await self.event_bus.publish(event)
                except Exception:  # pragma: no cover
                    logger.exception("Failed publishing badge event")

            logger.info(
                "Awarded badge %s to user %s org=%s", badge_key, user_id, org_id
            )
            return Result.success(user_badge)
        except Exception as e:  # pragma: no cover
            self.db_session.rollback()
            logger.exception(
                "Failed awarding badge %s to user %s org=%s: %s",
                badge_key,
                user_id,
                org_id,
                e,
            )
            return Result.fail("Failed to award badge", code="badge_award_failed")

    async def get_user_badges(
        self,
        user_id: int,
        org_id: int,
        category: str | None = None,
        include_secret: bool = True,
    ) -> list[dict[str, Any]]:
        """Get badges earned by a user."""

        stmt = (
            select(UserBadge, Badge)
            .join(Badge)
            .where(
                UserBadge.user_id == user_id,
                UserBadge.org_id == org_id,
                Badge.is_active,
            )
        )

        if category:
            stmt = stmt.where(Badge.category == category)

        if not include_secret:
            stmt = stmt.where(~Badge.is_secret)

        stmt = stmt.order_by(UserBadge.earned_at.desc())

        results = list(self.db_session.exec(stmt).all())

        return [
            {
                "user_badge": user_badge,
                "badge": badge,
                "earned_at": user_badge.earned_at,
                "earning_context": user_badge.earning_context,
                "is_favorited": user_badge.is_favorited,
            }
            for user_badge, badge in results
        ]

    async def _get_user_profile(
        self, user_id: int, org_id: int
    ) -> UserGamificationProfile | None:
        """Get user gamification profile."""
        stmt = select(UserGamificationProfile).where(
            UserGamificationProfile.user_id == user_id,
            UserGamificationProfile.org_id == org_id,
        )

        return self.db_session.exec(stmt).first()

    def _get_unlocked_achievement_ids(self, user_id: int, org_id: int) -> set[int]:
        """Get IDs of achievements already unlocked by user."""
        stmt = select(UserAchievement.achievement_id).where(
            UserAchievement.user_id == user_id,
            UserAchievement.org_id == org_id,
            UserAchievement.is_unlocked,
        )

        return set(self.db_session.exec(stmt).all())

    async def _evaluate_achievement_progress(
        self,
        achievement: Achievement,
        profile: UserGamificationProfile,
        trigger_data: dict[str, Any] | None = None,
    ) -> AchievementProgress:
        """Evaluate progress towards an achievement."""

        requirements = achievement.requirements
        condition_type = requirements.get("condition")
        target_value = requirements.get("target", 0)
        current_value = 0
        metadata = {}

        # Evaluate based on condition type
        if condition_type == AchievementCondition.TOTAL_XP_REACHED:
            current_value = profile.total_xp

        elif condition_type == AchievementCondition.LEVEL_REACHED:
            current_value = profile.current_level

        elif condition_type == AchievementCondition.LOGIN_STREAK:
            current_value = max(
                profile.current_login_streak, profile.longest_login_streak
            )

        elif condition_type == AchievementCondition.LEARNING_STREAK:
            current_value = max(
                profile.current_learning_streak, profile.longest_learning_streak
            )

        elif condition_type == AchievementCondition.ACTIVITIES_COMPLETED:
            current_value = profile.total_activities_completed

        elif condition_type == AchievementCondition.COURSES_COMPLETED:
            current_value = profile.total_courses_completed

        elif condition_type == AchievementCondition.TOTAL_SESSION_TIME:
            # Convert minutes to hours for more meaningful targets
            current_value = profile.avg_session_duration * profile.total_sessions / 60.0

        elif condition_type == AchievementCondition.CONSECUTIVE_DAYS_ACTIVE:
            # This would need additional data tracking
            current_value = profile.current_login_streak

        # Calculate progress
        progress_percent = (
            min(100.0, (current_value / target_value * 100.0))
            if target_value > 0
            else 0.0
        )
        is_completed = current_value >= target_value

        return AchievementProgress(
            current_value=current_value,
            target_value=target_value,
            progress_percent=progress_percent,
            is_completed=is_completed,
            metadata=metadata,
        )

    async def _update_achievement_progress(
        self,
        user_id: int,
        org_id: int,
        achievement_id: int,
        progress: AchievementProgress,
    ) -> UserAchievement:
        """Update or create achievement progress tracking."""

        stmt = select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == achievement_id,
        )

        user_achievement = self.db_session.exec(stmt).first()

        if not user_achievement:
            user_achievement = UserAchievement(
                user_id=user_id,
                org_id=org_id,
                achievement_id=achievement_id,
                progress_percent=progress.progress_percent,
                is_unlocked=False,
                progress_data={
                    "current_value": progress.current_value,
                    "target_value": progress.target_value,
                    "metadata": progress.metadata,
                },
            )
            self.db_session.add(user_achievement)
        else:
            user_achievement.progress_percent = progress.progress_percent
            user_achievement.progress_data = {
                "current_value": progress.current_value,
                "target_value": progress.target_value,
                "metadata": progress.metadata,
            }
            user_achievement.updated_at = datetime.now(UTC)

        self.db_session.commit()
        return user_achievement

    async def _unlock_achievement(
        self,
        user_id: int,
        org_id: int,
        achievement: Achievement,
        progress: AchievementProgress,
    ) -> None:
        """Unlock an achievement for a user."""

        # Update user achievement record
        stmt = select(UserAchievement).where(
            UserAchievement.user_id == user_id,
            UserAchievement.achievement_id == achievement.id,
        )

        user_achievement = self.db_session.exec(stmt).first()
        if user_achievement:
            user_achievement.is_unlocked = True
            user_achievement.unlocked_at = datetime.now(UTC)
            user_achievement.progress_percent = 100.0
            user_achievement.updated_at = datetime.now(UTC)

            self.db_session.commit()

        # Emit achievement unlocked event
        if self.event_bus:
            event = AchievementUnlockedEvent(
                aggregate_id=f"user_profile_{user_id}",
                aggregate_type="user_profile",
                user_id=user_id,
                org_id=org_id,
                event_data={
                    "achievement_id": achievement.id,
                    "achievement_key": achievement.achievement_key,
                    "achievement_title": achievement.title,
                    "achievement_type": achievement.achievement_type,
                    "xp_reward": achievement.xp_reward,
                    "progress_data": progress.dict(),
                },
            )

            await self.event_bus.publish(event)

        logger.info(
            f"Unlocked achievement {achievement.achievement_key} for user {user_id}"
        )


# ============================================================================
# Default Achievements & Badges
# ============================================================================


DEFAULT_ACHIEVEMENTS = [
    {
        "achievement_key": "first_steps",
        "title": "First Steps",
        "description": "Complete your first learning activity",
        "achievement_type": AchievementType.LEVEL_MILESTONE,
        "requirements": {
            "condition": AchievementCondition.ACTIVITIES_COMPLETED,
            "target": 1,
        },
        "xp_reward": 50,
        "unlock_level": 1,
    },
    {
        "achievement_key": "xp_collector_100",
        "title": "XP Collector",
        "description": "Earn your first 100 XP",
        "achievement_type": AchievementType.LEVEL_MILESTONE,
        "requirements": {
            "condition": AchievementCondition.TOTAL_XP_REACHED,
            "target": 100,
        },
        "xp_reward": 25,
        "unlock_level": 1,
    },
    {
        "achievement_key": "consistent_learner_7",
        "title": "Consistent Learner",
        "description": "Maintain a 7-day learning streak",
        "achievement_type": AchievementType.STREAK_MILESTONE,
        "requirements": {
            "condition": AchievementCondition.LEARNING_STREAK,
            "target": 7,
        },
        "xp_reward": 100,
        "unlock_level": 1,
    },
    {
        "achievement_key": "course_graduate",
        "title": "Course Graduate",
        "description": "Complete your first course",
        "achievement_type": AchievementType.COURSE_MASTERY,
        "requirements": {
            "condition": AchievementCondition.COURSES_COMPLETED,
            "target": 1,
        },
        "xp_reward": 200,
        "unlock_level": 1,
    },
    {
        "achievement_key": "level_explorer",
        "title": "Level Explorer",
        "description": "Reach level 5",
        "achievement_type": AchievementType.LEVEL_MILESTONE,
        "requirements": {"condition": AchievementCondition.LEVEL_REACHED, "target": 5},
        "xp_reward": 150,
        "unlock_level": 1,
    },
]

DEFAULT_BADGES = [
    {
        "badge_key": "welcome",
        "title": "Welcome",
        "description": "Joined the learning community",
        "category": "milestone",
        "rarity_level": 1,
        "color": "#10B981",
    },
    {
        "badge_key": "early_bird",
        "title": "Early Bird",
        "description": "Active learner in the morning",
        "category": "time",
        "rarity_level": 2,
        "color": "#F59E0B",
    },
    {
        "badge_key": "night_owl",
        "title": "Night Owl",
        "description": "Learning late into the night",
        "category": "time",
        "rarity_level": 2,
        "color": "#8B5CF6",
    },
    {
        "badge_key": "perfectionist",
        "title": "Perfectionist",
        "description": "Achieved perfect scores consistently",
        "category": "performance",
        "rarity_level": 4,
        "color": "#EF4444",
    },
]


async def create_default_achievements_and_badges(
    achievement_service: AchievementService, org_id: int
) -> None:
    """Create default achievements and badges for an organization."""

    # Create default achievements
    for achievement_data in DEFAULT_ACHIEVEMENTS:
        try:
            await achievement_service.create_achievement(
                org_id=org_id, **achievement_data
            )
        except Exception as e:
            logger.warning(
                f"Failed to create achievement {achievement_data['achievement_key']}: {e!s}"
            )

    # Create default badges
    for badge_data in DEFAULT_BADGES:
        try:
            await achievement_service.create_badge(org_id=org_id, **badge_data)
        except Exception as e:
            logger.warning(f"Failed to create badge {badge_data['badge_key']}: {e!s}")


# ============================================================================
# Factory Function
# ============================================================================


def create_achievement_service(
    db_session: Session, event_bus: EventBus | None = None
) -> AchievementService:
    """Create achievement service."""
    return AchievementService(db_session, event_bus)
