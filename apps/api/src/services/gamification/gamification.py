"""
Gamification Service for LMS

Handles XP calculations, streak tracking, level progression, and all gamification logic.
Designed to be highly extensible for future features like badges, achievements, and challenges.

Key Features:
- Atomic XP awarding with race condition protection
- Idempotent operations with proper transaction handling
- Comprehensive error handling and recovery
- Performance optimized with minimal database calls
- Extensible architecture for future gamification features
"""

from datetime import datetime, timezone, date, timedelta
from typing import Any, Dict, Optional, Tuple, List
import os
import json
import uuid
import logging

from fastapi import HTTPException, Request, status
from sqlalchemy import text, and_, select as sa_select, func, or_
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from src.db.gamification import (
    GamificationDashboard,
    OrganizationLeaderboard,
    StreakRecord,
    StreakRecordCreate,
    StreakRecordRead,
    StreakTypeEnum,
    UserGamificationProfile,
    UserGamificationProfileCreate,
    UserGamificationProfileRead,
    UserGamificationProfileUpdate,
    XPTransaction,
    XPTransactionCreate,
    XPTransactionRead,
    XPAwardRequest,
    XPAwardResponse,
    UserGamificationPreference,
    UserGamificationPreferenceRead,
    UserGamificationPreferenceUpsert,
)
from src.db.users import AnonymousUser, PublicUser, User as DBUser
from src.db.user_organizations import UserOrganization
from src.shared.gamification_constants import (
    BASE_XP_PER_LEVEL,
    XP_MULTIPLIER_PER_LEVEL,
    XP_REWARDS,
    STREAK_MILESTONES,
    MAX_DAILY_XP,
    STREAK_GRACE_HOURS,
    calculate_level_from_xp as shared_calculate_level_from_xp,
)

# Configure logging
logger = logging.getLogger(__name__)

_redis_client = None


def _get_redis():  # lazy import to keep optional
    global _redis_client  # noqa: PLW0603
    if _redis_client is not None:
        return _redis_client
    try:
        import redis  # type: ignore
        from config.config import get_openu_config

        cfg = get_openu_config()
        conn = getattr(cfg, "redis_config", None)
        url = getattr(conn, "redis_connection_string", None)
        if not url:
            return None
        _redis_client = redis.Redis.from_url(url, decode_responses=True)
        return _redis_client
    except Exception:  # pragma: no cover - optional dependency
        return None


def _cache_get(key: str) -> Any | None:
    r = _get_redis()
    if not r:
        return None
    try:
        raw = r.get(key)
        if not raw:
            return None
        return json.loads(raw)
    except Exception:  # pragma: no cover
        return None


def _cache_set(key: str, value: Any, ttl: int) -> None:
    r = _get_redis()
    if not r:
        return
    try:  # pragma: no cover - best effort
        r.setex(key, ttl, json.dumps(value, default=str))
    except Exception:
        pass


def _cache_delete(*keys: str) -> None:
    r = _get_redis()
    if not r:
        return
    try:  # pragma: no cover
        if keys:
            r.delete(*keys)
    except Exception:
        pass


def _dashboard_cache_key(user_id: int, org_id: int) -> str:
    return f"gamification:dashboard:{org_id}:{user_id}"


def _leaderboard_cache_key(org_id: int, limit: int) -> str:
    return f"gamification:leaderboard:{org_id}:{limit}"


def _invalidate_user_cache(user_id: int, org_id: int):
    _cache_delete(_dashboard_cache_key(user_id, org_id))


def _invalidate_leaderboard_cache(org_id: int):
    # Wildcard deletion (scan) only if redis available
    r = _get_redis()
    if not r:
        return
    try:  # pragma: no cover
        for key in r.scan_iter(match=f"gamification:leaderboard:{org_id}:*"):
            r.delete(key)
    except Exception:
        pass


def calculate_level_from_xp(total_xp: int) -> Tuple[int, int]:
    """
    Calculate level and XP to next level from total XP.

    Args:
        total_xp: Total XP accumulated by user

    Returns:
        tuple: (current_level, xp_to_next_level)

    Raises:
        ValueError: If total_xp is negative
    """
    if total_xp < 0:
        raise ValueError("Total XP cannot be negative")

    return shared_calculate_level_from_xp(total_xp)


