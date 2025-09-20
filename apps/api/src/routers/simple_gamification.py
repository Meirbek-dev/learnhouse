"""
Simplified Gamification Router - Single Endpoint Strategy

Eliminates over-engineering with:
- One unified dashboard endpoint
- Clean error handling
- Direct service calls
"""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.gamification import XPSource
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.gamification import simple_service
from src.services.gamification.simple_service import (
    DailyLimitExceededError,
    GamificationError,
)

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/dashboard/{org_id}")
async def get_dashboard(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    """Get complete gamification dashboard - single endpoint for everything"""
    try:
        data = simple_service.get_dashboard_data(db, user.id, org_id)

        # Transform to expected format
        return {
            "profile": {
                "id": data["profile"].id,
                "user_id": data["profile"].user_id,
                "org_id": data["profile"].org_id,
                "total_xp": data["profile"].total_xp,
                "level": data["profile"].level,
                "login_streak": data["profile"].login_streak,
                "learning_streak": data["profile"].learning_streak,
                "longest_login_streak": data["profile"].longest_login_streak,
                "longest_learning_streak": data["profile"].longest_learning_streak,
                "total_activities_completed": data[
                    "profile"
                ].total_activities_completed,
                "total_courses_completed": data["profile"].total_courses_completed,
                "daily_xp_earned": data["profile"].daily_xp_earned,
                "xp_to_next_level": data["profile"].xp_to_next_level,
                "level_progress_percent": data["profile"].level_progress_percent,
                "xp_in_current_level": data["profile"].xp_in_current_level,
                "last_xp_award_date": data["profile"].last_xp_award_date.isoformat()
                if data["profile"].last_xp_award_date
                else None,
                "last_login_date": data["profile"].last_login_date.isoformat()
                if data["profile"].last_login_date
                else None,
                "last_learning_date": data["profile"].last_learning_date.isoformat()
                if data["profile"].last_learning_date
                else None,
                "created_at": data["profile"].created_at.isoformat(),
                "updated_at": data["profile"].updated_at.isoformat(),
                "preferences": data["profile"].preferences,
            },
            "recent_transactions": [
                {
                    "id": tx.id,
                    "user_id": tx.user_id,
                    "org_id": tx.org_id,
                    "amount": tx.amount,
                    "source": tx.source.value,
                    "source_id": tx.source_id,
                    "previous_level": tx.previous_level,
                    "triggered_level_up": tx.triggered_level_up,
                    "created_at": tx.created_at.isoformat(),
                }
                for tx in data["recent_transactions"]
            ],
            "leaderboard": {
                "entries": [
                    {
                        "rank": rank + 1,
                        "user_id": profile.user_id,
                        "total_xp": profile.total_xp,
                        "level": profile.level,
                        "username": None,  # Would need user join
                    }
                    for rank, profile in enumerate(data["leaderboard"])
                ]
            },
            "user_rank": data["user_rank"],
            "streak_info": data["streak_info"],
        }

    except Exception as e:
        logger.exception("Dashboard error for user %s org %s: %s", user.id, org_id, e)
        raise HTTPException(status_code=500, detail="Failed to get dashboard")


@router.get("/preferences/{org_id}")
async def get_preferences(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    """Return the user's gamification preferences for this org."""
    try:
        profile = simple_service.get_profile(db, user_id=user.id, org_id=org_id)
        return {"preferences": profile.preferences or {}}
    except Exception as e:
        logger.exception(
            "Get preferences error for user %s org %s: %s", user.id, org_id, e
        )
        raise HTTPException(status_code=500, detail="Failed to get preferences")


@router.put("/preferences/{org_id}")
async def update_preferences(
    org_id: int,
    request: dict,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    """Update the user's gamification preferences for this org.

    Body: { preferences: object }
    """
    try:
        new_prefs = request.get("preferences")
        if new_prefs is None or not isinstance(new_prefs, dict):
            raise HTTPException(status_code=400, detail="Invalid preferences payload")

        profile = simple_service.get_profile(db, user_id=user.id, org_id=org_id)
        # Shallow merge to preserve unknown keys
        merged = {**(profile.preferences or {}), **new_prefs}
        profile.preferences = merged
        profile.updated_at = datetime.now()
        db.add(profile)
        db.commit()
        return {"preferences": merged}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(
            "Update preferences error for user %s org %s: %s", user.id, org_id, e
        )
        raise HTTPException(status_code=500, detail="Failed to update preferences")


@router.post("/award-xp/{org_id}")
async def award_xp(
    org_id: int,
    request: dict,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    """Award XP to user"""
    try:
        profile, level_up = simple_service.award_xp(
            db=db,
            user_id=user.id,
            org_id=org_id,
            source=request.get("source"),
            amount=request.get("customAmount"),
            source_id=request.get("sourceId"),
            idempotency_key=request.get("idempotencyKey"),
        )

        return {
            "profile": {
                "id": profile.id,
                "user_id": profile.user_id,
                "org_id": profile.org_id,
                "total_xp": profile.total_xp,
                "level": profile.level,
                "login_streak": profile.login_streak,
                "learning_streak": profile.learning_streak,
                "longest_login_streak": profile.longest_login_streak,
                "longest_learning_streak": profile.longest_learning_streak,
                "total_activities_completed": profile.total_activities_completed,
                "total_courses_completed": profile.total_courses_completed,
                "daily_xp_earned": profile.daily_xp_earned,
                "xp_to_next_level": profile.xp_to_next_level,
                "level_progress_percent": profile.level_progress_percent,
                "xp_in_current_level": profile.xp_in_current_level,
                "last_xp_award_date": profile.last_xp_award_date.isoformat()
                if profile.last_xp_award_date
                else None,
                "last_login_date": profile.last_login_date.isoformat()
                if profile.last_login_date
                else None,
                "last_learning_date": profile.last_learning_date.isoformat()
                if profile.last_learning_date
                else None,
                "created_at": profile.created_at.isoformat(),
                "updated_at": profile.updated_at.isoformat(),
                "preferences": profile.preferences,
            },
            "level_up": level_up,
        }

    except DailyLimitExceededError as e:
        raise HTTPException(status_code=429, detail=str(e))
    except GamificationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("XP award error for user %s org %s: %s", user.id, org_id, e)
        raise HTTPException(status_code=500, detail="Failed to award XP")


@router.post("/update-streak/{org_id}")
async def update_streak(
    org_id: int,
    request: dict,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    """Update user streak"""
    try:
        profile = simple_service.update_streak(
            db=db,
            user_id=user.id,
            org_id=org_id,
            streak_type=request.get("streak_type"),
        )

        streak_type = request.get("streak_type")
        if streak_type == "login":
            current_streak = profile.login_streak
            longest_streak = profile.longest_login_streak
        else:
            current_streak = profile.learning_streak
            longest_streak = profile.longest_learning_streak

        return {
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "streak_maintained": True,  # Would need logic to determine
            "streak_broken": False,
        }

    except GamificationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(
            "Streak update error for user %s org %s: %s", user.id, org_id, e
        )
        raise HTTPException(status_code=500, detail="Failed to update streak")


@router.get("/config")
async def get_config():
    """Get gamification configuration"""
    from src.db.gamification import DAILY_XP_LIMIT, MAX_LEVEL, XP_REWARDS

    return {
        "xp_rewards": XP_REWARDS,
        "daily_xp_limit": DAILY_XP_LIMIT,
        "max_level": MAX_LEVEL,
        "xp_sources": [
            {
                "key": source.value,
                "label": source.value.replace("_", " ").title(),
                "default_xp": XP_REWARDS.get(source.value, 0),
                "category": "general",
            }
            for source in XPSource
        ],
    }
