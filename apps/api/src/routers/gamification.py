"""
Gamification Router

Clean API (no legacy):
- GET /{org_id} → Dashboard
- POST /{org_id}/xp → Award XP (typed only)
- POST /{org_id}/streaks/{streak_type} → Update streak
- PATCH /{org_id}/preferences → Update preferences
- GET /{org_id}/leaderboard → Leaderboard
- GET /{org_id}/rank → Current user rank
"""

import logging
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlmodel import Session, and_, select

from src.core.events.database import get_db_session
from src.core.timezone import now as tz_now
from src.db.gamification import (
    DashboardRead,
    GamificationProfile,
    LeaderboardEntryRead,
    LeaderboardRead,
    ProfileRead,
    StreakUpdateRead,
    TransactionRead,
    XPAwardRequest,
    XPAwardResponse,
    XPSource,
    XPTransaction,
)
from src.db.gamification import (
    StreakType as DBStreakType,
)
from src.db.users import PublicUser
from src.db.users import User as DBUser
from src.security.auth import get_current_user
from src.services.gamification import service
from src.services.gamification.service import (
    DailyLimitExceededError,
    GamificationError,
)
from src.services.security.security import is_user_admin_of_org

logger = logging.getLogger(__name__)
router = APIRouter()


def _profile_to_read(p: GamificationProfile) -> ProfileRead:
    return ProfileRead(
        user_id=p.user_id,
        org_id=p.org_id,
        total_xp=p.total_xp,
        level=p.level,
        xp_in_current_level=p.xp_in_current_level,
        xp_to_next_level=p.xp_to_next_level,
        level_progress_percent=p.level_progress_percent,
        login_streak=p.login_streak,
        longest_login_streak=p.longest_login_streak,
        learning_streak=p.learning_streak,
        longest_learning_streak=p.longest_learning_streak,
        last_xp_award_date=p.last_xp_award_date,
        last_login_date=p.last_login_date,
        last_learning_date=p.last_learning_date,
        daily_xp_earned=p.daily_xp_earned,
        total_activities_completed=p.total_activities_completed,
        total_courses_completed=p.total_courses_completed,
        preferences=p.preferences or {},
        created_at=p.created_at,
        updated_at=p.updated_at,
    )


def _transaction_to_read(tx: XPTransaction) -> TransactionRead:
    return TransactionRead(
        id=tx.id,
        user_id=tx.user_id,
        org_id=tx.org_id,
        amount=tx.amount,
        source=tx.source,
        source_id=tx.source_id,
        triggered_level_up=tx.triggered_level_up,
        previous_level=tx.previous_level,
        created_at=tx.created_at,
    )