def _parse_date_safe(date_str: str | None) -> datetime | None:
    """
    Safely parse ISO date string to datetime object.

    Args:
        date_str: ISO formatted date string or None

    Returns:
        datetime object or None if parsing fails
    """
    if not date_str:
        return None
    try:
        # Handle both UTC and timezone-aware formats
        if date_str.endswith("Z"):
            date_str = date_str[:-1] + "+00:00"
        return datetime.fromisoformat(date_str)
    except (ValueError, AttributeError) as e:
        logger.warning(f"Failed to parse date string: {date_str}, error: {e}")
        return None


def is_consecutive_day(last_date_str: str | None, current_date: datetime) -> bool:
    """
    Check if current_date is consecutive to last_date (next day).

    Args:
        last_date_str: ISO date string of last activity
        current_date: Current datetime to check

    Returns:
        bool: True if dates are consecutive days
    """
    last_date = _parse_date_safe(last_date_str)
    if not last_date:
        return False

    # Compare dates only (ignore time)
    last_date_only = last_date.date()
    current_date_only = current_date.date()

    return (current_date_only - last_date_only).days == 1


def is_same_day(last_date_str: str | None, current_date: datetime) -> bool:
    """
    Check if current_date is the same day as last_date.

    Args:
        last_date_str: ISO date string of last activity
        current_date: Current datetime to check

    Returns:
        bool: True if dates are on the same day
    """
    last_date = _parse_date_safe(last_date_str)
    if not last_date:
        return False

    # Compare dates only (ignore time)
    return last_date.date() == current_date.date()


def _is_within_grace_period(target_date: datetime, current_date: datetime) -> bool:
    """
    Check if current_date is within grace period of target_date.

    Args:
        target_date: Target date for comparison
        current_date: Current datetime

    Returns:
        bool: True if within grace period
    """
    grace_cutoff = target_date + timedelta(hours=STREAK_GRACE_HOURS)
    return current_date <= grace_cutoff


async def get_or_create_gamification_profile(
    user_id: int, org_id: int, db_session: Session, retry_count: int = 0
) -> UserGamificationProfile:
    """
    Get or create gamification profile for user in org.
    Thread-safe with unique constraint handling and retry logic.

    Args:
        user_id: User identifier
        org_id: Organization identifier
        db_session: Database session
        retry_count: Current retry attempt (for internal use)

    Returns:
        UserGamificationProfile: The user's gamification profile

    Raises:
        HTTPException: If profile cannot be created or retrieved after retries
    """
    max_retries = 3

    try:
        # Try to get existing profile first
        statement = select(UserGamificationProfile).where(
            and_(
                UserGamificationProfile.user_id == user_id,
                UserGamificationProfile.org_id == org_id,
            )
        )
        existing_profile = db_session.exec(statement).first()

        if existing_profile:
            return existing_profile

        # Create new profile
        new_profile = UserGamificationProfile(
            user_id=user_id,
            org_id=org_id,
            total_xp=0,
            current_level=1,
            current_login_streak=0,
            longest_login_streak=0,
            current_learning_streak=0,
            longest_learning_streak=0,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            version=1,
        )

        db_session.add(new_profile)
        db_session.commit()
        db_session.refresh(new_profile)

        logger.info(
            f"Created new gamification profile for user {user_id} in org {org_id}"
        )
        return new_profile

    except IntegrityError as e:
        db_session.rollback()

        if retry_count >= max_retries:
            logger.error(
                f"Failed to get/create gamification profile after {max_retries} retries: {e}"
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or retrieve gamification profile after multiple attempts",
            )

        # Retry with exponential backoff (race condition handling)
        import time

        time.sleep(0.1 * (2**retry_count))  # 0.1s, 0.2s, 0.4s
        return await get_or_create_gamification_profile(
            user_id, org_id, db_session, retry_count + 1
        )

    except Exception as e:
        db_session.rollback()
        logger.error(f"Unexpected error creating gamification profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}",
        )


