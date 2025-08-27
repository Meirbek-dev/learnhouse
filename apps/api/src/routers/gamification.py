"""Gamification API Router."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from src.db.gamification import (
    OrganizationLeaderboard,
    UserGamificationPreferenceRead,
    UserGamificationPreferenceUpsert,
    XPSource,
)
from src.db.users import PublicUser
from src.security.auth import get_current_user
from src.services.gamification import (
    calculate_level_details,
    get_gamification_config,
)
from src.services.gamification.gamification import (
    get_gamification_dashboard_result,
    get_gamification_preferences_result,
    update_gamification_preferences_result,
    get_gamification_profile_result,
)
from src.services.gamification.service_container import (
    GamificationServices,
    get_gamification_services,
)
from src.services.gamification.xp_sources import list_xp_sources
from src.services.gamification.cache_service import create_cache_service

router = APIRouter()

# ----------------------------------------------------------------------------
# Shared helpers: Result -> HTTPException mapping + decorator
# ----------------------------------------------------------------------------

ERROR_STATUS_MAP = {
    "invalid_amount": (400, "XP amount must be positive"),
    "daily_cap": (429, "Daily XP cap reached"),
    "integrity_error": (409, "Duplicate XP transaction"),
    "achievement_create_failed": (500, "Failed to create achievement"),
    "achievement_check_failed": (500, "Failed to check achievements"),
    "achievement_progress_failed": (500, "Failed to get achievement progress"),
    "badge_create_failed": (500, "Failed to create badge"),
    "badge_not_found": (404, "Badge not found"),
    "badge_award_failed": (500, "Failed to award badge"),
    "leaderboard_error": (500, "Failed to build leaderboard"),
    "streak_error": (500, "Failed to update streak"),
    "preferences_error": (500, "Failed to load preferences"),
    "preferences_update_error": (500, "Failed to update preferences"),
    "dashboard_error": (500, "Failed to load dashboard"),
    "profile_error": (500, "Failed to load profile"),
}


def raise_for_result(result) -> None:  # small helper
    if result.ok:
        return
    code = result.code or "error"
    status_code, message = ERROR_STATUS_MAP.get(code, (500, "Internal error"))
    raise HTTPException(status_code=status_code, detail=message)


def result_endpoint(fn):  # decorator to DRY error unwrapping for simple endpoints
    async def wrapper(*args, **kwargs):  # pragma: no cover - thin wrapper
        result = await fn(*args, **kwargs)
        raise_for_result(result)
        return result.value

    return wrapper


@router.get(
    "/profile/{org_id}",
    summary="Get gamification profile",
    response_description="Current gamification profile with level & streak info",
)
async def get_profile(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    """Get user's gamification profile (Result-based)."""
    result = await get_gamification_profile_result(
        user_id=user.id, org_id=org_id, db_session=services.xp.db_session
    )
    raise_for_result(result)
    return {"data": {"profile": result.value}, "meta": {"version": 1}}


@router.post(
    "/award-xp/{org_id}",
    summary="Award XP",
    response_description="XP award transaction + updated profile snapshot",
)
async def award_xp_endpoint(
    org_id: int,
    source: XPSource,
    source_id: str,
    request: Request,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
    metadata: dict[str, Any] | None = None,
    custom_amount: int | None = None,
):
    """Award XP to user (idempotent via X-Idempotency-Key header)."""
    try:
        idem_key = request.headers.get("X-Idempotency-Key")
        result = await services.xp.award_xp(
            user_id=user.id,
            org_id=org_id,
            source=source,
            source_id=source_id,
            metadata=metadata or {},
            custom_amount=custom_amount,
            idempotency_key=idem_key,
        )
        raise_for_result(result)

        return {"data": result.value.model_dump(), "meta": {"version": 1}}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to award XP: {e!s}",
        )


