"""
Event-Driven Gamification Handlers

Clean event handlers that respond to user actions and award appropriate
gamification rewards without tight coupling to business logic.
"""

import logging
from typing import Any, Dict, Optional

from sqlmodel import Session

from src.db.gamification import XPSource
from src.services.gamification.streak_service import (
    StreakService,
    create_streak_service,
)
from src.services.gamification.xp_service import XPService, create_xp_service

logger = logging.getLogger(__name__)


class GamificationEventHandler:
    """Event handler for gamification rewards."""

    def __init__(self, db_session: Session) -> None:
        self.db_session = db_session
        self.xp_service = create_xp_service(db_session)
        self.streak_service = create_streak_service(db_session)

    async def handle_user_login(
        self, user_id: int, org_id: int, metadata: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        """Handle user login without double-awarding XP.

        Daily login bonus is handled inside StreakService.update_login_streak,
        which uses a semantic idempotency key. We only call streak update here.
        """
        try:
            streak_result = await self.streak_service.update_login_streak(
                user_id, org_id
            )
            if not streak_result.ok:
                return {
                    "success": False,
                    "error": streak_result.error,
                    "code": streak_result.code,
                }
            logger.info(f"Login event processed: user={user_id}, org={org_id}")
            return {"success": True, "results": {"streak_update": streak_result.value}}
        except Exception as e:
            logger.exception(f"Error handling login event: {e}")
            return {"success": False, "error": str(e)}

    async def handle_activity_completion(
        self,
        user_id: int,
        org_id: int,
        activity_id: str,
        activity_type: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Handle activity completion event."""
        try:
            results = {}

            # Award activity completion XP
            xp_result = await self.xp_service.award_xp(
                user_id=user_id,
                org_id=org_id,
                source=XPSource.ACTIVITY_COMPLETION,
                source_id=activity_id,
                metadata={**(metadata or {}), "activity_type": activity_type},
            )
            results["xp_award"] = (
                xp_result.value if xp_result.ok else {"error": xp_result.code}
            )

            # Update learning streak
            streak_result = await self.streak_service.update_learning_streak(
                user_id, org_id
            )
            results["streak_update"] = streak_result

            logger.info(
                f"Activity completion processed: user={user_id}, activity={activity_id}"
            )
            return {"success": True, "results": results}

        except Exception as e:
            logger.exception(f"Error handling activity completion: {e}")
            return {"success": False, "error": str(e)}

    async def handle_course_completion(
        self,
        user_id: int,
        org_id: int,
        course_id: str,
        completion_percentage: float = 100.0,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Handle course completion event."""
        try:
            results = {}

            # Award course completion XP
            xp_result = await self.xp_service.award_xp(
                user_id=user_id,
                org_id=org_id,
                source=XPSource.COURSE_COMPLETION,
                source_id=course_id,
                metadata={
                    **(metadata or {}),
                    "completion_percentage": completion_percentage,
                },
            )
            results["xp_award"] = (
                xp_result.value if xp_result.ok else {"error": xp_result.code}
            )

            # Update learning streak
            streak_result = await self.streak_service.update_learning_streak(
                user_id, org_id
            )
            results["streak_update"] = streak_result

            logger.info(
                f"Course completion processed: user={user_id}, course={course_id}"
            )
            return {"success": True, "results": results}

        except Exception as e:
            logger.exception(f"Error handling course completion: {e}")
            return {"success": False, "error": str(e)}

    async def handle_assignment_submission(
        self,
        user_id: int,
        org_id: int,
        assignment_id: str,
        is_final_submission: bool = False,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Handle assignment submission event."""
        try:
            results = {}

            # Award assignment submission XP
            xp_result = await self.xp_service.award_xp(
                user_id=user_id,
                org_id=org_id,
                source=XPSource.ASSIGNMENT_SUBMISSION,
                source_id=assignment_id,
                metadata={
                    **(metadata or {}),
                    "is_final_submission": is_final_submission,
                },
            )
            results["xp_award"] = (
                xp_result.value if xp_result.ok else {"error": xp_result.code}
            )

            # Update learning streak if final submission
            if is_final_submission:
                streak_result = await self.streak_service.update_learning_streak(
                    user_id, org_id
                )
                results["streak_update"] = streak_result

            logger.info(
                f"Assignment submission processed: user={user_id}, assignment={assignment_id}"
            )
            return {"success": True, "results": results}

        except Exception as e:
            logger.exception(f"Error handling assignment submission: {e}")
            return {"success": False, "error": str(e)}

    async def handle_quiz_completion(
        self,
        user_id: int,
        org_id: int,
        quiz_id: str,
        score: float | None = None,
        perfect_score: bool = False,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Handle quiz completion event."""
        try:
            results = {}

            # Award quiz completion XP
            xp_result = await self.xp_service.award_xp(
                user_id=user_id,
                org_id=org_id,
                source=XPSource.QUIZ_COMPLETION,
                source_id=quiz_id,
                metadata={
                    **(metadata or {}),
                    "score": score,
                    "perfect_score": perfect_score,
                },
            )
            results["xp_award"] = (
                xp_result.value if xp_result.ok else {"error": xp_result.code}
            )

            # Update learning streak
            streak_result = await self.streak_service.update_learning_streak(
                user_id, org_id
            )
            results["streak_update"] = streak_result

            # Award bonus for perfect score
            if perfect_score:
                bonus_result = await self.xp_service.award_xp(
                    user_id=user_id,
                    org_id=org_id,
                    source=XPSource.MILESTONE_ACHIEVEMENT,
                    source_id=f"perfect_quiz_{quiz_id}",
                    custom_amount=25,  # Bonus for perfect score
                    metadata={"achievement": "perfect_quiz"},
                )
                results["perfect_score_bonus"] = (
                    bonus_result.value
                    if bonus_result.ok
                    else {"error": bonus_result.code}
                )

            logger.info(
                f"Quiz completion processed: user={user_id}, quiz={quiz_id}, perfect={perfect_score}"
            )
            return {"success": True, "results": results}

        except Exception as e:
            logger.exception(f"Error handling quiz completion: {e}")
            return {"success": False, "error": str(e)}

    async def handle_daily_goal_completion(
        self,
        user_id: int,
        org_id: int,
        goal_xp: int,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Handle daily goal completion event."""
        try:
            results = {}

            # Award daily goal completion XP
            xp_result = await self.xp_service.award_xp(
                user_id=user_id,
                org_id=org_id,
                source=XPSource.DAILY_GOAL_COMPLETION,
                source_id=f"daily_goal_{goal_xp}",
                metadata={**(metadata or {}), "goal_xp": goal_xp},
            )
            results["xp_award"] = (
                xp_result.value if xp_result.ok else {"error": xp_result.code}
            )

            logger.info(
                f"Daily goal completion processed: user={user_id}, goal={goal_xp}"
            )
            return {"success": True, "results": results}

        except Exception as e:
            logger.exception(f"Error handling daily goal completion: {e}")
            return {"success": False, "error": str(e)}

    async def handle_admin_xp_award(
        self,
        user_id: int,
        org_id: int,
        amount: int,
        reason: str,
        admin_user_id: int,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Handle admin XP award event."""
        try:
            # Award admin XP
            xp_result = await self.xp_service.award_xp(
                user_id=user_id,
                org_id=org_id,
                source=XPSource.ADMIN_AWARD,
                custom_amount=amount,
                source_id=f"admin_award_{admin_user_id}",
                metadata={
                    **(metadata or {}),
                    "reason": reason,
                    "admin_user_id": admin_user_id,
                },
            )

            logger.info(
                f"Admin XP award processed: user={user_id}, amount={amount}, admin={admin_user_id}"
            )
            return {
                "success": True,
                "results": {
                    "xp_award": xp_result.value
                    if xp_result.ok
                    else {"error": xp_result.code}
                },
            }

        except Exception as e:
            logger.exception(f"Error handling admin XP award: {e}")
            return {"success": False, "error": str(e)}


def create_gamification_handler(db_session: Session) -> GamificationEventHandler:
    """Factory function to create gamification event handler."""
    return GamificationEventHandler(db_session)