async def award_xp(
    user_id: int,
    org_id: int,
    request: XPAwardRequest,
    db_session: Session,
) -> XPAwardResponse:
    """
    Award XP to user with idempotency, atomicity, and rate limiting.

    This function is designed to handle concurrent requests safely and prevent
    gaming the system with excessive XP awards.

    Args:
        user_id: User identifier
        org_id: Organization identifier
        request: XP award request details
        db_session: Database session

    Returns:
        XPAwardResponse: Result of the XP award operation

    Raises:
        HTTPException: If operation fails or request is invalid
    """
    # Validate request
    if not request.source:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="XP source is required"
        )

    # Determine XP amount from source if not specified
    xp_amount = request.xp_amount
    if xp_amount is None:
        xp_amount = XP_REWARDS.get(request.source, 0)
        if xp_amount == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown XP source: {request.source} and no XP amount specified",
            )

    # Validate XP amount
    if xp_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="XP amount must be positive"
        )

    # Generate idempotency key if not provided
    idempotency_key = request.idempotency_key
    if not idempotency_key:
        # Create deterministic key for natural idempotency
        key_parts = [str(user_id), str(org_id), request.source]
        if request.source_id:
            key_parts.append(request.source_id)
        key_parts.append(str(date.today()))
        idempotency_key = f"xp_{'_'.join(key_parts)}"

    # Check daily XP limits to prevent gaming
    today = datetime.now(timezone.utc).date()
    daily_xp_query = select(func.sum(XPTransaction.xp_amount)).where(
        and_(
            XPTransaction.user_id == user_id,
            XPTransaction.org_id == org_id,
            func.date(XPTransaction.created_at) == today,
        )
    )
    daily_xp = db_session.exec(daily_xp_query).first() or 0

    if daily_xp + xp_amount > MAX_DAILY_XP:
        logger.warning(
            f"Daily XP limit reached for user {user_id}: {daily_xp + xp_amount} > {MAX_DAILY_XP}"
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily XP limit of {MAX_DAILY_XP} would be exceeded",
        )

    # Start transaction with retry logic
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Check for existing transaction with same idempotency key
            existing_tx = db_session.exec(
                select(XPTransaction).where(
                    XPTransaction.idempotency_key == idempotency_key
                )
            ).first()

            if existing_tx:
                # Return existing result (idempotent)
                profile = await get_or_create_gamification_profile(
                    user_id, org_id, db_session
                )
                logger.info(
                    f"Returning existing XP transaction for key: {idempotency_key}"
                )
                return XPAwardResponse(
                    transaction=XPTransactionRead.model_validate(existing_tx),
                    profile_updated=UserGamificationProfileRead.model_validate(profile),
                    level_up=False,  # Already processed
                    previous_level=None,
                )

            # Get profile with SELECT FOR UPDATE to prevent race conditions
            profile_statement = (
                select(UserGamificationProfile)
                .where(
                    and_(
                        UserGamificationProfile.user_id == user_id,
                        UserGamificationProfile.org_id == org_id,
                    )
                )
                .with_for_update()
            )

            profile = db_session.exec(profile_statement).first()
            if not profile:
                # Create profile within transaction
                profile = UserGamificationProfile(
                    user_id=user_id,
                    org_id=org_id,
                    total_xp=0,
                    current_level=1,
                    current_login_streak=0,
                    longest_login_streak=0,
                    current_learning_streak=0,
                    longest_learning_streak=0,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                    version=1,
                )
                db_session.add(profile)
                db_session.flush()  # Get ID but don't commit yet

            # Calculate level before update
            old_level = profile.current_level
            old_total_xp = profile.total_xp

            # Update profile XP atomically
            new_total_xp = old_total_xp + xp_amount
            new_level, xp_to_next_level = calculate_level_from_xp(new_total_xp)

            # Update profile with optimistic locking
            profile.total_xp = new_total_xp
            profile.current_level = new_level
            profile.updated_at = datetime.now(timezone.utc)
            profile.version += 1

            # Create XP transaction record
            # NOTE: XPAwardRequest defines 'transaction_metadata'; previous code incorrectly
            # referenced 'request.metadata' causing AttributeError and silent 500s in some paths.
            transaction = XPTransaction(
                user_id=user_id,
                org_id=org_id,
                xp_amount=xp_amount,
                source=request.source,
                source_id=request.source_id,
                idempotency_key=idempotency_key,
                transaction_metadata=(
                    getattr(request, "transaction_metadata", None) or {}
                ),
                created_at=datetime.now(timezone.utc),
            )

            db_session.add(transaction)
            db_session.flush()  # Ensure transaction gets ID

            # Commit all changes atomically
            db_session.commit()

            # Log successful XP award & compute level progress snapshot
            level_up = new_level > old_level
            # (Optional) progress snapshot can be computed here if response schema extended later
            try:  # pragma: no cover - defensive snapshot
                calculate_level_from_xp(profile.total_xp)
            except Exception:
                pass

            logger.info(
                "xp_awarded user=%s org=%s src=%s amount=%s level_up=%s lvl_before=%s lvl_after=%s total_xp=%s",
                user_id,
                org_id,
                request.source,
                xp_amount,
                level_up,
                old_level,
                new_level,
                new_total_xp,
            )

            # Invalidate caches impacted by XP change
            _invalidate_user_cache(user_id, org_id)
            _invalidate_leaderboard_cache(org_id)

            # Build response (schema extension friendly – client can ignore extra keys)
            return XPAwardResponse(
                transaction=XPTransactionRead.model_validate(transaction),
                profile_updated=UserGamificationProfileRead.model_validate(profile),
                level_up=level_up,
                previous_level=old_level if level_up else None,
            )

        except OperationalError as e:
            # Handle deadlock and retry
            db_session.rollback()
            if attempt < max_retries - 1:
                logger.warning(
                    f"Database operation failed, retrying (attempt {attempt + 1}): {e}"
                )
                import time

                time.sleep(0.1 * (2**attempt))  # Exponential backoff
                continue
            else:
                logger.error(f"Failed to award XP after {max_retries} attempts: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to award XP due to database contention",
                )

        except Exception as e:
            db_session.rollback()
            logger.error(f"Unexpected error awarding XP: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to award XP: {str(e)}",
            )

    # This should never be reached
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Maximum retries exceeded",
    )


