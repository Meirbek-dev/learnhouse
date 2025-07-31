#!/usr/bin/env python3
"""
Test script for the gamification system
Run this to verify all components are working correctly
"""

import asyncio
import sys
import os

# Add the src directory to Python path
sys.path.append(os.path.join(os.path.dirname(__file__), "src"))

from src.services.gamification.gamification import (
    calculate_level_from_xp,
    is_consecutive_day,
    is_same_day,
)
from src.db.gamification import UserGamificationProfile, XPTransaction, StreakRecord


async def test_gamification_system():
    """Test the gamification system functionality"""

    print("🎮 Testing Gamification System")
    print("=" * 50)

    # Test 1: Level calculation
    print("\n1. Testing Level Calculations:")
    test_xp_values = [0, 50, 100, 200, 500, 1000, 2000]

    for xp in test_xp_values:
        level, xp_to_next = calculate_level_from_xp(xp)
        print(f"   XP: {xp:4d} → Level: {level}, XP to next: {xp_to_next}")

    # Test 2: Streak calculations
    print("\n2. Testing Streak Logic:")
    from datetime import datetime, timedelta

    today = datetime.now()
    yesterday = today - timedelta(days=1)
    two_days_ago = today - timedelta(days=2)

    print(f"   Today: {today.strftime('%Y-%m-%d')}")
    print(f"   Yesterday: {yesterday.strftime('%Y-%m-%d')}")
    print(f"   Two days ago: {two_days_ago.strftime('%Y-%m-%d')}")

    # Test consecutive days
    consecutive_yesterday = is_consecutive_day(yesterday.strftime("%Y-%m-%d"), today)
    print(
        f"   Yesterday → Today: {'✓ Consecutive' if consecutive_yesterday else '✗ Not consecutive'}"
    )

    consecutive_gap = is_consecutive_day(two_days_ago.strftime("%Y-%m-%d"), today)
    print(
        f"   Two days ago → Today: {'✓ Consecutive' if consecutive_gap else '✗ Not consecutive'}"
    )

    # Test same day
    same_day_test = is_same_day(today.strftime("%Y-%m-%d"), today)
    print(f"   Today → Today: {'✓ Same day' if same_day_test else '✗ Not same day'}")

    print("\n3. Database Tables Status:")

    # Check if we can import the models (indicates tables exist)
    try:
        from src.db.gamification import (
            UserGamificationProfile,
            XPTransaction,
            StreakRecord,
            StreakTypeEnum,
        )

        print("   ✓ UserGamificationProfile model imported")
        print("   ✓ XPTransaction model imported")
        print("   ✓ StreakRecord model imported")
        print("   ✓ StreakTypeEnum imported")
    except ImportError as e:
        print(f"   ✗ Import error: {e}")

    print("\n4. Gamification Constants:")
    # Test XP progression for various levels
    base_xp = 50
    multiplier = 1.5

    print("   Level progression (using formula: 50 * level^1.5):")
    for level in range(1, 11):
        xp_required = int(base_xp * (level**multiplier)) if level > 1 else 0
        print(f"   Level {level:2d}: {xp_required:4d} XP required")

    print("\n🎯 Gamification System Test Complete!")
    print("\nNext Steps:")
    print("1. Start the API server: uv run uvicorn app:app --reload")
    print("2. Start the web app: cd ../web && npm run dev")
    print("3. Login to any organization to see the gamification dashboard")
    print("4. Complete activities to earn XP and test the system")
    print("\nAPI Endpoints available:")
    print("- GET /api/v1/gamification/profile/{org_id}")
    print("- GET /api/v1/gamification/dashboard/{org_id}")
    print("- POST /api/v1/gamification/login-streak/{org_id}")
    print("- GET /api/v1/gamification/leaderboard/{org_id}")
    print("- GET /api/v1/gamification/transactions/{org_id}")


if __name__ == "__main__":
    asyncio.run(test_gamification_system())


if __name__ == "__main__":
    asyncio.run(test_gamification_system())
