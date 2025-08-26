#!/usr/bin/env python3
"""
Test script to verify gamification XP awarding works correctly
Run with: cd apps/api && uv run python ../../test_gamification.py
"""
import asyncio
import sys
import os

# Add the API path to Python path for direct imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'apps', 'api'))

from datetime import datetime
from sqlmodel import Session, create_engine
from src.db.gamification import XPAwardRequest, XPSource
from src.services.gamification.gamification import award_xp, get_or_create_profile
from config.config import get_openu_config

async def test_xp_award():
    """Test XP award functionality"""
    print("Testing XP award system...")

    # Get database connection
    config = get_openu_config()
    engine = create_engine(config.database_config.sql_connection_string)

    with Session(engine) as db_session:
        # Test user and org IDs (adjust as needed)
        user_id = 1
        org_id = 1

        # Get initial profile
        initial_profile = await get_or_create_profile(user_id, org_id, db_session)
        print(f"Initial XP: {initial_profile.total_xp}")
        print(f"Initial Level: {initial_profile.current_level}")

        # Award XP for activity completion
        award_request = XPAwardRequest(
            user_id=user_id,  # Add required user_id field
            source=XPSource.ACTIVITY_COMPLETION,
            source_id="test_activity_123",
            idempotency_key=f"test_activity_completion_{datetime.now().timestamp()}",
            metadata={
                "activity_name": "Test Activity",
                "completed_at": datetime.now().isoformat(),
            },
        )

        try:
            response = await award_xp(
                user_id=user_id,
                org_id=org_id,
                award_request=award_request,
                db_session=db_session,
                request=None,
            )

            print(f"XP awarded: {response.transaction.xp_amount}")
            print(f"New total XP: {response.profile.total_xp}")
            print(f"New level: {response.profile.current_level}")
            print(f"Level up occurred: {response.level_up_occurred}")

            return True
        except Exception as e:
            print(f"Error awarding XP: {e}")
            import traceback
            traceback.print_exc()
            return False

if __name__ == "__main__":
    result = asyncio.run(test_xp_award())
    if result:
        print("✅ XP award test passed!")
    else:
        print("❌ XP award test failed!")
        sys.exit(1)
