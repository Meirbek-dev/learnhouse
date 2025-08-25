"""
Shared Gamification Constants

This module centralizes all gamification-related constants to prevent drift
between frontend and backend implementations. These values should be the
single source of truth for XP calculations, level progression, and rewards.
"""

# XP Reward Structure - Easily configurable for game balance
XP_REWARDS = {
    # Daily Activities
    "login_daily": 10,
    "first_login": 25,
    # Learning Activities
    "activity_completion": 25,
    "course_completion": 100,
    "first_activity": 25,  # Bonus for first activity ever
    "perfect_score": 25,  # Bonus for 100% on assignments
    # Streak Bonuses
    "streak_bonus_7_days": 50,
    "streak_bonus_30_days": 200,
    "streak_bonus_100_days": 1000,
    # Special Achievements (future expansion)
    "social_sharing": 15,
    "course_review": 20,
    "helping_others": 30,
}

# Level Calculation Constants
BASE_XP_PER_LEVEL = 100
XP_MULTIPLIER_PER_LEVEL = 1.2

# Level Thresholds for Special Unlocks
LEVEL_UNLOCKS = {
    1: ["basicProfile"],
    5: ["avatarFrames"],
    10: ["customAvatarHat"],
    15: ["avatarAccessories"],
    20: ["specialAnimations"],
    25: ["exclusiveThemes"],
    30: ["advancedStats"],
    40: ["mentorBadge"],
    50: ["legendaryStatus"],
}

# Streak Milestones for Bonuses
STREAK_MILESTONES = [7, 30, 100]

# Avatar Customization Unlocks
AVATAR_UNLOCKS = {
    "frames": [
        {"id": "bronze", "level": 5, "name": "Bronze Frame"},
        {"id": "silver", "level": 10, "name": "Silver Frame"},
        {"id": "gold", "level": 15, "name": "Gold Frame"},
        {"id": "platinum", "level": 25, "name": "Platinum Frame"},
        {"id": "diamond", "level": 40, "name": "Diamond Frame"},
        {"id": "legendary", "level": 50, "name": "Legendary Frame"},
    ],
    "accessories": [
        {"id": "hat_scholar", "level": 10, "name": "Scholar Hat"},
        {"id": "hat_graduation", "level": 15, "name": "Graduation Cap"},
        {"id": "badge_expert", "level": 20, "name": "Expert Badge"},
        {"id": "crown_master", "level": 25, "name": "Master Crown"},
        {"id": "aura_legendary", "level": 50, "name": "Legendary Aura"},
    ],
}

# Level Display Configuration
LEVEL_CONFIG = {
    1: {"title": "novice", "color": "text-gray-500", "minXP": 0},
    5: {"title": "apprentice", "color": "text-blue-500", "minXP": 1000},
    10: {"title": "scholar", "color": "text-purple-500", "minXP": 3000},
    15: {"title": "expert", "color": "text-green-500", "minXP": 6000},
    20: {"title": "specialist", "color": "text-yellow-500", "minXP": 10000},
    25: {"title": "master", "color": "text-orange-500", "minXP": 12000},
    30: {"title": "grandmaster", "color": "text-red-500", "minXP": 18000},
    40: {"title": "mentor", "color": "text-pink-500", "minXP": 30000},
    50: {"title": "legend", "color": "text-purple-600", "minXP": 50000},
}

# Time-based Constants
STREAK_GRACE_HOURS = 6  # Hours past midnight to still count as "same day"
MAX_DAILY_XP = 500  # Cap to prevent gaming the system
XP_DECAY_DAYS = 365  # Days before XP starts decaying (future feature)

# Notification Settings
NOTIFICATION_TRIGGERS = {
    "level_up": True,
    "streak_milestone": True,
    "course_completion": True,
    "achievement_unlock": True,
}


def calculate_level_from_xp(total_xp: int) -> tuple[int, int]:
    """
    Centralized level calculation logic.

    Args:
        total_xp: Total XP accumulated by user

    Returns:
        tuple: (current_level, xp_to_next_level)
    """
    if total_xp <= 0:
        return 1, BASE_XP_PER_LEVEL

    level = 1
    cumulative_xp = 0

    while level < 10000:  # Safety cap
        xp_for_level = int(BASE_XP_PER_LEVEL * (XP_MULTIPLIER_PER_LEVEL ** (level - 1)))

        if cumulative_xp + xp_for_level > total_xp:
            xp_to_next = cumulative_xp + xp_for_level - total_xp
            return level, xp_to_next

        cumulative_xp += xp_for_level
        level += 1

    return level, 0


def get_level_info(level: int) -> dict:
    """
    Get level configuration info.

    Args:
        level: User's current level

    Returns:
        dict: Level configuration with title, color, etc.
    """
    # Find the highest matching level config
    level_info = {"title": "novice", "color": "text-gray-500", "minXP": 0}

    for config_level, info in sorted(LEVEL_CONFIG.items()):
        if level >= config_level:
            level_info = info.copy()
        else:
            break

    return level_info


def get_unlocks_for_level(level: int) -> list[str]:
    """
    Get all unlocks available at or below the specified level.

    Args:
        level: User's current level

    Returns:
        list: List of unlock IDs
    """
    unlocks = []
    for unlock_level, items in LEVEL_UNLOCKS.items():
        if level >= unlock_level:
            unlocks.extend(items)
    return unlocks