async def update_login_streak(
    user_id: int,
    org_id: int,
    db_session: Session,
    login_date: Optional[datetime] = None,
) -> UserGamificationProfile:
    """
    Update login streak for user. Idempotent per day with bonus XP awards.

    Args:
        user_id: User identifier
        org_id: Organization identifier
        db_session: Database session
        login_date: Date of login (defaults to now)

    Returns:
        UserGamificationProfile: Updated profile

    Raises:
        HTTPException: If operation fails
    """
    if login_date is None:
        login_date = datetime.now(timezone.utc)

    login_date_only = login_date.date()

    # Retry logic for concurrency handling
    max_retries = 3
    for attempt in range(max_retries):
        try:
            # Get or create profile with lock
            profile_statement = (
                select(UserGamificationProfile)
                .where(
                    and_(
                        UserGamificationProfile.user_id == user_id,
                        UserGamificationProfile.org_id == org_id,
                    )
                )
                .with_for_update()
            )

            profile = db_session.exec(profile_statement).first()
            if not profile:
                profile = UserGamificationProfile(
                    user_id=user_id,
                    org_id=org_id,
                    total_xp=0,
                    current_level=1,
                    current_login_streak=0,
                    longest_login_streak=0,
                    current_learning_streak=0,
                    longest_learning_streak=0,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                    version=1,
                )
                db_session.add(profile)
                db_session.flush()

            # Check if we already processed this day (idempotency)
            existing_streak_record = db_session.exec(
                select(StreakRecord).where(
                    and_(
                        StreakRecord.user_id == user_id,
                        StreakRecord.org_id == org_id,
                        StreakRecord.streak_type == StreakTypeEnum.LOGIN,
                        func.date(StreakRecord.date) == login_date_only,
                    )
                )
            ).first()

            if existing_streak_record:
                # Already processed today, return current profile
                logger.debug(f"Login streak already updated for user {user_id} on {login_date_only}")
                db_session.commit()  # Commit the potential profile creation
                return profile

            # Determine streak update logic
            last_login_str = (
                profile.last_login_date.isoformat() if profile.last_login_date else None
            )

            old_streak = profile.current_login_streak
            bonus_xp = 0

            if is_same_day(last_login_str, login_date):
                # Same day login, no changes to streak
                logger.debug(f"Same day login for user {user_id}, no streak update needed")
                db_session.commit()
                return profile

            elif is_consecutive_day(last_login_str, login_date):
                # Consecutive day, increment streak
                profile.current_login_streak += 1
                profile.longest_login_streak = max(
                    profile.longest_login_streak, profile.current_login_streak
                )

                # Award streak milestone bonuses
                if profile.current_login_streak in STREAK_MILESTONES:
                    bonus_key = f"streak_bonus_{profile.current_login_streak}_days"
                    bonus_xp = XP_REWARDS.get(bonus_key, 0)

                logger.info(f"Extended login streak for user {user_id}: {old_streak} -> {profile.current_login_streak}")

            elif profile.last_login_date:
                # Check if within grace period for yesterday
                yesterday = login_date_only - timedelta(days=1)
                yesterday_datetime = datetime.combine(yesterday, datetime.min.time(), timezone.utc)

                if _is_within_grace_period(yesterday_datetime, login_date):
                    # Within grace period, treat as consecutive
                    profile.current_login_streak += 1
                    profile.longest_login_streak = max(
                        profile.longest_login_streak, profile.current_login_streak
                    )
                    logger.info(f"Login within grace period for user {user_id}, streak extended")
                else:
                    # Break in streak, reset to 1
                    profile.current_login_streak = 1
                    logger.info(f"Login streak broken for user {user_id}, reset to 1")
            else:
                # First login ever
                profile.current_login_streak = 1
                logger.info(f"First login recorded for user {user_id}")

            # Update last login date and profile
            profile.last_login_date = login_date
            profile.updated_at = datetime.now(timezone.utc)
            profile.version += 1

            # Create streak record for idempotency tracking
            streak_record = StreakRecord(
                user_id=user_id,
                org_id=org_id,
                streak_type=StreakTypeEnum.LOGIN,
                date=login_date,
                streak_count=profile.current_login_streak,
                record_metadata={
                    "login_time": login_date.isoformat(),
                    "old_streak": old_streak,
                    "new_streak": profile.current_login_streak,
                },
                created_at=datetime.now(timezone.utc),
            )
            db_session.add(streak_record)

            # Award bonus XP if applicable
            if bonus_xp > 0:
                # Update total XP and level
                profile.total_xp += bonus_xp
                new_level, _ = calculate_level_from_xp(profile.total_xp)
                profile.current_level = new_level

                # Create XP transaction for bonus
                bonus_transaction = XPTransaction(
                    user_id=user_id,
                    org_id=org_id,
                    xp_amount=bonus_xp,
                    source=f"streak_bonus_{profile.current_login_streak}_days",
                    source_id=f"login_streak_{profile.current_login_streak}",
                    idempotency_key=f"streak_bonus_{user_id}_{org_id}_{profile.current_login_streak}_{login_date_only}",
                    transaction_metadata={
                        "streak_count": profile.current_login_streak,
                        "milestone": True,
                    },
                    created_at=datetime.now(timezone.utc),
                )
                db_session.add(bonus_transaction)

                logger.info(f"Awarded {bonus_xp} bonus XP for {profile.current_login_streak}-day streak to user {user_id}")

            # Award daily login XP
            daily_xp = XP_REWARDS.get("login_daily", 10)
            profile.total_xp += daily_xp
            new_level, _ = calculate_level_from_xp(profile.total_xp)
            profile.current_level = new_level

            # Create XP transaction for daily login
            daily_transaction = XPTransaction(
                user_id=user_id,
                org_id=org_id,
                xp_amount=daily_xp,
                source="login_daily",
                source_id=f"daily_login_{login_date_only}",
                idempotency_key=f"daily_login_{user_id}_{org_id}_{login_date_only}",
                transaction_metadata={
                    "login_date": login_date_only.isoformat(),
                    "streak_count": profile.current_login_streak,
                },
                created_at=datetime.now(timezone.utc),
            )
            db_session.add(daily_transaction)

            # Commit all changes atomically
            db_session.commit()

            logger.info(
                "login_streak_updated user=%s org=%s streak=%s total_xp=%s level=%s",
                user_id,
                org_id,
                profile.current_login_streak,
                profile.total_xp,
                profile.current_level,
            )

            # Invalidate user dashboard cache (streak + XP changed)
            _invalidate_user_cache(user_id, org_id)

            return profile

        except OperationalError as e:
            # Handle deadlock and retry
            db_session.rollback()
            if attempt < max_retries - 1:
                logger.warning(f"Database operation failed during login streak update, retrying (attempt {attempt + 1}): {e}")
                import time
                time.sleep(0.1 * (2 ** attempt))  # Exponential backoff
                continue
            else:
                logger.error(f"Failed to update login streak after {max_retries} attempts: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to update login streak due to database contention"
                )

        except Exception as e:
            db_session.rollback()
            logger.error(f"Unexpected error updating login streak: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to update login streak: {str(e)}",
            )

    # Should never reach here
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Maximum retries exceeded for login streak update"
    )


