"""

Essential functions needed by the router.
"""

import logging
from typing import Any, Dict
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session, select

from src.core.timezone import now_local
from src.db.gamification import (
    OrganizationLeaderboard,
    UserGamificationPreferenceRead,
    UserGamificationPreferenceUpsert,
    UserGamificationProfile,
    XPTransaction,
)
from src.db.users import User

from .cache_service import create_cache_service
from .level_calculator import calculate_level_details
from .result import Result

logger = logging.getLogger(__name__)


async def get_or_create_profile(
    user_id: int, org_id: int, db_session: Session
) -> UserGamificationProfile:
    """Get or create user gamification profile (cached)."""
    cache = create_cache_service()
    try:
        cached = cache.get_profile(user_id, org_id)
        if cached:
            return cached

        statement = select(UserGamificationProfile).where(
            UserGamificationProfile.user_id == user_id,
            UserGamificationProfile.org_id == org_id,
        )
        profile = db_session.exec(statement).first()
        if profile:
            cache.set_profile(user_id, org_id, profile)
            return profile

        new_profile = UserGamificationProfile(
            user_id=user_id,
            org_id=org_id,
            total_xp=0,
            current_level=1,
            current_login_streak=0,
            longest_login_streak=0,
            current_learning_streak=0,
            longest_learning_streak=0,
            last_login_date=None,
            last_learning_activity_date=None,
            created_at=now_local(),
            updated_at=now_local(),
        )
        db_session.add(new_profile)
        db_session.commit()
        db_session.refresh(new_profile)
        cache.set_profile(user_id, org_id, new_profile)
        return new_profile
    except Exception as e:
        logger.exception(
            "Error getting/creating profile user=%s org=%s: %s", user_id, org_id, e
        )
        db_session.rollback()
        # Let caller decide how to surface; propagate exception
        raise


async def get_gamification_dashboard_result(
    user_id: int, org_id: int, db_session: Session
) -> Result[dict[str, Any]]:
    """Get gamification dashboard data (Result)."""
    try:
        profile = await get_or_create_profile(user_id, org_id, db_session)

        # Get recent XP transactions (last 10)
        xp_statement = (
            select(XPTransaction)
            .where(XPTransaction.user_id == user_id, XPTransaction.org_id == org_id)
            .order_by(XPTransaction.created_at.desc())
            .limit(10)
        )

        recent_transactions = db_session.exec(xp_statement).all()

        # Calculate level details
        level_details = calculate_level_details(profile.total_xp or 0)

        payload = {
            "profile": profile,
            "level_details": {
                "level": level_details["level"],
                "xp_in_level": level_details["xp_in_level"],
                "xp_to_next_level": level_details["xp_to_next"],
                "progress_percent": level_details["progress"] * 100,
                "total_xp_for_level": level_details.get("total_xp_for_level", 0),
            },
            "recent_transactions": [
                {
                    "id": tx.id,
                    "xp_awarded": tx.xp_amount,
                    "source": tx.source.value,
                    "created_at": tx.created_at,
                    "metadata": tx.transaction_metadata or {},
                }
                for tx in recent_transactions
            ],
            "statistics": {
                "total_xp": profile.total_xp or 0,
                "current_level": level_details["level"],
                "login_streak": profile.current_login_streak or 0,
                "learning_streak": profile.current_learning_streak or 0,
                "longest_login_streak": profile.longest_login_streak or 0,
                "longest_learning_streak": profile.longest_learning_streak or 0,
            },
        }
        return Result.success(payload)
    except Exception as e:  # pragma: no cover - defensive
        logger.exception(
            "Error getting dashboard for user %s org %s: %s", user_id, org_id, e
        )
        return Result.fail(
            "Failed to get gamification dashboard", code="dashboard_error"
        )


async def get_gamification_preferences_result(
    user_id: int, org_id: int, db_session: Session
) -> Result[UserGamificationPreferenceRead]:
    try:
        profile = await get_or_create_profile(user_id, org_id, db_session)
        stored: dict[str, Any] = profile.preferences or {}
        pref = UserGamificationPreferenceRead(
            user_id=user_id,
            org_id=org_id,
            notifications_enabled=stored.get("notifications_enabled", True),
            daily_goal_xp=stored.get("daily_goal_xp", profile.daily_goal_xp or 50),
            show_leaderboard=stored.get("show_leaderboard", True),
            show_streaks=stored.get("show_streaks", True),
            show_achievements=stored.get("show_achievements", True),
        )
        return Result.success(pref)
    except Exception as e:  # pragma: no cover
        logger.exception(
            "Failed to load preferences user=%s org=%s: %s", user_id, org_id, e
        )
        return Result.fail("Failed to load preferences", code="preferences_error")


