"""Minimal Leaderboard Service

Trimmed to essential XP leaderboard only to avoid unfinished complexity.
Extensible later; keeps API surface tiny and predictable.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import List, Optional

from sqlmodel import Session, select

from src.db.gamification import UserGamificationProfile
from src.db.users import User

from .result import Result

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class LeaderboardEntry:
    user_id: int
    total_xp: int
    current_level: int
    rank: int
    username: str | None = None
    is_current_user: bool = False


@dataclass(slots=True)
class LeaderboardResult:
    org_id: int
    entries: list[LeaderboardEntry]
    total_participants: int
    last_updated: datetime
    current_user_rank: int | None = None


class LeaderboardService:
    """Very small service: returns top N by total_xp.

    Future enhancements (period filters, multi-metric) can bolt on
    without breaking this minimal contract.
    """

    def __init__(self, db_session: Session, cache=None) -> None:
        self.db_session = db_session
        self.cache = cache  # expected simple get/set with ttl(key,value,ttl?) semantics
        self._TTL = 30  # seconds

    async def get_top_xp(
        self, org_id: int, limit: int = 20, current_user_id: int | None = None
    ) -> Result[LeaderboardResult]:
        # Index note: Postgres benefits from idx_profile_org_xp and idx_profile_org_xp_desc
        # when ordering by total_xp DESC. SQLite ignores DESC ops in indexes, but since we
        # limit to small N (<=100) this remains efficient enough for MVP.
        try:
            cache_key = f"lb:xp:{org_id}:{limit}"
            if self.cache:
                cached = self.cache.get(cache_key)
                if cached:
                    entries = [LeaderboardEntry(**e) for e in cached["entries"]]
                    result = LeaderboardResult(
                        org_id=org_id,
                        entries=entries,
                        total_participants=cached["total_participants"],
                        last_updated=datetime.fromisoformat(cached["last_updated"]),
                        current_user_rank=cached.get("current_user_rank"),
                    )
                    if current_user_id:
                        for e in result.entries:
                            e.is_current_user = e.user_id == current_user_id
                    return Result.success(result)

            stmt = (
                select(UserGamificationProfile, User.username)
                .join(User, User.id == UserGamificationProfile.user_id)
                .where(
                    UserGamificationProfile.org_id == org_id,
                    UserGamificationProfile.is_active,
                )
                .order_by(UserGamificationProfile.total_xp.desc())
                .limit(limit)
            )
            rows = list(self.db_session.exec(stmt).all())
            entries: list[LeaderboardEntry] = []
            for idx, (p, username) in enumerate(rows, start=1):
                entries.append(
                    LeaderboardEntry(
                        user_id=p.user_id,
                        total_xp=p.total_xp,
                        current_level=p.current_level,
                        rank=idx,
                        username=username,
                        is_current_user=(p.user_id == current_user_id)
                        if current_user_id
                        else False,
                    )
                )

            # Compute user rank if not in top list
            current_user_rank: int | None = None
            if current_user_id and all(e.user_id != current_user_id for e in entries):
                rank_stmt = (
                    select(
                        UserGamificationProfile.total_xp,
                        UserGamificationProfile.user_id,
                    )
                    .where(
                        UserGamificationProfile.org_id == org_id,
                        UserGamificationProfile.is_active,
                    )
                    .order_by(UserGamificationProfile.total_xp.desc())
                )
                rank_rows = list(self.db_session.exec(rank_stmt).all())
                user_xp = next(
                    (xp for xp, uid in rank_rows if uid == current_user_id), None
                )
                if user_xp is not None:
                    for i, (_xp, uid) in enumerate(rank_rows, start=1):
                        if uid == current_user_id:
                            current_user_rank = i
                            break

            result = LeaderboardResult(
                org_id=org_id,
                entries=entries,
                total_participants=len(entries),  # minimal for now
                last_updated=datetime.now(UTC),
                current_user_rank=current_user_rank,
            )

            if self.cache:
                try:
                    self.cache.set(
                        cache_key,
                        {
                            "entries": [e.__dict__ for e in entries],
                            "total_participants": result.total_participants,
                            "last_updated": result.last_updated.isoformat(),
                            "current_user_rank": result.current_user_rank,
                        },
                        ttl=self._TTL,
                    )
                except Exception:  # pragma: no cover
                    logger.debug("Leaderboard cache set failed", exc_info=True)

            return Result.success(result)
        except Exception as e:  # pragma: no cover - defensive
            logger.exception("Failed to build leaderboard: %s", e)
            return Result.fail("Failed to build leaderboard", code="leaderboard_error")


def create_leaderboard_service(
    db_session: Session, cache_client=None
) -> LeaderboardService:
    return LeaderboardService(db_session, cache_client)
