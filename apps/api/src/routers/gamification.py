"""Gamification API Router."""

import hashlib
import logging
from datetime import datetime
from typing import Annotated, Any, Never

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status

from src.db.gamification import (
    UserGamificationPreferenceRead,
    UserGamificationPreferenceUpsert,
    XPSource,
)
from src.db.users import PublicUser
from src.routers.admin import is_user_admin_of_org
from src.schemas.gamification import (
    DashboardRead,
    LeaderboardEntryRead,
    LeaderboardRead,
    ProfileRead,
    StreakSummaryRead,
    StreakUpdateRead,
)
from src.security.auth import get_current_user
from src.services.gamification import (
    get_gamification_config,
)
from src.services.gamification.etag import (
    make_dashboard_etag,
    make_profile_etag,
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

logger = logging.getLogger(__name__)

router = APIRouter()

# ----------------------------------------------------------------------------
# Shared helpers: Result -> HTTPException mapping
# ----------------------------------------------------------------------------

ERROR_STATUS_MAP = {
    "invalid_amount": (400, "XP amount must be positive"),
    "daily_cap": (429, "Daily XP cap reached"),
    "integrity_error": (409, "Duplicate XP transaction"),
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


def _recent_tx_hash(d: DashboardRead) -> str:
    if not d.recent_tx:
        return ""
    base = "|".join(
        f"{t.transaction_id}:{t.created_at.isoformat()}" for t in d.recent_tx
    ).encode()
    return hashlib.sha256(base).hexdigest()[:16]


# NOTE: We deliberately avoid a decorator to keep endpoint flow explicit


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

    # ETag support
    try:
        etag = make_profile_etag(user.id, payload.updated_at, payload.total_xp)
        if request.headers.get("If-None-Match") == etag:
            # Return explicit Response to avoid Pydantic validation on None
            return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})
        response.headers["ETag"] = etag
    except Exception:  # pragma: no cover
        logger.debug("ETag generation failed for profile", exc_info=True)

    return payload


@router.post(
    "/award-xp/{org_id}",
    summary="Award XP",
    response_description="XP award transaction + updated profile snapshot",
)
async def award_xp_endpoint(
    org_id: int,
    source: XPSource,
    source_id: Annotated[str, Query(min_length=1, max_length=255)],
    request: Request,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
    metadata: dict[str, Any] | None = None,
    custom_amount: int | None = None,
):
    """Award XP to user (idempotent via X-Idempotency-Key header).

    Rules:
    - ADMIN_AWARD requires org admin and X-Idempotency-Key header.
    - custom_amount is only honored for ADMIN_AWARD; ignored otherwise.
    - source_id is used for semantic idempotency.
    """
    try:
        idempotency_key = request.headers.get("X-Idempotency-Key")
        is_admin_award = source == XPSource.ADMIN_AWARD

        if is_admin_award:
            if not idempotency_key:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Idempotency key required for ADMIN_AWARD",
                )
            is_admin = await is_user_admin_of_org(
                user_id=user.id, org_id=org_id, session=services.xp.db_session
            )
            if not is_admin:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden"
                )

        # Only allow custom_amount for ADMIN_AWARD
        effective_custom = custom_amount if is_admin_award else None

        xp = services.xp
        result = await xp.award_xp(
            user_id=user.id,
            org_id=org_id,
            source=source,
            source_id=source_id.strip(),
            metadata=metadata or {},
            custom_amount=effective_custom,
            idempotency_key=idempotency_key,
            admin_user_id=user.id if is_admin_award else None,
        )
        raise_for_result(result)
        # Wrap in { success, data } to match existing consumers/tests
        return {"success": True, "data": result.value}
    except HTTPException:
        raise
    except Exception as e:  # pragma: no cover
        logger.exception("award_xp failed: %s", e)
        raise HTTPException(status_code=500, detail="Internal error")


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

    data = result.value or {}
    return StreakUpdateRead(
        profile=profile_result.value,
        streak_updated=bool(data.get("streak_updated", True)),
        message=data.get("message"),
    )


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
    result = await services.streaks.update_learning_streak(user.id, org_id)
    raise_for_result(result)

    profile_result = await get_gamification_profile_result(
        user_id=user.id, org_id=org_id, db_session=services.xp.db_session
    )
    raise_for_result(profile_result)

    data = result.value or {}
    return StreakUpdateRead(
        profile=profile_result.value,
        streak_updated=bool(data.get("streak_updated", True)),
        message=data.get("message"),
    )


