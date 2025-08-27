"""
Gamification Services

Server-authoritative gamification system with enhanced features including:
- XP and leveling systems with atomic transactions
- Streak tracking with milestone bonuses
- Achievement system with progress tracking
- Leaderboards with multiple ranking types
- Real-time caching and analytics

New Architecture:
- XPService: Focused XP awarding and management
- StreakService: Streak tracking and milestone bonuses
- LevelCalculator: Fast O(1) mathematical level calculations
- EventHandlers: Clean event-driven architecture
- Config: Flexible configuration system
"""

# Public service factories / utilities
from src.db.gamification import XPSource

from .config import get_gamification_config
from .level_calculator import calculate_level_details, get_level_metadata
from .streak_service import StreakService, create_streak_service
from .xp_service import XPService, create_xp_service

__all__ = [
    "StreakService",
    # New services
    "XPService",
    "XPSource",
    "calculate_level_details",
    "create_streak_service",
    "create_xp_service",
    "get_gamification_config",
    "get_level_metadata",
]
