"""Gamification API Router."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from datetime import datetime

from src.db.gamification import (
    UserGamificationPreferenceRead,
    UserGamificationPreferenceUpsert,
    XPSource,
)
from src.schemas.gamification import (
    DashboardRead,
    ProfileRead,
    StreakSummaryRead,
    StreakUpdateRead,
    LeaderboardRead,
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
    get_gamification_profile_result,
    update_gamification_preferences_result,
)
from src.services.gamification.service_container import (
    GamificationServices,
    get_gamification_services,
)
from src.services.gamification.xp_sources import list_xp_sources
from src.services.gamification.etag import (
    make_dashboard_etag,
    make_profile_etag,
)
from src.routers.admin import is_user_admin_of_org

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
    response_model=ProfileRead,
)
async def get_profile(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
    request: Request,
    response: Response,
):
    """Get user's gamification profile (Result-based)."""
    result = await get_gamification_profile_result(
        user_id=user.id, org_id=org_id, db_session=services.xp.db_session
    )
    raise_for_result(result)
    payload = result.value  # ProfileRead
    # ETag support: cache on profile snapshot
    try:
        # Synthesize a stable numeric profile_id from (org_id, user_id)
        synthetic_id = (payload.org_id << 32) ^ payload.user_id
        etag = make_profile_etag(
            profile_id=synthetic_id,
            updated_at=payload.updated_at,
            total_xp=payload.total_xp,
        )
        inm = request.headers.get("If-None-Match")
        quoted = f'"p-{etag}"'
        if inm and inm.strip() == quoted:
            raise HTTPException(status_code=status.HTTP_304_NOT_MODIFIED)
        response.headers["ETag"] = quoted
        response.headers["Cache-Control"] = "private, max-age=0, must-revalidate"
    except Exception:  # pragma: no cover - optional feature
        pass
    return payload


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

        # Router-level guardrails
        # 1) Enforce X-Idempotency-Key for admin-triggered awards
        if source == XPSource.ADMIN_AWARD:
            if not idem_key or not idem_key.strip():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="X-Idempotency-Key header is required for ADMIN_AWARD",
                )
            # Enforce admin/maintainer rights within this org (or global admin)
            is_admin = await is_user_admin_of_org(user.id, org_id, services.xp.db_session)
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to perform admin XP awards",
                )
            # Optional clamp to keep single admin awards bounded
            try:
                config = get_gamification_config()
                max_single_award = max(1, int(config.daily_caps.max_daily_xp))
            except Exception:
                max_single_award = 1000  # safe fallback
            if custom_amount is None or custom_amount <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="custom_amount must be a positive integer for ADMIN_AWARD",
                )
            if custom_amount > max_single_award:
                custom_amount = max_single_award
        else:
            # Non-admin sources are server-controlled; ignore any client-provided custom amount
            custom_amount = None

        # 2) Explicit source validation (defensive; Enum already validates unknown sources)
        if not isinstance(source, XPSource):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unknown XP source",
            )
        # Include minimal metadata; for admin awards carry custom_amount for observability
        safe_metadata: dict[str, Any] = {}
        if metadata:
            safe_metadata.update(metadata)
        if source == XPSource.ADMIN_AWARD and custom_amount is not None:
            safe_metadata.setdefault("custom_amount", int(custom_amount))

        result = await services.xp.award_xp(
            user_id=user.id,
            org_id=org_id,
            source=source,
            source_id=source_id,
            metadata=safe_metadata,
            custom_amount=custom_amount,
            idempotency_key=idem_key,
            admin_user_id=user.id if source == XPSource.ADMIN_AWARD else None,
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
    response_model=StreakUpdateRead,
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
    return {
        "profile": profile_result.value,
        "streak_updated": result.value.get("streak_updated", False),
        "message": result.value.get("message"),
    }


@router.post(
    "/learning-streak/{org_id}",
    summary="Update learning streak",
    response_description="Updated learning streak status (idempotent per day)",
    response_model=StreakUpdateRead,
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
    return {
        "profile": profile_result.value,
        "streak_updated": result.value.get("streak_updated", False),
        "message": result.value.get("message"),
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
    response_model=DashboardRead,
)
async def get_dashboard(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
    request: Request,
    response: Response,
):
    """Get gamification dashboard data."""
    result = await get_gamification_dashboard_result(
        user_id=user.id,
        org_id=org_id,
        db_session=services.xp.db_session,
    )
    raise_for_result(result)
    payload = result.value  # DashboardRead
    # Compute a simple recent_tx hash for ETag
    try:
        txs = payload.recent_tx
        recent_tx_hash = "|".join(
            f"{t.transaction_id}@{t.created_at.isoformat()}@{t.amount}" for t in txs
        )
        etag = make_dashboard_etag(
            profile_id=(payload.profile.org_id << 32) ^ payload.profile.user_id,
            updated_at=payload.profile.updated_at,
            total_xp=payload.profile.total_xp,
            recent_tx_hash=recent_tx_hash,
        )
        inm = request.headers.get("If-None-Match")
        quoted = f'"d-{etag}"'
        if inm and inm.strip() == quoted:
            raise HTTPException(status_code=status.HTTP_304_NOT_MODIFIED)
        response.headers["ETag"] = quoted
        response.headers["Cache-Control"] = "private, max-age=0, must-revalidate"
    except Exception:  # pragma: no cover - optional feature
        pass
    return payload


@router.get(
    "/streaks/summary/{org_id}",
    summary="Get streak summary",
    response_model=StreakSummaryRead,
)
async def streak_summary(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    result = await services.streaks.get_streak_summary(user.id, org_id)
    raise_for_result(result)
    # Map service dict -> typed response model
    v = result.value

    def _parse_dt(val):
        if val is None:
            return None
        if isinstance(val, datetime):
            return val
        if isinstance(val, str):
            try:
                return datetime.fromisoformat(val)
            except Exception:
                try:
                    return datetime.fromisoformat(val.replace("Z", "+00:00"))
                except Exception:
                    return None
        return None

    login = dict(v.get("login_streak", {}))
    learning = dict(v.get("learning_streak", {}))
    if "last_activity" in login:
        login["last_activity"] = _parse_dt(login["last_activity"])
    if "last_activity" in learning:
        learning["last_activity"] = _parse_dt(learning["last_activity"])

    return {
        "login_streak": login,
        "learning_streak": learning,
        "milestones": v["milestones"],
        "grace_period_hours": v["grace_period_hours"],
        "recent_records": [
            {
                "streak_type": r.get("streak_type"),
                "streak_count": r.get("streak_count", 0),
                "is_milestone": r.get("is_milestone", False),
                "activities_completed": r.get("activities_completed", 0),
                "xp_earned_today": r.get("xp_earned_today", 0),
                "date": _parse_dt(r.get("date")),
                "metadata": r.get("metadata") or None,
            }
            for r in v.get("recent_records", [])
        ],
    }


@router.get(
    "/leaderboard/{org_id}",
    response_model=LeaderboardRead,
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
            "entries": [
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
    if not get_gamification_config().enable_achievements:
        raise HTTPException(status_code=404, detail="Achievements feature is disabled")
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
    if not get_gamification_config().enable_achievements:
        raise HTTPException(status_code=404, detail="Achievements feature is disabled")
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
    if not get_gamification_config().enable_achievements:
        raise HTTPException(status_code=404, detail="Achievements feature is disabled")
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
