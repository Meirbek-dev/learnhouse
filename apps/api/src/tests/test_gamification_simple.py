"""
Simplified Tests for Gamification Service

Tests isolated functions without database dependencies.
"""
import pytest
from src.services.gamification.gamification import (
    calculate_level_from_xp,
    is_consecutive_day,
    is_same_day,
)
from src.shared.gamification_constants import BASE_XP_PER_LEVEL, XP_REWARDS
from datetime import datetime, timezone


class TestLevelCalculation:
    """Test level calculation logic"""

    def test_level_calculation_edge_cases(self):
        """Test level calculation for edge cases"""

        # Test zero XP
        level, xp_to_next = calculate_level_from_xp(0)
        assert level == 1
        assert xp_to_next == 100  # BASE_XP_PER_LEVEL

        # Test negative XP raises error
        with pytest.raises(ValueError):
            calculate_level_from_xp(-1)

        # Test level 2 threshold (100 XP gets you to level 2)
        level, xp_to_next = calculate_level_from_xp(100)
        assert level == 2
        assert xp_to_next == 120  # Need 120 more XP for level 3

        # Test mid-level XP (150 XP is 50 into level 2)
        level, xp_to_next = calculate_level_from_xp(150)
        assert level == 2
        assert xp_to_next == 70  # Need 70 more XP for level 3 (120 - 50)


class TestDateUtilities:
    """Test date utility functions"""

    def test_is_same_day(self):
        """Test same day detection"""
        today = datetime.now(timezone.utc)
        today_str = today.isoformat()

        # Same day
        assert is_same_day(today_str, today) is True

        # Different day
        yesterday = today.replace(day=today.day-1) if today.day > 1 else today.replace(month=today.month-1, day=28)
        assert is_same_day(yesterday.isoformat(), today) is False

        # None date string
        assert is_same_day(None, today) is False

    def test_is_consecutive_day(self):
        """Test consecutive day detection"""
        today = datetime.now(timezone.utc)
        yesterday = today.replace(day=today.day-1) if today.day > 1 else today.replace(month=today.month-1, day=28)
        yesterday_str = yesterday.isoformat()

        # Consecutive day
        assert is_consecutive_day(yesterday_str, today) is True

        # Same day (not consecutive)
        assert is_consecutive_day(today.isoformat(), today) is False

        # None date string
        assert is_consecutive_day(None, today) is False


class TestXPRewardsConstants:
    """Test that XP rewards constants exist"""

    def test_xp_rewards_constants_exist(self):
        """Ensure all required XP reward constants are defined"""
        required_keys = [
            "login_daily",
            "first_login",
            "activity_completion",
            "course_completion",
            "first_activity",
            "perfect_score",
        ]

        for key in required_keys:
            assert key in XP_REWARDS, f"Missing XP reward constant: {key}"
            assert isinstance(XP_REWARDS[key], int), f"XP reward {key} should be integer"
            assert XP_REWARDS[key] > 0, f"XP reward {key} should be positive"