async def update_learning_streak(
    user_id: int,
    org_id: int,
    db_session: Session,
    activity_date: Optional[datetime] = None,
) -> UserGamificationProfile:
    """
    Update learning streak for user. Idempotent per day.
    """
    if activity_date is None:
        activity_date = datetime.now(timezone.utc)

    activity_date_only = activity_date.date()

    # Similar to login streak but for learning activities
    db_session.begin()

    try:
        # Get or create profile with lock
        profile_statement = (
            select(UserGamificationProfile)
            .where(
                and_(
                    UserGamificationProfile.user_id == user_id,
                    UserGamificationProfile.org_id == org_id,
                )
            )
            .with_for_update()
        )

        profile = db_session.exec(profile_statement).first()
        if not profile:
            profile = await get_or_create_gamification_profile(
                user_id, org_id, db_session
            )

        # Check for existing record (idempotency)
        existing_streak_record = db_session.exec(
            select(StreakRecord).where(
                and_(
                    StreakRecord.user_id == user_id,
                    StreakRecord.org_id == org_id,
                    StreakRecord.streak_type == StreakTypeEnum.LEARNING,
                    func.date(StreakRecord.date) == activity_date_only,
                )
            )
        ).first()

        if existing_streak_record:
            db_session.rollback()
            return profile

        # Update learning streak logic
        last_activity_str = (
            profile.last_learning_activity_date.isoformat()
            if profile.last_learning_activity_date
            else None
        )

        if is_same_day(last_activity_str, activity_date):
            db_session.rollback()
            return profile
        elif is_consecutive_day(last_activity_str, activity_date):
            profile.current_learning_streak += 1
            profile.longest_learning_streak = max(
                profile.longest_learning_streak, profile.current_learning_streak
            )
        else:
            profile.current_learning_streak = 1

        profile.last_learning_activity_date = activity_date
        profile.updated_at = datetime.now(timezone.utc)
        profile.version += 1

        # Create streak record
        streak_record = StreakRecord(
            user_id=user_id,
            org_id=org_id,
            streak_type=StreakTypeEnum.LEARNING,
            date=activity_date,
            streak_count=profile.current_learning_streak,
        )
        db_session.add(streak_record)

        db_session.commit()
        return profile

    except Exception as e:
        db_session.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update learning streak: {str(e)}",
        )