@router.post(
    "/login-streak/{org_id}",
    summary="Update login streak",
    response_description="Updated login streak status (idempotent per day)",
)
async def update_login_streak_endpoint(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    """Update user's login streak."""
    result = await services.streaks.update_login_streak(user.id, org_id)

    raise_for_result(result)
    profile_result = await get_gamification_profile_result(
        user_id=user.id, org_id=org_id, db_session=services.xp.db_session
    )
    raise_for_result(profile_result)
    # Update cache proactively with fresh profile (already loaded by helper)
    try:  # pragma: no cover
        cache = create_cache_service()
        cache.set_profile(user.id, org_id, profile_result.value)
    except Exception:
        pass
    return {
        "data": {
            "profile": profile_result.value,
            "streak_updated": result.value.get("streak_updated", False),
        },
        "meta": {"version": 1},
    }


@router.post(
    "/learning-streak/{org_id}",
    summary="Update learning streak",
    response_description="Updated learning streak status (idempotent per day)",
)
async def update_learning_streak_endpoint(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    """Update user's learning streak."""
    result = await services.streaks.update_learning_streak(user.id, org_id)
    raise_for_result(result)
    profile_result = await get_gamification_profile_result(
        user_id=user.id, org_id=org_id, db_session=services.xp.db_session
    )
    raise_for_result(profile_result)
    try:  # pragma: no cover
        cache = create_cache_service()
        cache.set_profile(user.id, org_id, profile_result.value)
    except Exception:
        pass
    return {
        "data": {
            "profile": profile_result.value,
            "streak_updated": result.value.get("streak_updated", False),
        },
        "meta": {"version": 1},
    }


@router.post(
    "/events/activity-completed/{org_id}",
    summary="Activity completion event",
    response_description="Acknowledgement of processed activity completion",
)
async def handle_activity_completion(
    org_id: int,
    activity_id: str,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    """Handle activity completion event."""
    try:
        result = await services.xp.award_xp(
            user_id=user.id,
            org_id=org_id,
            source=XPSource.ACTIVITY_COMPLETION,
            source_id=activity_id,
            metadata={},
        )
        raise_for_result(result)
        award = result.value
        streak_result = await services.streaks.update_learning_streak(user.id, org_id)
        if not streak_result.ok:
            # Non-fatal; include warning
            award_dict = award.model_dump()
            award_dict["streak_warning"] = streak_result.error
            return {"data": {"xp_award": award_dict}, "meta": {"version": 1}}
        return {"data": {"xp_award": award.model_dump()}, "meta": {"version": 1}}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to handle activity completion: {e!s}",
        )


@router.post("/events/course-completed/{org_id}")
async def handle_course_completion(
    org_id: int,
    course_id: str,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
    activity_count: int = 1,
):
    """Handle course completion event."""
    try:
        result = await services.xp.award_xp(
            user_id=user.id,
            org_id=org_id,
            source=XPSource.COURSE_COMPLETION,
            source_id=course_id,
            metadata={"activity_count": activity_count},
        )
        raise_for_result(result)
        award = result.value
        await services.streaks.update_learning_streak(user.id, org_id)  # ignore errors
        return {"data": {"xp_award": award.model_dump()}, "meta": {"version": 1}}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to handle course completion: {e!s}",
        )


@router.get(
    "/config",
    summary="Public gamification config",
    response_description="Safe subset of gamification configuration",
)
async def get_config():
    """Get gamification configuration (public safe subset)."""
    try:
        config = get_gamification_config()
        xp_rewards = {
            k: getattr(config.xp_rewards, k)
            for k in dir(config.xp_rewards)
            if not k.startswith("_")
            and isinstance(getattr(config.xp_rewards, k), (int, float))
        }
        return {
            "levels": {
                "base_xp": config.levels.base_xp,
                "multiplier": config.levels.multiplier,
                "max_level": config.levels.max_level,
            },
            "xp_rewards": xp_rewards,
            "streaks": {
                "login_milestones": list(config.streaks.login_milestones),
                "learning_milestones": list(config.streaks.learning_milestones),
                "weekly_bonus_interval": getattr(
                    config.streaks, "weekly_bonus_interval", None
                ),
            },
            "daily_caps": {
                "max_daily_xp": config.daily_caps.max_daily_xp,
                "default_daily_goal": config.daily_caps.default_daily_goal,
            },
            "features": {
                "streaks": config.enable_streaks,
                "achievements": config.enable_achievements,
                "leaderboards": config.enable_leaderboards,
                "daily_goals": config.enable_daily_goals,
            },
        }
    except Exception as e:  # pragma: no cover - defensive
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get config: {e!s}",
        )


