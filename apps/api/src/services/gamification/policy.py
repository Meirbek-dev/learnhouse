"""Policy repository and TTL cache for gamification org overrides.

Provides:
- get_org_policy(db, org_id) -> (rewards: dict[str,int], daily_limit: int)
- invalidate_org_policy(org_id)

Default cache is in-process with a short TTL. Can be swapped to Redis later.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Dict, Tuple

from sqlmodel import Session, select

from src.db.gamification import DAILY_XP_LIMIT, XP_REWARDS, OrgGamificationConfig

# In-process TTL cache: org_id -> (rewards, daily_limit, cached_at)
_CACHE: dict[int, tuple[dict[str, int], int, datetime]] = {}
_TTL = timedelta(minutes=5)


def invalidate_org_policy(org_id: int | None = None) -> None:
    if org_id is None:
        _CACHE.clear()
        return
    _CACHE.pop(int(org_id), None)


def get_org_policy(db: Session, org_id: int) -> tuple[dict[str, int], int]:
    now = datetime.now(UTC)
    cached = _CACHE.get(org_id)
    if cached and now - cached[2] < _TTL:
        return cached[0], cached[1]

    cfg = db.exec(
        select(OrgGamificationConfig).where(OrgGamificationConfig.org_id == org_id)
    ).first()

    rewards: dict[str, int] = dict(XP_REWARDS)
    daily_limit: int = DAILY_XP_LIMIT
    if cfg:
        if isinstance(cfg.rewards, dict):
            for k, v in cfg.rewards.items():
                try:
                    rewards[k] = int(v)  # type: ignore[arg-type]
                except Exception:
                    continue
        if cfg.daily_xp_limit is not None and cfg.daily_xp_limit >= 0:
            daily_limit = int(cfg.daily_xp_limit)

    _CACHE[org_id] = (rewards, daily_limit, now)
    return rewards, daily_limit