async def get_gamification_dashboard(
    user_id: int,
    org_id: int,
    db_session: Session,
) -> GamificationDashboard:
    """Get comprehensive dashboard data for user."""
    # Try cache first
    cache_key = _dashboard_cache_key(user_id, org_id)
    cached = _cache_get(cache_key)
    if cached:
        try:
            return GamificationDashboard.model_validate(cached)
        except Exception:
            pass

    profile = await get_or_create_gamification_profile(user_id, org_id, db_session)

    # Get recent XP transactions
    recent_transactions = db_session.exec(
        select(XPTransaction)
        .where(and_(XPTransaction.user_id == user_id, XPTransaction.org_id == org_id))
        .order_by(XPTransaction.created_at.desc())
        .limit(10)
    ).all()

    # Calculate daily XP history (last 30 days)
    daily_xp_query = text("""
        SELECT DATE(created_at) as date, SUM(xp_amount) as total_xp
        FROM xptransaction
        WHERE user_id = :user_id AND org_id = :org_id
        AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
    """)
    daily_xp_result = db_session.execute(
        daily_xp_query, {"user_id": user_id, "org_id": org_id}
    )
    daily_xp_history = [
        {"date": row.date, "xp": row.total_xp} for row in daily_xp_result
    ]

    # Calculate next level info
    current_level, xp_into_level = calculate_level_from_xp(profile.total_xp)
    next_level_xp = shared_calculate_level_from_xp(profile.total_xp + 1)[
        0
    ]  # XP needed for next level

    # Normalize transaction timestamps to timezone-aware UTC before arithmetic to avoid
    # "can't subtract offset-naive and offset-aware datetimes" errors that can occur
    # if the DB driver returns naive datetimes (e.g. depending on timezone settings).
    now_utc = datetime.now(timezone.utc)
    seven_days_ago = now_utc - timedelta(days=7)

    total_xp_this_week = 0
    activities_completed = 0
    for tx in recent_transactions:
        created_at = tx.created_at
        # If DB returns naive datetime, assume UTC and attach tzinfo
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        if created_at >= seven_days_ago:
            total_xp_this_week += tx.xp_amount
            if tx.source == "activity_completion":
                activities_completed += 1

    dashboard_obj = GamificationDashboard(
        profile=UserGamificationProfileRead.model_validate(profile),
        recent_transactions=[XPTransactionRead.model_validate(tx) for tx in recent_transactions],
        daily_xp_history=daily_xp_history,
        weekly_summary={
            "total_xp_this_week": total_xp_this_week,
            "activities_completed": activities_completed,
        },
        achievements_unlocked=[],  # TODO: Implement achievements
        next_level_info={
            "current_level": current_level,
            "next_level": current_level + 1,
            "xp_progress": xp_into_level,
            "xp_needed": next_level_xp - xp_into_level if next_level_xp > xp_into_level else 0,
        },
    )
    # Cache for 30s
    _cache_set(cache_key, dashboard_obj.model_dump(), ttl=30)
    return dashboard_obj


