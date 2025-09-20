"""
Simple Gamification Services

Clean, focused implementation with:
- XP and leveling with atomic transactions
- Streak tracking (UTC-only semantics)
- Simple leaderboard (top by XP)
- No over-engineering or unused abstractions

All functionality is provided by simple_service and exposed via routers. This package exports
shared enums, schemas and config helpers only.
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