async def get_gamification_profile_result(
    user_id: int, org_id: int, db_session: Session
) -> Result[dict[str, Any]]:
    """Get a user's gamification profile (normalized minimal shape) wrapped in Result.

    Returns a dict matching the existing router response's inner profile structure so
    the frontend normalization logic remains unchanged.
    """
    try:
        profile = await get_or_create_profile(user_id, org_id, db_session)
        lvl = calculate_level_details(profile.total_xp or 0)
        payload = {
            "id": profile.id,
            "user_id": profile.user_id,
            "org_id": profile.org_id,
            "total_xp": profile.total_xp,
            "current_level": lvl["level"],
            "xp_to_next_level": lvl["xp_to_next"],
            "level_progress_percent": round(lvl["progress"] * 100, 2),
            "streaks": {
                "login": {
                    "current": profile.current_login_streak,
                    "longest": profile.longest_login_streak,
                },
                "learning": {
                    "current": profile.current_learning_streak,
                    "longest": profile.longest_learning_streak,
                },
            },
            "last_activity": {
                "login": profile.last_login_date.isoformat()
                if profile.last_login_date
                else None,
                "learning": profile.last_learning_activity_date.isoformat()
                if profile.last_learning_activity_date
                else None,
            },
            "daily": {
                "xp_earned": profile.daily_xp_earned,
                "xp_limit": profile.daily_xp_limit,
                "goal_xp": profile.daily_goal_xp,
            },
            "totals": {
                "activities_completed": profile.total_activities_completed,
                "courses_completed": profile.total_courses_completed,
            },
            "preferences": profile.preferences or {},
            "created_at": profile.created_at.isoformat(),
            "updated_at": profile.updated_at.isoformat(),
        }
        return Result.success(payload)
    except Exception as e:  # pragma: no cover - defensive
        logger.exception("Failed to get profile user=%s org=%s: %s", user_id, org_id, e)
        return Result.fail("Failed to load profile", code="profile_error")


async def update_gamification_preferences_result(
    user_id: int,
    org_id: int,
    preferences: UserGamificationPreferenceUpsert,
    db_session: Session,
) -> Result[UserGamificationPreferenceRead]:
    """Update user preferences (Result)."""
    profile = await get_or_create_profile(user_id, org_id, db_session)
    stored: dict[str, Any] = (profile.preferences or {}).copy()

    # Apply partial updates only when provided
    if preferences.notifications_enabled is not None:
        stored["notifications_enabled"] = preferences.notifications_enabled
    if preferences.daily_goal_xp is not None:
        stored["daily_goal_xp"] = preferences.daily_goal_xp
        profile.daily_goal_xp = preferences.daily_goal_xp
    if preferences.show_leaderboard is not None:
        stored["show_leaderboard"] = preferences.show_leaderboard
    if preferences.show_streaks is not None:
        stored["show_streaks"] = preferences.show_streaks
    if preferences.show_achievements is not None:
        stored["show_achievements"] = preferences.show_achievements

    profile.preferences = stored
    profile.updated_at = now_local()

    try:
        db_session.add(profile)
        db_session.commit()
        db_session.refresh(profile)
    except Exception as e:
        logger.exception(
            "Failed to update gamification preferences for user %s org %s: %s",
            user_id,
            org_id,
            e,
        )
        db_session.rollback()
        return Result.fail(
            "Failed to update preferences", code="preferences_update_error"
        )

    pref = UserGamificationPreferenceRead(
        user_id=user_id,
        org_id=org_id,
        notifications_enabled=stored.get("notifications_enabled", True),
        daily_goal_xp=stored.get("daily_goal_xp", profile.daily_goal_xp or 50),
        show_leaderboard=stored.get("show_leaderboard", True),
        show_streaks=stored.get("show_streaks", True),
        show_achievements=stored.get("show_achievements", True),
    )
    return Result.success(pref)