@router.get(
    "/xp-sources",
    summary="List XP sources",
    response_description="Metadata for all XP sources (label, description, default XP)",
)
async def get_xp_sources(
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    """Get XP source metadata using shared CacheService."""
    cache_key = "xp_sources"
    cached = services.cache.get(cache_key)
    if cached is not None:
        return cached
    data = {"sources": list_xp_sources()}
    services.cache.set(cache_key, data, ttl=60)
    return data


@router.get("/preferences/{org_id}", response_model=UserGamificationPreferenceRead)
async def get_preferences(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    """Get user's gamification preferences."""
    result = await get_gamification_preferences_result(
        user_id=user.id,
        org_id=org_id,
        db_session=services.xp.db_session,
    )
    raise_for_result(result)
    return result.value


@router.put("/preferences/{org_id}", response_model=UserGamificationPreferenceRead)
async def update_preferences(
    org_id: int,
    preferences: UserGamificationPreferenceUpsert,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    """Update user's gamification preferences."""
    result = await update_gamification_preferences_result(
        user_id=user.id,
        org_id=org_id,
        preferences=preferences,
        db_session=services.xp.db_session,
    )
    raise_for_result(result)
    return result.value


@router.get(
    "/dashboard/{org_id}",
    summary="Gamification dashboard",
    response_description="Aggregated gamification dashboard data",
)
async def get_dashboard(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    """Get gamification dashboard data."""
    result = await get_gamification_dashboard_result(
        user_id=user.id,
        org_id=org_id,
        db_session=services.xp.db_session,
    )
    raise_for_result(result)
    return result.value


@router.get("/streaks/summary/{org_id}", summary="Get streak summary")
async def streak_summary(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    result = await services.streaks.get_streak_summary(user.id, org_id)
    raise_for_result(result)
    return {"data": result.value}


@router.get(
    "/leaderboard/{org_id}",
    response_model=OrganizationLeaderboard,
    summary="Organization leaderboard",
    response_description="Leaderboard entries for organization",
)
async def get_leaderboard(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    """Get organization leaderboard."""
    # Prefer new leaderboard service (Result) if available
    try:
        result = await services.leaderboard.get_top_xp(
            org_id=org_id, limit=limit, current_user_id=user.id
        )
        raise_for_result(result)
        lb = result.value
        return {
            "org_id": lb.org_id,
            "leaderboard_type": "xp_leaderboard",
            "period": "all_time",
            "leaderboard_entries": [
                {
                    "rank": e.rank,
                    "user_id": e.user_id,
                    "username": e.username,
                    "total_xp": e.total_xp,
                    "current_level": e.current_level,
                    "is_current_user": e.is_current_user,
                }
                for e in lb.entries
            ],
            "total_participants": lb.total_participants,
            "current_user_rank": lb.current_user_rank,
            "last_updated": lb.last_updated,
        }
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover - defensive fallback
        raise HTTPException(status_code=500, detail=f"Failed to get leaderboard: {e!s}")


# ---------------------------------------------------------------------------
# Achievement & Badge Endpoints (Result-based services)
# ---------------------------------------------------------------------------


@router.get("/achievements/{org_id}", summary="List achievements & progress")
async def list_achievements(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    progress_result = await services.achievements.get_user_achievement_progress(
        user.id, org_id
    )
    raise_for_result(progress_result)
    return {"data": progress_result.value}


@router.post("/achievements/check/{org_id}", summary="Check & unlock achievements")
async def check_achievements(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    result = await services.achievements.check_user_achievements(user.id, org_id)
    raise_for_result(result)
    return {"data": [a.achievement_key for a in result.value]}


@router.post("/badges/{org_id}/{badge_key}", summary="Award badge manually (admin)")
async def award_badge(
    org_id: int,
    badge_key: str,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    result = await services.achievements.award_badge(user.id, org_id, badge_key)
    raise_for_result(result)
    badge = result.value
    return {
        "data": {
            "badge_key": badge_key,
            "earned_at": getattr(badge, "earned_at", None),
            "user_id": badge.user_id if badge else user.id,
        }
    }
