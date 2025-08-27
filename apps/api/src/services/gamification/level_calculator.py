"""
Level Calculator - O(1) mathematical level calculations

Optimized level calculation using geometric progression formulas
instead of iterative O(n) calculations.
"""

import math
from typing import Any, Dict, List, Optional

from .config import get_gamification_config


def calculate_level_details(total_xp: int) -> dict[str, Any]:
    """
    Calculate user level details with O(1) mathematical approach.

    Returns:
        - level: Current level (1-based)
        - xp_in_level: XP progress within current level
        - xp_to_next: XP needed to reach next level
        - progress: Progress percentage (0.0-1.0)
    """
    config = get_gamification_config()
    base_xp = config.levels.base_xp
    multiplier = config.levels.multiplier
    max_level = config.levels.max_level

    if total_xp < base_xp:
        return {
            "level": 1,
            "xp_in_level": total_xp,
            "xp_to_next": base_xp - total_xp,
            "progress": total_xp / base_xp,
        }

    # Calculate level using geometric progression formula
    # total_xp = base_xp * (multiplier^level - 1) / (multiplier - 1)
    # Solving for level: level = log(total_xp * (multiplier - 1) / base_xp + 1) / log(multiplier)

    if abs(multiplier - 1.0) < 1e-10:  # Handle multiplier ≈ 1
        level = min(int(total_xp // base_xp) + 1, max_level)
    else:
        level_float = math.log(total_xp * (multiplier - 1) / base_xp + 1) / math.log(
            multiplier
        )
        level = min(int(level_float) + 1, max_level)

    # Calculate XP boundaries for current level
    if level == 1:
        level_start_xp = 0
        level_end_xp = base_xp
    elif abs(multiplier - 1.0) < 1e-10:
        level_start_xp = base_xp * (level - 1)
        level_end_xp = base_xp * level
    else:
        level_start_xp = int(
            base_xp * (multiplier ** (level - 1) - 1) / (multiplier - 1)
        )
        if level < max_level:
            level_end_xp = int(base_xp * (multiplier**level - 1) / (multiplier - 1))
        else:
            level_end_xp = level_start_xp + int(base_xp * multiplier ** (level - 1))

    # Handle max level case
    if level >= max_level:
        return {
            "level": max_level,
            "xp_in_level": total_xp - level_start_xp,
            "xp_to_next": 0,  # No next level
            "progress": 1.0,
        }

    xp_in_level = total_xp - level_start_xp
    xp_to_next = level_end_xp - total_xp
    progress = xp_in_level / (level_end_xp - level_start_xp)

    return {
        "level": level,
        "xp_in_level": xp_in_level,
        "xp_to_next": xp_to_next,
        "progress": progress,
    }


def get_xp_required_for_level(target_level: int) -> int:
    """Calculate total XP required to reach a specific level."""
    config = get_gamification_config()
    base_xp = config.levels.base_xp
    multiplier = config.levels.multiplier
    max_level = config.levels.max_level

    target_level = min(target_level, max_level)

    if target_level <= 1:
        return 0

    if abs(multiplier - 1.0) < 1e-10:
        return base_xp * (target_level - 1)
    return int(base_xp * (multiplier ** (target_level - 1) - 1) / (multiplier - 1))


def get_level_metadata() -> dict[str, Any]:
    """Get level system metadata."""
    config = get_gamification_config()

    return {
        "base_xp": config.levels.base_xp,
        "multiplier": config.levels.multiplier,
        "max_level": config.levels.max_level,
        "level_1_xp": config.levels.base_xp,
        "max_level_total_xp": get_xp_required_for_level(config.levels.max_level),
    }
