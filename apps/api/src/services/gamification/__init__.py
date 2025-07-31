"""
Gamification Services

This module contains all gamification-related business logic including:
- XP and leveling systems
- Streak tracking
- Achievement and badge systems (future)
- Leaderboards and competitions
"""

from .gamification import (
    XP_REWARDS,
    award_xp,
    calculate_level_from_xp,
    get_gamification_dashboard,
    get_or_create_gamification_profile,
    get_organization_leaderboard,
    is_consecutive_day,
    is_same_day,
    update_learning_streak,
    update_login_streak,
)

__all__ = [
    "XP_REWARDS",
    "award_xp",
    "calculate_level_from_xp",
    "get_gamification_dashboard",
    "get_or_create_gamification_profile",
    "get_organization_leaderboard",
    "is_consecutive_day",
    "is_same_day",
    "update_learning_streak",
    "update_login_streak",
]
