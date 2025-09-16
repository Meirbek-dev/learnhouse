"""
Essential functions needed by the router (thin orchestration only).

Delegates profile lifecycle to XPService to avoid duplication and drift.
All time handling uses UTC to ensure deterministic server-day semantics.
"""

import logging
from datetime import UTC, datetime
from typing import Any, Dict, List
from uuid import UUID

from fastapi import HTTPException, status
from sqlmodel import Session, select

# UTC-first semantics; avoid local time utilities here
from src.db.gamification import (
    OrganizationLeaderboard,
    ProfileRead,
    DashboardRead,
    RecentTransactionRead,
    UserGamificationPreferenceRead,
    UserGamificationPreferenceUpsert,
    UserGamificationProfile,
    XPTransaction,
)
from src.db.users import User

from .cache_service import create_cache_service
from .level_calculator import calculate_level_details
from .result import Result
from .config import get_gamification_config

logger = logging.getLogger(__name__)


# ------------------------------------------------------------
# Small mappers to public API contracts (ProfileRead/DashboardRead)
# ------------------------------------------------------------


def _map_profile_read(profile: UserGamificationProfile) -> ProfileRead:
    """Build ProfileRead from the SQLModel entity using UTC semantics."""
    lvl = calculate_level_details(profile.total_xp or 0)
    return ProfileRead(
        user_id=profile.user_id,
        org_id=profile.org_id,
        total_xp=profile.total_xp or 0,
        current_level=int(lvl["level"]),
        xp_in_level=int(lvl["xp_in_level"]),
        xp_to_next=int(lvl["xp_to_next"]),
        progress=float(lvl["progress"]),
        updated_at=profile.updated_at,
        streaks={
            "login": int(profile.current_login_streak or 0),
            "learning": int(profile.current_learning_streak or 0),
        },
    )


def _map_dashboard_read(
    profile: UserGamificationProfile, recent_transactions: List[XPTransaction]
) -> DashboardRead:
    tx_models: list[RecentTransactionRead] = []
    for tx in recent_transactions:
        src_val = tx.source.value if hasattr(tx.source, "value") else str(tx.source)
        tx_models.append(
            RecentTransactionRead(
                transaction_id=tx.id,
                amount=tx.xp_amount,
                source=src_val,
                source_id=tx.source_id,
                created_at=tx.created_at,
                metadata=tx.transaction_metadata or None,
            )
        )
    return DashboardRead(
        profile=_map_profile_read(profile),
        recent_tx=tx_models,
        preferences=profile.preferences or None,
    )


async def get_or_create_profile(
    user_id: int, org_id: int, db_session: Session
) -> UserGamificationProfile:
    """Get or create user gamification profile (cached)."""
    cache = create_cache_service()
    try:
        cached = cache.get_profile(user_id, org_id)
        if cached:
            if isinstance(cached, dict):
                # Invalidate the corrupted cache entry
                cache.delete(f"profile:{org_id}:{user_id}")
            else:
                return cached
        # Delegate to XPService for single source of truth
        from .xp_service import create_xp_service

        xp = create_xp_service(db_session)
        profile = await xp._get_or_create_profile(user_id, org_id)
        cache.set_profile(user_id, org_id, profile)
        return profile
    except Exception as e:
        logger.exception(
            "Error getting/creating profile user=%s org=%s: %s", user_id, org_id, e
        )
        db_session.rollback()
        # Let caller decide how to surface; propagate exception
        raise


async def get_gamification_dashboard_result(
    user_id: int, org_id: int, db_session: Session
) -> Result[DashboardRead]:
    """Get gamification dashboard data (typed)."""
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

        dashboard = _map_dashboard_read(profile, recent_transactions)
        return Result.success(dashboard)
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
) -> Result[ProfileRead]:
    """Get a user's gamification profile as ProfileRead (typed)."""
    try:
        profile = await get_or_create_profile(user_id, org_id, db_session)

        # Auto-correct stale streaks on read to reflect reality even without explicit update calls
        try:
            cfg = get_gamification_config()
            now = datetime.now(UTC)

            def _normalize(dt: datetime) -> datetime:
                tz = now.tzinfo
                if dt.tzinfo is None and tz is not None:
                    return dt.replace(tzinfo=tz)
                if tz is not None and dt.tzinfo != tz:
                    return dt.astimezone(tz)
                return dt

            changed = False

            # Check login streak
            if (
                profile.last_login_date is not None
                and profile.last_login_date.date() != now.date()
            ):
                last = _normalize(profile.last_login_date)
                elapsed_hours = max((now - last).total_seconds() / 3600.0, 0.0)
                if elapsed_hours > 24.0 + float(cfg.streaks.grace_period_hours):
                    if profile.current_login_streak != 0:
                        profile.current_login_streak = 0
                        changed = True

            # Check learning streak
            if (
                profile.last_learning_activity_date is not None
                and profile.last_learning_activity_date.date() != now.date()
            ):
                last = _normalize(profile.last_learning_activity_date)
                elapsed_hours = max((now - last).total_seconds() / 3600.0, 0.0)
                if elapsed_hours > 24.0 + float(cfg.streaks.grace_period_hours):
                    if profile.current_learning_streak != 0:
                        profile.current_learning_streak = 0
                        changed = True

            if changed:
                profile.updated_at = now
                db_session.add(profile)
                try:
                    db_session.commit()
                    # best-effort cache refresh
                    try:
                        cache = create_cache_service()
                        cache.set_profile(user_id, org_id, profile)
                    except Exception:
                        logger.debug(
                            "profile cache refresh failed after streak autocorrect",
                            exc_info=True,
                        )
                except Exception:
                    db_session.rollback()
                    logger.debug(
                        "streak autocorrect commit failed; continuing with stale values",
                        exc_info=True,
                    )
        except Exception:
            # Non-fatal; continue with existing values
            logger.debug("streak autocorrect check failed", exc_info=True)
        payload = _map_profile_read(profile)
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
    profile.updated_at = datetime.now(UTC)

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
