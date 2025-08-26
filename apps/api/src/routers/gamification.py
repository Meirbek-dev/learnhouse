"""
Gamification API Router

Provides endpoints for gamification features including:
- User gamification profiles
- XP transactions and history
- Streak tracking
- Leaderboards
- Dashboard data
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlmodel import Session, select

from src.core.events.database import get_db_session
from src.core.timezone import now_local, today_local
from src.db.gamification import (
    OrganizationLeaderboard,
    UserGamificationPreferenceRead,
    UserGamificationPreferenceUpsert,
    XPAwardRequest,
    XPSource,
)
from src.db.user_organizations import UserOrganization
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.gamification.gamification import (
    GamificationConfig,
    award_xp,
    calculate_level_details,
    get_gamification_dashboard,
    get_or_create_profile,
    get_organization_leaderboard,
    update_learning_streak,
    update_login_streak,
)

router = APIRouter()


def _serialize_profile(profile) -> dict[str, Any]:
    """Serialize DB profile to API contract expected by web app.

    Frontend currently expects: creation_date/update_date & xp_to_next_level.
    We keep DB field names intact and only transform the outbound shape.
    """
    # Support both SQLModel instance and already-dumped dict
    if isinstance(profile, dict):
        total_xp = profile.get("total_xp", 0)
        level, xp_in_level, xp_to_next, progress = calculate_level_details(total_xp)
        last_login_date = profile.get("last_login_date")
        if isinstance(last_login_date, str):
            try:
                from datetime import datetime as _dt

                # Attempt ISO parse; fallback leave string
                parsed_last = _dt.fromisoformat(last_login_date)
            except Exception:
                parsed_last = None
        else:
            parsed_last = last_login_date
        today_flag = bool(parsed_last and parsed_last.date() == today_local())
        return {
            "id": profile.get("id"),
            "user_id": profile.get("user_id"),
            "org_id": profile.get("org_id"),
            "total_xp": total_xp,
            "current_level": level,
            "xp_to_next_level": xp_to_next,
            "xp_in_level": xp_in_level,
            "level_progress_percent": progress,
            "current_login_streak": profile.get("current_login_streak", 0),
            "longest_login_streak": profile.get("longest_login_streak", 0),
            "current_learning_streak": profile.get("current_learning_streak", 0),
            "longest_learning_streak": profile.get("longest_learning_streak", 0),
            "last_login_date": last_login_date,
            "last_learning_activity_date": profile.get("last_learning_activity_date"),
            "creation_date": profile.get("created_at") or profile.get("creation_date"),
            "update_date": profile.get("updated_at") or profile.get("update_date"),
            "profile_data": profile.get("profile_data", {}),
            "daily_xp_earned": profile.get("daily_xp_earned", 0),
            "daily_xp_limit": profile.get(
                "daily_xp_limit", GamificationConfig.MAX_DAILY_XP
            ),
            "daily_goal_xp": profile.get(
                "daily_goal_xp", GamificationConfig.DEFAULT_DAILY_GOAL_XP
            ),
            "login_streak_updated_today": today_flag,
        }

    level, xp_in_level, xp_to_next, progress = calculate_level_details(profile.total_xp)
    today_flag = (
        profile.last_login_date is not None
        and profile.last_login_date.date() == today_local()
    )
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "org_id": profile.org_id,
        "total_xp": profile.total_xp,
        "current_level": level,  # ensure recalculated consistency
        "xp_to_next_level": xp_to_next,
        "xp_in_level": xp_in_level,
        "level_progress_percent": progress,
        "current_login_streak": profile.current_login_streak,
        "longest_login_streak": profile.longest_login_streak,
        "current_learning_streak": profile.current_learning_streak,
        "longest_learning_streak": profile.longest_learning_streak,
        "last_login_date": profile.last_login_date,
        "last_learning_activity_date": profile.last_learning_activity_date,
        # Aliases for FE naming
        "creation_date": profile.created_at,
        "update_date": profile.updated_at,
        # Enhanced profile data
        "profile_data": profile.preferences or {},
        "daily_xp_earned": profile.daily_xp_earned,
        "daily_xp_limit": profile.daily_xp_limit,
        "daily_goal_xp": profile.daily_goal_xp,
        "total_activities_completed": profile.total_activities_completed,
        "total_courses_completed": profile.total_courses_completed,
        "total_sessions": profile.total_sessions,
        "login_streak_updated_today": today_flag,
    }


def _serialize_transaction(tx) -> dict[str, Any]:
    """Map XPTransaction model to FE contract.

    Frontend expects: xp_source, xp_context, creation_date; we provide graceful fallbacks.
    """
    if isinstance(tx, dict):
        src = tx.get("source") or tx.get("xp_source")
        return {
            "id": tx.get("id"),
            "user_id": tx.get("user_id"),
            "org_id": tx.get("org_id"),
            "xp_amount": tx.get("xp_amount", 0),
            "xp_source": src,
            "xp_context": tx.get("metadata")
            or tx.get("transaction_metadata")
            or tx.get("xp_context")
            or {},
            "related_activity_id": tx.get("source_id"),
            "related_course_id": None,
            "related_trail_step_id": None,
            "creation_date": tx.get("created_at") or tx.get("creation_date"),
            "level_before": tx.get("previous_level") or tx.get("level_before"),
            "level_after": tx.get("new_level") or tx.get("level_after"),
            "level_up_occurred": tx.get("triggered_level_up")
            or tx.get("level_up_occurred", False),
            "base_xp": (
                (tx.get("xp_amount", 0) - tx.get("bonus_xp", 0))
                if tx.get("xp_amount") is not None
                else tx.get("base_xp")
            ),
            "bonus_xp": tx.get("bonus_xp", 0),
            "multiplier": tx.get("multiplier_applied") or tx.get("multiplier", 1.0),
            "idempotency_key": tx.get("idempotency_key"),
        }
    # XPTransaction model fields mapping
    return {
        "id": tx.id,
        "user_id": tx.user_id,
        "org_id": tx.org_id,
        "xp_amount": tx.xp_amount,
        "xp_source": tx.source,
        "xp_context": getattr(tx, "transaction_metadata", {}) or {},
        "related_activity_id": tx.source_id,
        "related_course_id": None,
        "related_trail_step_id": None,
        "creation_date": tx.created_at,
        "level_before": tx.previous_level,
        "level_after": tx.new_level,
        "level_up_occurred": tx.triggered_level_up,
        "base_xp": tx.xp_amount - getattr(tx, "bonus_xp", 0),
        "bonus_xp": tx.bonus_xp,
        "multiplier": tx.multiplier_applied,
        "idempotency_key": getattr(tx, "idempotency_key", None),
    }


async def verify_user_org_membership(
    user_id: int, org_id: int, db_session: Session
) -> bool:
    """Verify that user belongs to the organization."""
    membership = db_session.exec(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id, UserOrganization.org_id == org_id
        )
    ).first()
    return membership is not None


@router.get("/profile/{org_id}")
async def get_gamification_profile(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """Get user's gamification profile.

    Also performs an automatic login streak update (idempotent) so that
    frontends that only call /profile still advance streaks.
    """

    # Verify membership
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    profile = await get_or_create_profile(current_user.id, org_id, db_session)

    # Auto update login streak if not recorded today (safe & idempotent)
    try:
        if (
            not profile.last_login_date
            or profile.last_login_date.date() != today_local()
        ):
            profile = await update_login_streak(
                current_user.id, org_id, db_session, request
            )
    except Exception:
        # Non-fatal; return profile even if streak update failed
        pass

    return _serialize_profile(profile)


@router.post("/login-streak/{org_id}")
async def update_user_login_streak(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """Update user's login streak. Idempotent per day."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    profile = await update_login_streak(current_user.id, org_id, db_session, request)

    return _serialize_profile(profile)


