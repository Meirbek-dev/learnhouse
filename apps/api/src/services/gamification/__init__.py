"""
Gamification Services

Server-authoritative gamification system with enhanced features including:
- XP and leveling systems with atomic transactions
- Streak tracking with milestone bonuses
- Achievement system with progress tracking
- Leaderboards with multiple ranking types
- Real-time caching and analytics
"""

from .gamification import (
    GamificationConfig,
    award_xp,
    get_gamification_dashboard,
    get_or_create_profile,
    get_organization_leaderboard,
    update_learning_streak,
    update_login_streak,
)

__all__ = [
    "GamificationConfig",
    "award_xp",
    "get_gamification_dashboard",
    "get_or_create_profile",
    "get_organization_leaderboard",
    "update_learning_streak",
    "update_login_streak",
]