async def get_organization_leaderboard(
    org_id: int, db_session: Session, limit: int = 50
) -> OrganizationLeaderboard:
    """Get organization leaderboard with user details.

    Replaces raw SQL (which failed due to reserved word / column resolution issues)
    with a SQLAlchemy/SQLModel query to ensure portability and correct quoting.
    """

    # Cache
    cache_key = _leaderboard_cache_key(org_id, limit)
    cached = _cache_get(cache_key)
    if cached:
        try:
            return OrganizationLeaderboard.model_validate(cached)
        except Exception:
            pass

    try:
        # Build ORM query
        query = (
            select(
                UserGamificationProfile.user_id,
                UserGamificationProfile.total_xp,
                UserGamificationProfile.current_level,
                UserGamificationProfile.current_login_streak,
                UserGamificationProfile.current_learning_streak,
                DBUser.username,
                DBUser.first_name,
                DBUser.last_name,
                DBUser.user_uuid,
                DBUser.avatar_image,
            )
            .join(DBUser, UserGamificationProfile.user_id == DBUser.id)
            .join(
                UserOrganization,
                (UserOrganization.user_id == DBUser.id)
                & (UserOrganization.org_id == org_id),
            )
            .where(UserGamificationProfile.org_id == org_id)
            .order_by(
                UserGamificationProfile.total_xp.desc(),
                UserGamificationProfile.current_level.desc(),
            )
            .limit(limit)
        )

        rows = db_session.exec(query).all()

        # Compute ranks (row_number semantics)
        leaderboard_entries: list[dict[str, Any]] = []
        for idx, row in enumerate(rows, start=1):
            (
                user_id,
                total_xp,
                current_level,
                current_login_streak,
                current_learning_streak,
                username,
                first_name,
                last_name,
                user_uuid,
                avatar_image,
            ) = row
            leaderboard_entries.append(
                {
                    "rank": idx,
                    "user_id": user_id,
                    "total_xp": total_xp,
                    "current_level": current_level,
                    "current_login_streak": current_login_streak,
                    "current_learning_streak": current_learning_streak,
                    "username": username,
                    "first_name": first_name,
                    "last_name": last_name,
                    "user_uuid": user_uuid,
                    "avatar_image": avatar_image,
                }
            )

        total_participants = db_session.exec(
            select(func.count(UserGamificationProfile.id)).where(
                UserGamificationProfile.org_id == org_id
            )
        ).one()

        leaderboard_obj = OrganizationLeaderboard(
            org_id=org_id,
            leaderboard_entries=leaderboard_entries,
            total_participants=total_participants,
        )
        _cache_set(cache_key, leaderboard_obj.model_dump(), ttl=30)
        return leaderboard_obj
    except Exception as e:  # noqa: BLE001
        logger.exception("Failed to build organization leaderboard", extra={"org_id": org_id})
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="failed_to_build_leaderboard",
        ) from e
