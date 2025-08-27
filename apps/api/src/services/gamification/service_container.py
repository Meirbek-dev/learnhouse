"""Lightweight gamification service container / dependency wiring.

Centralizes construction so FastAPI dependencies (and tests) can inject a coherent
set of collaborating services without hidden singletons.

Usage (router example):
    from fastapi import Depends
    from .service_container import get_gamification_services, GamificationServices

    @router.get("/profile/{org_id}")
    async def profile(org_id: int, services: GamificationServices = Depends(get_gamification_services), user=Depends(get_current_user)):
        return await services.xp.get_user_xp_summary(user.id, org_id)

Keeps surface minimal while allowing future extension (achievements, notifications).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session

from .achievement_service import AchievementService, create_achievement_service
from .cache_service import CacheService, create_cache_service
from .event_bus import EventBus, create_event_bus
from .leaderboard_service import LeaderboardService, create_leaderboard_service
from .streak_service import StreakService, create_streak_service
from .xp_service import XPService, create_xp_service


@dataclass(slots=True)
class GamificationServices:
    xp: XPService
    streaks: StreakService
    achievements: AchievementService
    leaderboard: LeaderboardService
    cache: CacheService
    events: EventBus | None = None


def build_services(
    db_session: Session, *, event_bus: EventBus | None = None
) -> GamificationServices:
    cache = create_cache_service()
    bus = event_bus or create_event_bus()
    xp_service = create_xp_service(db_session, bus)
    streak_service = create_streak_service(db_session)
    achievement_service = create_achievement_service(db_session, bus)
    leaderboard_service = create_leaderboard_service(db_session, cache)
    return GamificationServices(
        xp=xp_service,
        streaks=streak_service,
        achievements=achievement_service,
        leaderboard=leaderboard_service,
        cache=cache,
        events=bus,
    )


# FastAPI dependency factory (defined here to decouple from framework in core services)
try:  # pragma: no cover - only executed when FastAPI imported
    from fastapi import Depends

    from src.core.events.database import get_db_session

    def get_gamification_services(
        db: Session = Depends(get_db_session),
    ) -> GamificationServices:  # type: ignore
        return build_services(db)
except (
    Exception
):  # pragma: no cover - allow import without FastAPI in pure domain tests

    def get_gamification_services(db: Session) -> GamificationServices:  # type: ignore
        return build_services(db)