# Removed internal "events/*" endpoints to keep API surface minimal.


@router.get(
    "/config",
    summary="Public gamification config",
    response_description="Safe subset of gamification configuration",
)
async def get_config():
    cfg = get_gamification_config()
    # Safe/public subset only
    return {
        "levels": {
            "base_xp": cfg.levels.base_xp,
            "multiplier": cfg.levels.multiplier,
            "max_level": cfg.levels.max_level,
        },
        "daily_caps": {
            "max_daily_xp": cfg.daily_caps.max_daily_xp,
            "default_daily_goal": cfg.daily_caps.default_daily_goal,
        },
        "streaks": {
            "milestones": list(cfg.streaks.milestones),
            "milestone_bonuses": cfg.streaks.milestone_bonuses,
            "grace_period_hours": cfg.streaks.grace_period_hours,
        },
        "features": {
            "enable_streaks": cfg.enable_streaks,
            "enable_leaderboards": cfg.enable_leaderboards,
            "enable_achievements": cfg.enable_achievements,
            "enable_daily_goals": cfg.enable_daily_goals,
        },
    }


@router.get(
    "/xp-sources",
    summary="List XP sources",
    response_description="Metadata for all XP sources (label, description, default XP)",
)
async def get_xp_sources(
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    # No server-side cache needed; list is small and static enough
    return list_xp_sources()


@router.get("/preferences/{org_id}", response_model=UserGamificationPreferenceRead)
async def get_preferences(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
):
    result = await get_gamification_preferences_result(
        user_id=user.id, org_id=org_id, db_session=services.xp.db_session
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
    result = await get_gamification_dashboard_result(
        user_id=user.id, org_id=org_id, db_session=services.xp.db_session
    )
    raise_for_result(result)
    payload = result.value  # DashboardRead

    try:
        tx_hash = _recent_tx_hash(payload)
        etag = make_dashboard_etag(
            user.id, payload.profile.updated_at, payload.profile.total_xp, tx_hash
        )
        if request.headers.get("If-None-Match") == etag:
            return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag})
        response.headers["ETag"] = etag
    except Exception:  # pragma: no cover
        logger.debug("ETag generation failed for dashboard", exc_info=True)

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
    return result.value


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
    lb = await services.leaderboard.get_top_xp(
        org_id=org_id, limit=limit, current_user_id=user.id
    )
    raise_for_result(lb)
    data = lb.value
    return LeaderboardRead(
        org_id=data.org_id,
        entries=[
            LeaderboardEntryRead(
                rank=e.rank,
                user_id=e.user_id,
                username=e.username,
                total_xp=e.total_xp,
                current_level=e.current_level,
                is_current_user=e.is_current_user,
            )
            for e in data.entries
        ],
        total_participants=data.total_participants,
        last_updated=data.last_updated,
        current_user_rank=data.current_user_rank,
    )


# ---------------------------------------------------------------------------
# Achievement & Badge Endpoints (not enabled in core build)
# ---------------------------------------------------------------------------


@router.get(
    "/achievements/{org_id}",
    summary="List achievements & progress",
    response_model=None,
)
async def list_achievements(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
) -> None:
    raise HTTPException(status_code=501, detail="Achievements are disabled")


@router.post(
    "/achievements/check/{org_id}",
    summary="Check & unlock achievements",
    response_model=None,
)
async def check_achievements(
    org_id: int,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
) -> None:
    raise HTTPException(status_code=501, detail="Achievements are disabled")


@router.post(
    "/badges/{org_id}/{badge_key}",
    summary="Award badge manually (admin)",
    response_model=None,
)
async def award_badge(
    org_id: int,
    badge_key: str,
    user: Annotated[PublicUser, Depends(get_current_user)],
    services: Annotated[GamificationServices, Depends(get_gamification_services)],
) -> None:
    raise HTTPException(status_code=501, detail="Badges are disabled")
