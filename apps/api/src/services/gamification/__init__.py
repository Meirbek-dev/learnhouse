"""
Gamification Services

Clean, focused implementation:
- XP and leveling with atomic transactions
- Streak tracking (UTC-only semantics)
- Simple leaderboard (top by XP)
- Single source of truth in service.py

Core implementation:
- Database models: src.db.gamification (GamificationProfile, XPTransaction)
- Service logic: src.services.gamification.service
- API router: src.routers.gamification
- API schemas: src.schemas.gamification

This package exports shared enums and schemas for external modules.
"""

# Expose enums and typed schemas for external modules
from src.db.gamification import StreakType, XPSource
from src.schemas.gamification import (
    DashboardRead,
    LeaderboardRead,
    ProfileRead,
    StreakUpdateRead,
    XPAwardRequest,
    XPAwardResponse,
)

__all__ = [
    "DashboardRead",
    "LeaderboardRead",
    "ProfileRead",
    "StreakType",
    "StreakUpdateRead",
    "XPAwardRequest",
    "XPAwardResponse",
    "XPSource",
]