@router.get("/{org_id}")
async def get_unified_dashboard(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    """Unified endpoint: Get complete gamification dashboard, profile, leaderboard, and config"""
    try:
        data = service.get_dashboard_data(db, user.id, org_id, include_leaderboard=True)
        # Convert to typed DashboardRead using existing serializers
        profile = _profile_to_read(data["profile"])
        recent_txs = [
            TransactionRead(
                id=tx.id,
                user_id=tx.user_id,
                org_id=tx.org_id,
                amount=tx.amount,
                source=tx.source,
                source_id=tx.source_id,
                triggered_level_up=tx.triggered_level_up,
                previous_level=tx.previous_level,
                created_at=tx.created_at,
            )
            for tx in data["recent_transactions"]
        ]
        leaderboard = data.get("leaderboard")
        return DashboardRead(
            profile=profile,
            recent_transactions=recent_txs,
            user_rank=data.get("user_rank"),
            leaderboard=leaderboard,
        )

    except Exception as e:
        logger.exception("Dashboard error for user %s org %s: %s", user.id, org_id, e)
        raise HTTPException(status_code=500, detail="Failed to get dashboard")


@router.post("/{org_id}/xp", response_model=XPAwardResponse)
async def award_xp(
    org_id: int,
    payload: XPAwardRequest,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    """Award XP with strong typing and idempotency."""
    logger.info(f"Award XP request: user={user.id} org={org_id} payload={payload}")
    try:
        # Admin-only for custom amounts
        if payload.custom_amount is not None:
            if payload.source != XPSource.ADMIN_AWARD:
                raise HTTPException(
                    status_code=400,
                    detail="custom_amount allowed only with ADMIN_AWARD source",
                )
            is_admin = is_user_admin_of_org(user.id, org_id, db)
            if not is_admin:
                raise HTTPException(
                    status_code=403,
                    detail="Admin privileges required for custom awards",
                )

        # Normalize source: allow raw string or enum from request
        try:
            normalized_source = (
                payload.source.value
                if isinstance(payload.source, XPSource)
                else XPSource(str(payload.source)).value
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid XP source")

        profile, transaction, level_up, is_new = service.award_xp(
            db=db,
            user_id=user.id,
            org_id=org_id,
            source=normalized_source,
            amount=payload.custom_amount,
            source_id=payload.source_id,
            idempotency_key=payload.idempotency_key,
        )
        return XPAwardResponse(
            transaction=_transaction_to_read(transaction),
            profile=_profile_to_read(profile),
            level_up_occurred=level_up,
            previous_level=transaction.previous_level,
            is_new_transaction=is_new,
        )
    except DailyLimitExceededError as e:
        logger.warning(f"Daily limit exceeded for user {user.id} org {org_id}: {e}")
        raise HTTPException(status_code=429, detail=str(e))
    except GamificationError as e:
        logger.warning(f"Gamification error for user {user.id} org {org_id}: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Award XP error for user %s org %s: %s", user.id, org_id, e)
        raise HTTPException(status_code=500, detail="Failed to award XP")


@router.post("/{org_id}/streaks/{streak_type}", response_model=StreakUpdateRead)
async def update_streak(
    org_id: int,
    streak_type: DBStreakType,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    try:
        profile = service.update_streak(db, user.id, org_id, streak_type.value)
        if streak_type == DBStreakType.LOGIN:
            return StreakUpdateRead(
                streak_type=streak_type.value,
                current_count=profile.login_streak,
                longest_count=profile.longest_login_streak,
                is_new_record=profile.login_streak == profile.longest_login_streak,
            )
        return StreakUpdateRead(
            streak_type=streak_type.value,
            current_count=profile.learning_streak,
            longest_count=profile.longest_learning_streak,
            is_new_record=profile.learning_streak == profile.longest_learning_streak,
        )
    except GamificationError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception(
            "Update streak error for user %s org %s: %s", user.id, org_id, e
        )
        raise HTTPException(status_code=500, detail="Failed to update streak")


@router.patch("/{org_id}/preferences", response_model=ProfileRead)
async def update_preferences(
    org_id: int,
    data: Annotated[dict[str, Any], Body()] = ...,
    user: Annotated[PublicUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db_session)] = None,
):
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="Invalid preferences body")
    try:
        profile = service.update_preferences(db, user.id, org_id, data)
        return _profile_to_read(profile)
    except Exception as e:
        logger.exception(
            "Update preferences error for user %s org %s: %s", user.id, org_id, e
        )
        raise HTTPException(status_code=500, detail="Failed to update preferences")


@router.get("/{org_id}/leaderboard", response_model=LeaderboardRead)
async def get_leaderboard(
    org_id: int,
    limit: Annotated[int, Query(ge=1, le=100)] = 10,
    offset: Annotated[int, Query(ge=0)] = 0,
    user: Annotated[PublicUser, Depends(get_current_user)] = None,
    db: Annotated[Session, Depends(get_db_session)] = None,
):
    try:
        return service.get_leaderboard_read(db, org_id, limit=limit, offset=offset)
    except Exception as e:
        logger.exception("Leaderboard error for org %s: %s", org_id, e)
        raise HTTPException(status_code=500, detail="Failed to get leaderboard")


@router.get("/{org_id}/rank")
async def get_user_rank(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db_session)],
):
    """Return the current user's rank within the organization.

    Shape kept intentionally simple for flexible client usage.
    """
    try:
        rank = service.get_user_rank(db, user.id, org_id)
        if rank is None:
            # No profile yet -> create on demand to keep idempotent, then compute
            service.get_profile(db, user.id, org_id)
            rank = service.get_user_rank(db, user.id, org_id)
        return {"org_id": org_id, "user_id": user.id, "rank": rank}
    except Exception as e:
        logger.exception("User rank error for user %s org %s: %s", user.id, org_id, e)
        raise HTTPException(status_code=500, detail="Failed to get user rank")
