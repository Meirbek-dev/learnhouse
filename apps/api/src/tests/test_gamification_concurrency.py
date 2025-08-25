"""
Tests for Gamification Service

Focuses on critical concurrency and idempotency scenarios to validate fixes.
"""

import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, AsyncMock

import pytest
import pytest_asyncio
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, create_engine, SQLModel, select, Field

from src.db.gamification import (
    UserGamificationProfile,
    UserGamificationProfileCreate,
    XPTransaction,
    XPAwardRequest,
    StreakRecord,
    StreakTypeEnum,
)
from src.db.users import PublicUser
from src.services.gamification import (
    award_xp,
    update_login_streak,
    calculate_level_from_xp,
    is_consecutive_day,
    is_same_day,
    get_or_create_gamification_profile,
)
from src.shared.gamification_constants import XP_REWARDS, BASE_XP_PER_LEVEL


# Mock models for testing (to avoid complex DB dependencies)
class User(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    email: str = Field(unique=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Organization(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


@pytest.fixture
def db_engine():
    """Create in-memory SQLite database for testing"""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session(db_engine):
    """Create database session for each test"""
    with Session(db_engine) as session:
        yield session


class TestLevelCalculation:
    """Test level calculation logic"""

    def test_level_calculation_edge_cases(self):
        """Test level calculation for edge cases"""
        # Test zero XP
        level, xp_to_next = calculate_level_from_xp(0)
        assert level == 1
        assert xp_to_next == BASE_XP_PER_LEVEL

        # Test negative XP raises error
        with pytest.raises(ValueError):
            calculate_level_from_xp(-1)

        # Test level boundaries
        level, xp_to_next = calculate_level_from_xp(BASE_XP_PER_LEVEL)
        assert level == 2
        expected_xp_for_level_3 = int(BASE_XP_PER_LEVEL * (1.2 ** 1))
        assert xp_to_next == expected_xp_for_level_3

    def test_level_progression(self):
        """Test level progression with realistic XP values"""
        # Test mid-level XP
        level, xp_to_next = calculate_level_from_xp(BASE_XP_PER_LEVEL + 50)
        assert level == 2

        # Test level 5 threshold
        xp_for_level_5 = sum(int(BASE_XP_PER_LEVEL * (1.2 ** i)) for i in range(4))
        level, xp_to_next = calculate_level_from_xp(xp_for_level_5)
        assert level == 5

        # Test high level
        high_xp = 10000
        level, xp_to_next = calculate_level_from_xp(high_xp)
        assert level > 10
        assert xp_to_next >= 0


class TestDateUtilities:
    """Test date parsing and comparison utilities"""

    def test_is_same_day(self):
        """Test same day detection"""
        date1 = datetime(2025, 1, 15, 10, 0, 0, tzinfo=timezone.utc)
        date2 = datetime(2025, 1, 15, 23, 59, 59, tzinfo=timezone.utc)

        assert is_same_day(date1.isoformat(), date2)
        assert not is_same_day(
            date1.isoformat(), datetime(2025, 1, 16, 1, 0, 0, tzinfo=timezone.utc)
        )
        assert not is_same_day(None, date1)

    def test_is_consecutive_day(self):
        """Test consecutive day detection"""
        date1 = datetime(2025, 1, 15, 23, 59, 59, tzinfo=timezone.utc)
        date2 = datetime(2025, 1, 16, 0, 0, 1, tzinfo=timezone.utc)

        assert is_consecutive_day(date1.isoformat(), date2)
        assert not is_consecutive_day(
            date1.isoformat(), datetime(2025, 1, 17, 1, 0, 0, tzinfo=timezone.utc)
        )
        assert not is_consecutive_day(None, date1)

    def test_date_parsing_edge_cases(self):
        """Test edge cases in date parsing"""
        # Test invalid date strings
        assert not is_same_day("invalid-date", datetime.now(timezone.utc))
        assert not is_consecutive_day("invalid-date", datetime.now(timezone.utc))

        # Test different timezone formats
        utc_date = datetime(2025, 1, 15, 12, 0, 0, tzinfo=timezone.utc)
        iso_with_z = "2025-01-15T12:00:00Z"
        iso_with_offset = "2025-01-15T12:00:00+00:00"

        assert is_same_day(iso_with_z, utc_date)
        assert is_same_day(iso_with_offset, utc_date)


class TestAwardXPConcurrency:
    """Test XP awarding under concurrent conditions"""

    @pytest_asyncio.async_test
    async def test_concurrent_xp_award_same_user(self, db_session):
        """Test concurrent XP awards to same user are handled correctly"""
        user_id = 1
        org_id = 1

        # Create multiple concurrent XP award requests
        requests = [
            XPAwardRequest(
                source="activity_completion",
                xp_amount=25,
                idempotency_key=f"activity_{i}",
                source_id=f"activity_{i}",
            )
            for i in range(5)
        ]

        # Execute concurrently
        tasks = [
            award_xp(user_id, org_id, request, db_session)
            for request in requests
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Verify all requests succeeded
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) == 5

        # Verify final profile state
        profile = await get_or_create_gamification_profile(user_id, org_id, db_session)
        assert profile.total_xp == 125  # 5 * 25 XP

        # Verify all transactions were recorded
        transactions = db_session.exec(
            select(XPTransaction).where(XPTransaction.user_id == user_id)
        ).all()
        assert len(transactions) == 5

    @pytest_asyncio.async_test
    async def test_idempotent_xp_award(self, db_session):
        """Test that duplicate idempotency keys are handled correctly"""
        user_id = 1
        org_id = 1

        request = XPAwardRequest(
            source="course_completion",
            xp_amount=100,
            idempotency_key="course_123_completion",
            source_id="course_123",
        )

        # Award XP twice with same idempotency key
        result1 = await award_xp(user_id, org_id, request, db_session)
        result2 = await award_xp(user_id, org_id, request, db_session)

        # Second call should return existing transaction
        assert result1.transaction.id == result2.transaction.id
        assert not result2.level_up  # Already processed

        # Verify only one transaction exists
        transactions = db_session.exec(
            select(XPTransaction).where(
                XPTransaction.idempotency_key == "course_123_completion"
            )
        ).all()
        assert len(transactions) == 1

        # Verify profile XP is correct (not doubled)
        profile = await get_or_create_gamification_profile(user_id, org_id, db_session)
        assert profile.total_xp == 100

    @pytest_asyncio.async_test
    async def test_daily_xp_limits(self, db_session):
        """Test that daily XP limits are enforced"""
        user_id = 1
        org_id = 1

        # Try to award XP that would exceed daily limit
        large_request = XPAwardRequest(
            source="activity_completion",
            xp_amount=600,  # Exceeds MAX_DAILY_XP of 500
            source_id="large_activity",
        )

        with pytest.raises(Exception) as exc_info:
            await award_xp(user_id, org_id, large_request, db_session)

        assert "daily xp limit" in str(exc_info.value).lower()


class TestLoginStreakConcurrency:
    """Test login streak updates under concurrent conditions"""

    @pytest_asyncio.async_test
    async def test_concurrent_login_streak_updates(self, db_session):
        """Test concurrent login streak updates are idempotent"""
        user_id = 1
        org_id = 1
        login_date = datetime.now(timezone.utc)

        # Execute multiple concurrent login streak updates
        tasks = [
            update_login_streak(user_id, org_id, db_session, login_date)
            for _ in range(3)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All should succeed
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) == 3

        # Verify only one streak record was created
        streak_records = db_session.exec(
            select(StreakRecord).where(
                StreakRecord.user_id == user_id,
                StreakRecord.org_id == org_id,
                StreakRecord.streak_type == StreakTypeEnum.LOGIN,
            )
        ).all()
        assert len(streak_records) == 1

    @pytest_asyncio.async_test
    async def test_streak_bonus_calculation(self, db_session):
        """Test streak bonus XP is awarded correctly"""
        user_id = 1
        org_id = 1

        # Simulate a 7-day streak
        base_date = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        for i in range(7):
            login_date = base_date + timedelta(days=i)
            profile = await update_login_streak(user_id, org_id, db_session, login_date)

        # After 7 days, should have streak bonus
        assert profile.current_login_streak == 7

        # Verify bonus XP was awarded
        bonus_transactions = db_session.exec(
            select(XPTransaction).where(
                XPTransaction.user_id == user_id,
                XPTransaction.source.like("streak_bonus_%")
            )
        ).all()
        assert len(bonus_transactions) >= 1

    @pytest_asyncio.async_test
    async def test_streak_break_and_reset(self, db_session):
        """Test streak breaking and resetting logic"""
        user_id = 1
        org_id = 1

        # Build initial streak
        base_date = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

        for i in range(5):
            login_date = base_date + timedelta(days=i)
            await update_login_streak(user_id, org_id, db_session, login_date)

        # Break streak by skipping a day
        skip_date = base_date + timedelta(days=7)  # Skip day 6
        profile = await update_login_streak(user_id, org_id, db_session, skip_date)

        # Streak should reset to 1
        assert profile.current_login_streak == 1
        assert profile.longest_login_streak == 5  # Previous streak preserved


class TestProfileCreation:
    """Test gamification profile creation and concurrency"""

    @pytest_asyncio.async_test
    async def test_concurrent_profile_creation(self, db_session):
        """Test concurrent profile creation handles race conditions"""
        user_id = 1
        org_id = 1

        # Try to create profile concurrently
        tasks = [
            get_or_create_gamification_profile(user_id, org_id, db_session)
            for _ in range(3)
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All should succeed and return the same profile
        successful_results = [r for r in results if not isinstance(r, Exception)]
        assert len(successful_results) == 3

        # All results should have the same profile ID
        profile_ids = [r.id for r in successful_results]
        assert len(set(profile_ids)) == 1

        # Verify only one profile exists in database
        profiles = db_session.exec(
            select(UserGamificationProfile).where(
                UserGamificationProfile.user_id == user_id,
                UserGamificationProfile.org_id == org_id,
            )
        ).all()
        assert len(profiles) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