@router.head("/login-streak/{org_id}")
async def head_user_login_streak(
    org_id: int,
    response: Response,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
):
    """Lightweight idempotent login streak update.

    Performs the same logic as POST but returns no body. Headers expose result.
    - X-Login-Streak-Updated: true|false (whether last_login_date is today after call)
    - X-Current-Login-Streak: <int>
    """
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )
    # Capture state before
    profile = await get_or_create_profile(current_user.id, org_id, db_session)
    pre_same_day = (
        profile.last_login_date and profile.last_login_date.date() == today_local()
    )
    if not pre_same_day:
        profile = await update_login_streak(
            current_user.id, org_id, db_session, request
        )
    updated_flag = (
        profile.last_login_date and profile.last_login_date.date() == today_local()
    )
    response.headers["X-Login-Streak-Updated"] = "true" if updated_flag else "false"
    response.headers["X-Current-Login-Streak"] = str(profile.current_login_streak)
    return Response(status_code=204)


@router.post("/learning-streak/{org_id}")
async def update_user_learning_streak(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """Update user's learning streak (activity based). Idempotent per day per activity context."""

    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    profile = await update_learning_streak(current_user.id, org_id, db_session)
    return _serialize_profile(profile)


@router.post("/award-xp/{org_id}")
async def award_user_xp(
    org_id: int,
    award_request: XPAwardRequest,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """
    Award XP to user with idempotency guarantees.
    Requires idempotency_key to prevent duplicate awards.
    """

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    # Generate idempotency key if not provided
    if not award_request.idempotency_key:
        award_request.idempotency_key = str(uuid.uuid4())

    # Server-enforced source validation & RBAC
    try:
        source_enum = (
            award_request.source
            if isinstance(award_request.source, XPSource)
            else XPSource(award_request.source)
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid XP source",
        )

    # Restrict ADMIN_AWARD to org admins (reuse RBAC helper)
    if source_enum == XPSource.ADMIN_AWARD:
        from src.security.rbac.rbac import (
            authorization_verify_based_on_org_admin_status,
        )

        is_admin = await authorization_verify_based_on_org_admin_status(
            request, current_user.id, "create", f"org_{org_id}", db_session
        )
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only organization admins can issue admin XP awards",
            )

    # Disallow client specifying custom_amount for non-admin unless source supports it
    SOURCES_ALLOWING_CUSTOM = {XPSource.ADMIN_AWARD}
    if (
        award_request.custom_amount is not None
        and source_enum not in SOURCES_ALLOWING_CUSTOM
    ):
        # Nullify custom amount to enforce server table
        award_request.custom_amount = None

    award_request.source = source_enum

    response = await award_xp(
        current_user.id, org_id, award_request, db_session, request
    )

    # Return same schema but normalize embedded profile
    data = response.model_dump()
    data["profile"] = _serialize_profile(data["profile"])
    data["transaction"] = _serialize_transaction(data["transaction"])

    return data


@router.get("/dashboard/{org_id}")
async def get_user_gamification_dashboard(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """Get comprehensive gamification dashboard for user."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    dashboard = await get_gamification_dashboard(current_user.id, org_id, db_session)

    # Enrich profile in dashboard for FE parity
    dash_dict = dashboard.model_dump()
    dash_dict["profile"] = _serialize_profile(dashboard.profile)

    # Normalize transactions list name differences
    if "recent_transactions" in dash_dict:
        dash_dict["recent_xp_transactions"] = [
            _serialize_transaction(tx) for tx in dash_dict.pop("recent_transactions")
        ]

    return dash_dict


@router.get("/leaderboard/{org_id}", response_model=OrganizationLeaderboard)
async def get_org_leaderboard(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
    leaderboard_type: Annotated[str, Query(regex="^(xp|streaks|achievements)$")] = "xp",
    period: Annotated[str, Query(regex="^(all_time|monthly|weekly)$")] = "all_time",
    limit: Annotated[int, Query(le=100, ge=1)] = 50,
) -> OrganizationLeaderboard:
    """Get organization leaderboard."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    return await get_organization_leaderboard(
        org_id, db_session, leaderboard_type, period, limit, current_user.id
    )


@router.get("/xp-rewards")
async def get_xp_rewards() -> dict[str, int]:
    """Get XP reward values for different actions."""
    return GamificationConfig.XP_REWARDS


@router.get("/level-metadata")
async def get_level_metadata() -> dict[str, Any]:
    """Get level calculation metadata and sample progression."""

    # Generate sample level progression
    sample_levels = []
    for level in range(1, 21):  # First 20 levels
        if level == 1:
            cumulative_xp = 0
        else:
            # Calculate XP needed for this level
            xp_needed = int(
                GamificationConfig.BASE_XP_PER_LEVEL
                * (GamificationConfig.XP_MULTIPLIER_PER_LEVEL ** (level - 1))
            )
            if level == 2:
                cumulative_xp = xp_needed
            else:
                prev_cumulative = sample_levels[-1]["cumulative_xp"]
                cumulative_xp = prev_cumulative + xp_needed

        sample_levels.append(
            {
                "level": level,
                "xp_required": int(
                    GamificationConfig.BASE_XP_PER_LEVEL
                    * (GamificationConfig.XP_MULTIPLIER_PER_LEVEL ** (level - 1))
                )
                if level > 1
                else 0,
                "cumulative_xp": cumulative_xp,
            }
        )

    return {
        "base_xp_per_level": GamificationConfig.BASE_XP_PER_LEVEL,
        "xp_multiplier_per_level": GamificationConfig.XP_MULTIPLIER_PER_LEVEL,
        "max_level": GamificationConfig.MAX_LEVEL,
        "max_daily_xp": GamificationConfig.MAX_DAILY_XP,
        "sample_levels": sample_levels,
        "calculation_note": "XP required for level N = BASE_XP * (MULTIPLIER ^ (N-1))",
    }


@router.get("/preferences/{org_id}", response_model=UserGamificationPreferenceRead)
async def get_gamification_preferences(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> UserGamificationPreferenceRead:
    """Get user's gamification preferences."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    # Get or create profile
    from src.services.gamification.gamification import get_or_create_profile

    profile = await get_or_create_profile(current_user.id, org_id, db_session)

    return UserGamificationPreferenceRead(
        user_id=current_user.id,
        org_id=org_id,
        preferences=profile.preferences
        or {
            "notifications": {
                "levelUp": True,
                "xpGain": True,
                "streakReminder": False,
                "weeklyReport": True,
            },
            "privacy": {
                "showOnLeaderboard": True,
                "publicProfileStats": True,
                "shareProgress": False,
            },
            "display": {
                "animatedEffects": True,
                "compactMode": False,
                "showLevelIndicator": True,
                "autoHideToasts": False,
            },
        },
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.put("/preferences/{org_id}", response_model=UserGamificationPreferenceRead)
async def update_gamification_preferences(
    org_id: int,
    preferences_update: UserGamificationPreferenceUpsert,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> UserGamificationPreferenceRead:
    """Update user's gamification preferences."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization",
        )

    # Get or create profile
    from src.services.gamification.gamification import get_or_create_profile

    profile = await get_or_create_profile(current_user.id, org_id, db_session)

    # Update preferences in the profile
    profile.preferences = preferences_update.preferences
    profile.updated_at = now_local()
    # Invalidate caches so UI sees updated preferences
    from src.services.gamification.gamification import CacheManager

    CacheManager.delete(
        f"gamification:profile:{org_id}:{current_user.id}",
        f"gamification:dashboard:{org_id}:{current_user.id}",
    )
    db_session.commit()
    db_session.refresh(profile)

    return UserGamificationPreferenceRead(
        user_id=current_user.id,
        org_id=org_id,
        preferences=profile.preferences,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )
