"""Enhanced Gamification Service

Server-authoritative gamification system with event-driven architecture.
All calculations and validations happen on the server side.
"""

import functools
import json
import logging
import os
import random
import uuid
from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy import and_, desc, func, text
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlmodel import Session, select

from src.core.timezone import now_local, today_local
from src.db.gamification import (
    Achievement,
    AchievementType,
    GamificationDashboard,
    OrganizationLeaderboard,
    StreakRecord,
    StreakType,
    UserAchievement,
    UserGamificationProfile,
    UserGamificationProfileRead,
    XPAwardRequest,
    XPAwardResponse,
    XPSource,
    XPTransaction,
    XPTransactionRead,
)

# Configure logging
logger = logging.getLogger(__name__)


class GamificationConfig:
    """Configuration for gamification system."""

    BASE_XP_PER_LEVEL = 100
    XP_MULTIPLIER_PER_LEVEL = 1.2
    MAX_LEVEL = 100

    # XP rewards by source
    XP_REWARDS = {
        XPSource.LOGIN_BONUS: 10,
        XPSource.ACTIVITY_COMPLETION: 25,
        XPSource.COURSE_COMPLETION: 100,
        XPSource.ASSIGNMENT_SUBMISSION: 50,
        XPSource.QUIZ_COMPLETION: 30,
        XPSource.STREAK_BONUS: 25,
        XPSource.PEER_REVIEW: 30,
        XPSource.FORUM_PARTICIPATION: 15,
        XPSource.MILESTONE_ACHIEVEMENT: 100,
        XPSource.DAILY_GOAL_COMPLETION: 35,
        XPSource.ADMIN_AWARD: 0,  # Custom amount required
    }

    # Daily limits
    MAX_DAILY_XP = 1000
    DEFAULT_DAILY_GOAL_XP = 50

    # Streak milestones for bonuses
    STREAK_MILESTONES = [7, 30, 100, 365]
    STREAK_BONUS_XP = {7: 50, 30: 200, 100: 500, 365: 1000}

    # Grace periods
    STREAK_GRACE_HOURS = 6

    # Cache TTL (seconds)
    CACHE_TTL_PROFILE = 300  # 5 minutes
    CACHE_TTL_DASHBOARD = 600  # 10 minutes
    CACHE_TTL_LEADERBOARD = 900  # 15 minutes

    # Achievement system
    LEVEL_ACHIEVEMENT_INTERVAL = 5  # Achievement every 5 levels


# ============================================================================
# Cache Management
# ============================================================================


class CacheManager:
    """Redis-based cache manager for gamification data.

    Adjusted to avoid log spam: only one warning/info about Redis absence/initialization.
    """

    _redis_client = None
    _disabled = False
    _warned = False

    @classmethod
    def _log_once(cls, level: str, message: str) -> None:
        if cls._warned:
            return
        getattr(logger, level)(message)
        cls._warned = True

    @classmethod
    def get_redis(cls):
        if cls._disabled:
            return None
        if cls._redis_client is not None:
            return cls._redis_client

        try:
            import redis  # optional dependency

            from config.config import get_openu_config

            config = get_openu_config()
            redis_url = (
                config.redis_config.redis_connection_string
                if config.redis_config
                else None
            )
            if not redis_url:
                cls._disabled = True
                cls._log_once("warning", "Redis not configured, caching disabled")
                return None

            cls._redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
            return cls._redis_client
        except Exception as e:
            cls._disabled = True
            cls._log_once("warning", f"Redis connection failed: {e}, caching disabled")
            return None

    @classmethod
    def set(cls, key: str, value: Any, ttl: int) -> None:
        """Set value in cache with TTL."""
        redis_client = cls.get_redis()
        if not redis_client:
            return

        try:
            # Custom serializer to handle datetime objects
            def datetime_serializer(obj):
                if isinstance(obj, datetime):
                    return obj.isoformat()
                msg = f"Object of type {type(obj)} is not JSON serializable"
                raise TypeError(msg)

            redis_client.setex(key, ttl, json.dumps(value, default=datetime_serializer))
        except Exception as e:
            logger.warning(f"Cache set failed for key {key}: {e}")

    @classmethod
    def get(cls, key: str) -> Any:
        """Get value from cache."""
        redis_client = cls.get_redis()
        if not redis_client:
            return None

        try:
            raw_value = redis_client.get(key)
            if not raw_value:
                return None

            # Parse the JSON and convert datetime strings back to datetime objects
            data = json.loads(raw_value)

            # Convert datetime strings back to datetime objects for known fields
            if isinstance(data, dict):
                datetime_fields = [
                    "created_at",
                    "updated_at",
                    "last_login_date",
                    "last_learning_activity_date",
                    "last_xp_award_date",
                ]

                def convert_datetime_fields(obj):
                    if isinstance(obj, dict):
                        result = {}
                        for k, v in obj.items():
                            if k in datetime_fields and isinstance(v, str):
                                try:
                                    # Parse ISO format datetime strings
                                    result[k] = datetime.fromisoformat(v)
                                except (ValueError, AttributeError):
                                    result[k] = v
                            elif isinstance(v, dict):
                                result[k] = convert_datetime_fields(v)
                            elif isinstance(v, list):
                                result[k] = [
                                    convert_datetime_fields(item)
                                    if isinstance(item, dict)
                                    else item
                                    for item in v
                                ]
                            else:
                                result[k] = v
                        return result
                    return obj

                data = convert_datetime_fields(data)

            return data
        except Exception as e:
            logger.warning(f"Cache get failed for key {key}: {e}")
            return None

    @classmethod
    def delete(cls, *keys: str) -> None:
        """Delete keys from cache."""
        redis_client = cls.get_redis()
        if not redis_client or not keys:
            return

        try:
            redis_client.delete(*keys)
        except Exception as e:
            logger.warning(f"Cache delete failed for keys {keys}: {e}")

    @classmethod
    def delete_pattern(cls, pattern: str) -> None:
        """Delete all keys matching pattern."""
        redis_client = cls.get_redis()
        if not redis_client:
            return

        try:
            for key in redis_client.scan_iter(match=pattern):
                redis_client.delete(key)
        except Exception as e:
            logger.warning(f"Cache pattern delete failed for pattern {pattern}: {e}")


# ============================================================================
# Core Calculation Functions
# ============================================================================


def calculate_level_details(total_xp: int) -> tuple[int, int, int, float]:
    """Return detailed level curve values (level, xp_in_level, xp_to_next_level, progress_percent)."""
    if total_xp < 0:
        msg = "Total XP cannot be negative"
        raise ValueError(msg)
    if total_xp == 0:
        return 1, 0, GamificationConfig.BASE_XP_PER_LEVEL, 0.0

    level = 1
    accumulated = 0
    while level <= GamificationConfig.MAX_LEVEL:
        xp_for_level = int(
            GamificationConfig.BASE_XP_PER_LEVEL
            * (GamificationConfig.XP_MULTIPLIER_PER_LEVEL ** (level - 1))
        )
        if accumulated + xp_for_level > total_xp:
            break
        accumulated += xp_for_level
        level += 1

    if level > GamificationConfig.MAX_LEVEL:
        # Cap: no further progression
        return GamificationConfig.MAX_LEVEL, 0, 0, 100.0

    xp_for_level = int(
        GamificationConfig.BASE_XP_PER_LEVEL
        * (GamificationConfig.XP_MULTIPLIER_PER_LEVEL ** (level - 1))
    )
    xp_in_level = total_xp - accumulated
    xp_to_next = xp_for_level - xp_in_level
    progress = (xp_in_level / xp_for_level) * 100.0 if xp_for_level else 0.0
    return level, xp_in_level, xp_to_next, progress


def calculate_streak_bonus_xp(streak_count: int, streak_type: StreakType) -> int:
    """Calculate bonus XP for reaching streak milestones."""
    bonus_xp = 0

    for milestone in GamificationConfig.STREAK_MILESTONES:
        if streak_count == milestone:
            bonus_xp = GamificationConfig.STREAK_BONUS_XP.get(milestone, 0)
            break

    return bonus_xp


def is_consecutive_day(last_date: datetime | None, current_date: datetime) -> bool:
    """Check if current_date is consecutive to last_date (next day)."""
    if not last_date:
        return False

    last_date_only = last_date.date()
    current_date_only = current_date.date()

    return (current_date_only - last_date_only).days == 1


def is_same_day(last_date: datetime | None, current_date: datetime) -> bool:
    """Check if dates are on the same day."""
    if not last_date:
        return False

    return last_date.date() == current_date.date()


# ============================================================================
# Profile Management
# ============================================================================


async def get_or_create_profile(
    user_id: int, org_id: int, db_session: Session
) -> UserGamificationProfile:
    """
    Get or create gamification profile for user in organization.
    Thread-safe with proper error handling.
    """
    cache_key = f"gamification:profile:{org_id}:{user_id}"

    # Try cache first
    cached_data = CacheManager.get(cache_key)
    if cached_data:
        try:
            # IMPORTANT: Do NOT return a transient reconstructed instance.
            # Always return a session-bound instance to prevent duplicate INSERTs
            # when later calling db_session.add(profile). We re-query DB for the
            # persistent row; if missing (cache stale) we fall through to creation.
            stmt_cached = select(UserGamificationProfile).where(
                and_(
                    UserGamificationProfile.user_id == user_id,
                    UserGamificationProfile.org_id == org_id,
                )
            )
            db_profile = db_session.exec(stmt_cached).first()
            if db_profile:
                return db_profile
            # If cache was stale (profile deleted), ignore and create new below.
        except Exception as e:
            logger.warning(f"Failed to deserialize cached profile: {e}")

    # Get from database
    try:
        stmt = select(UserGamificationProfile).where(
            and_(
                UserGamificationProfile.user_id == user_id,
                UserGamificationProfile.org_id == org_id,
            )
        )
        profile = db_session.exec(stmt).first()

        if profile:
            # Cache the result
            CacheManager.set(
                cache_key, profile.model_dump(), GamificationConfig.CACHE_TTL_PROFILE
            )
            return profile

        # Create new profile
        profile = UserGamificationProfile(
            user_id=user_id,
            org_id=org_id,
            total_xp=0,
            current_level=1,
            xp_in_level=0,
            xp_to_next_level=GamificationConfig.BASE_XP_PER_LEVEL,
            level_progress_percent=0.0,
            daily_goal_xp=GamificationConfig.DEFAULT_DAILY_GOAL_XP,
            preferences={},
        )

        db_session.add(profile)
        db_session.commit()
        db_session.refresh(profile)

        # Cache the new profile
        CacheManager.set(
            cache_key, profile.model_dump(), GamificationConfig.CACHE_TTL_PROFILE
        )

        logger.info(
            f"Created new gamification profile for user {user_id} in org {org_id}"
        )
        return profile

    except IntegrityError:
        # Handle race condition - another thread created the profile
        db_session.rollback()
        stmt = select(UserGamificationProfile).where(
            and_(
                UserGamificationProfile.user_id == user_id,
                UserGamificationProfile.org_id == org_id,
            )
        )
        profile = db_session.exec(stmt).first()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create or retrieve gamification profile",
            )

        return profile

    except Exception as e:
        db_session.rollback()
        logger.exception(
            f"Failed to get/create profile for user {user_id}, org {org_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to access gamification profile",
        )


# ============================================================================
# XP Award System
# ============================================================================


def _retryable(func):
    """Lightweight async retry decorator for transient OperationalError / deadlocks.

    Exponential backoff with jitter. Max 3 retries. Logs at warn level; last error raised.
    """

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        max_retries = 3
        base_delay = 0.05  # 50ms
        attempt = 0
        while True:
            try:
                return await func(*args, **kwargs)
            except OperationalError as e:  # pragma: no cover - environment specific
                if attempt >= max_retries:
                    logger.exception("OperationalError after retries: %s", e)
                    raise
                sleep_for = base_delay * (2**attempt) + random.uniform(0, 0.02)
                logger.warning(
                    "Transient DB error (%s). Retrying attempt %s/%s after %.3fs",
                    getattr(e, "orig", e),
                    attempt + 1,
                    max_retries,
                    sleep_for,
                )
                attempt += 1
                # Async friendly sleep
                from asyncio import sleep as _sleep

                await _sleep(sleep_for)
            except IntegrityError:
                # IntegrityError typically not transient for award_xp logic except for race on create profile.
                raise

    return wrapper


@_retryable
async def award_xp(
    user_id: int,
    org_id: int,
    award_request: XPAwardRequest,
    db_session: Session,
    request: Request | None = None,
) -> XPAwardResponse:
    """
    Award XP to user with full transaction support and achievement checking.
    Server-authoritative with atomic operations.
    """
    current_time = now_local()
    # Ensure multiplier has a sane default (frontend omits it for daily login)
    if award_request.multiplier is None or award_request.multiplier <= 0:
        award_request.multiplier = 1.0

    # Idempotency: if idempotency_key provided, check if a transaction already exists with same key in metadata
    if award_request.idempotency_key:
        try:
            # Fetch recent transactions for user/org and scan metadata in Python (DB agnostic)
            recent_stmt = (
                select(XPTransaction)
                .where(
                    and_(
                        XPTransaction.user_id == user_id,
                        XPTransaction.org_id == org_id,
                    )
                )
                .order_by(desc(XPTransaction.created_at))
                .limit(50)
            )
            for existing in db_session.exec(recent_stmt).all():
                meta = existing.transaction_metadata or {}
                if meta.get("idempotency_key") == award_request.idempotency_key:
                    profile = await get_or_create_profile(user_id, org_id, db_session)
                    return XPAwardResponse(
                        transaction=XPTransactionRead.model_validate(
                            existing, from_attributes=True
                        ),
                        profile=UserGamificationProfileRead.model_validate(
                            profile, from_attributes=True
                        ),
                        level_up_occurred=existing.triggered_level_up,
                        previous_level=existing.previous_level,
                        achievements_unlocked=[],
                    )
        except Exception as e:
            logger.warning(f"Idempotency pre-check failed: {e}")

    # Start database transaction (avoid nested begin blocks)
    try:
        # Explicitly begin a transaction; SQLModel/SQLAlchemy will autobegin if needed,
        # but we want to ensure we control commit boundaries and avoid nested context managers.
        # We previously used `with db_session.begin():` and committed inside that block which
        # caused `InvalidRequestError: A transaction is already begun` when nested calls (e.g.,
        # achievements awarding XP) invoked this function. We now manage commit manually.
        # Get profile with row-level locking
        stmt = (
            select(UserGamificationProfile)
            .where(
                and_(
                    UserGamificationProfile.user_id == user_id,
                    UserGamificationProfile.org_id == org_id,
                )
            )
            .with_for_update()
        )

        profile = db_session.exec(stmt).first()
        if not profile:
            profile = await get_or_create_profile(user_id, org_id, db_session)

        # Daily XP limit handling
        if is_same_day(profile.last_xp_award_date, current_time):
            if profile.daily_xp_earned >= profile.daily_xp_limit:
                # Allow silent success for login bonus (no new XP / transaction)
                if award_request.source == XPSource.LOGIN_BONUS:
                    logger.info(
                        f"Daily XP limit reached; skipping login bonus award for user {user_id} (org {org_id})"
                    )
                    # Return consistent minimal transaction schema (synthetic placeholder) for UI parity
                    synthetic_tx = XPTransactionRead(
                        id=0,
                        user_id=user_id,
                        org_id=org_id,
                        xp_amount=0,
                        source=XPSource.LOGIN_BONUS,
                        source_id=None,
                        multiplier_applied=1.0,
                        bonus_xp=0,
                        reason="daily_login_limit_reached",
                        transaction_metadata={"synthetic": True, "base_xp": 0},
                        created_at=current_time,
                        created_by_admin=False,
                        admin_user_id=None,
                        triggered_level_up=False,
                        previous_level=profile.current_level,
                        new_level=profile.current_level,
                    )
                    return XPAwardResponse(
                        transaction=synthetic_tx,
                        profile=UserGamificationProfileRead.model_validate(
                            profile, from_attributes=True
                        ),
                        level_up_occurred=False,
                        previous_level=profile.current_level,
                        achievements_unlocked=[],
                    )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Daily XP limit of {profile.daily_xp_limit} reached",
                )
        else:
            profile.daily_xp_earned = 0

        # Calculate base XP amount
        # Convert source string to XPSource enum if needed for lookups
        source_enum = award_request.source
        if isinstance(source_enum, str):
            try:
                source_enum = XPSource(source_enum)
            except ValueError:
                logger.exception(f"Invalid XP source: {source_enum}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid XP source: {source_enum}",
                )

        base_xp = award_request.custom_amount or GamificationConfig.XP_REWARDS.get(
            source_enum, 0
        )

        if base_xp <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid XP amount for source {source_enum}",
            )

        # Apply multiplier and bonuses
        bonus_xp = 0
        bonus_reasons: list[str] = []

        # Check for streak bonuses
        if source_enum in [
            XPSource.ACTIVITY_COMPLETION,
            XPSource.COURSE_COMPLETION,
        ]:
            streak_bonus = calculate_streak_bonus_xp(
                profile.current_learning_streak, StreakType.LEARNING
            )
            if streak_bonus > 0:
                bonus_xp += streak_bonus
                bonus_reasons.append(
                    f"Learning streak milestone: {profile.current_learning_streak} days"
                )

        # Calculate final XP amount
        # (award_request.multiplier now guaranteed > 0)
        total_xp = int((base_xp + bonus_xp) * award_request.multiplier)

        # Validate daily limit with new XP
        if profile.daily_xp_earned + total_xp > profile.daily_xp_limit:
            total_xp = profile.daily_xp_limit - profile.daily_xp_earned
            if total_xp <= 0:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Daily XP limit reached",
                )

        # Store previous level for comparison
        previous_level = profile.current_level

        # Update profile XP and timestamps
        profile.total_xp += total_xp
        profile.daily_xp_earned += total_xp
        profile.last_xp_award_date = current_time
        profile.updated_at = current_time

        # Recalculate level and progress (server-authoritative)
        new_level, xp_in_level, xp_to_next, progress_percent = calculate_level_details(
            profile.total_xp
        )
        profile.current_level = new_level
        profile.xp_in_level = xp_in_level
        profile.xp_to_next_level = xp_to_next
        profile.level_progress_percent = progress_percent

        # Determine if level up occurred
        level_up_occurred = new_level > previous_level

        # Update activity counters
        if source_enum == XPSource.ACTIVITY_COMPLETION:
            profile.total_activities_completed += 1
        elif source_enum == XPSource.COURSE_COMPLETION:
            profile.total_courses_completed += 1

        # Increment version for optimistic locking
        profile.version += 1

        # Prepare transaction metadata (include idempotency key if present)
        metadata = award_request.metadata.copy() if award_request.metadata else {}
        if award_request.idempotency_key:
            metadata.setdefault("idempotency_key", award_request.idempotency_key)

        transaction = XPTransaction(
            user_id=user_id,
            org_id=org_id,
            xp_amount=total_xp,
            source=source_enum,
            source_id=award_request.source_id,
            idempotency_key=award_request.idempotency_key,
            previous_level=previous_level,
            new_level=new_level,
            triggered_level_up=level_up_occurred,
            multiplier_applied=award_request.multiplier,
            bonus_xp=bonus_xp,
            reason=award_request.reason,
            transaction_metadata=metadata,
            created_at=current_time,
        )

        try:
            db_session.add(transaction)
            db_session.commit()
            db_session.refresh(transaction)
        except IntegrityError as ie:
            db_session.rollback()
            # Uniqueness violation (idempotency or duplicate source/source_id). Return existing transaction.
            if "uq_xp_idempotency_key" in str(
                ie.orig
            ) or "uq_xp_user_org_source_sourceid" in str(ie.orig):
                existing_stmt = (
                    select(XPTransaction)
                    .where(
                        (XPTransaction.idempotency_key == award_request.idempotency_key)
                        if award_request.idempotency_key
                        else and_(
                            XPTransaction.user_id == user_id,
                            XPTransaction.org_id == org_id,
                            XPTransaction.source == source_enum,
                            XPTransaction.source_id == award_request.source_id,
                        )
                    )
                    .order_by(desc(XPTransaction.created_at))
                )
                existing = db_session.exec(existing_stmt).first()
                if existing:
                    return XPAwardResponse(
                        transaction=XPTransactionRead.model_validate(
                            existing, from_attributes=True
                        ),
                        profile=UserGamificationProfileRead.model_validate(
                            profile, from_attributes=True
                        ),
                        level_up_occurred=existing.triggered_level_up,
                        previous_level=existing.previous_level,
                        achievements_unlocked=[],
                    )
            # Re-raise if not handled
            raise

        # Post-commit achievement checks
        achievements_unlocked = await check_and_award_achievements(
            user_id, org_id, profile, transaction, db_session
        )

        # Invalidate caches for updated entities
        CacheManager.delete(
            f"gamification:profile:{org_id}:{user_id}",
            f"gamification:dashboard:{org_id}:{user_id}",
        )
        CacheManager.delete_pattern(f"gamification:leaderboard:{org_id}:xp:*")

        response = XPAwardResponse(
            transaction=XPTransactionRead.model_validate(
                transaction, from_attributes=True
            ),
            profile=UserGamificationProfileRead.model_validate(
                profile, from_attributes=True
            ),
            level_up_occurred=level_up_occurred,
            previous_level=previous_level,
            achievements_unlocked=achievements_unlocked or [],
        )

        logger.info(
            "Awarded %s XP to user %s in org %s (source: %s, level up: %s)",
            total_xp,
            user_id,
            org_id,
            source_enum,
            level_up_occurred,
        )

        return response

    except HTTPException:
        raise
    except Exception as e:
        db_session.rollback()
        logger.exception(f"Failed to award XP to user {user_id} in org {org_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to award XP",
        )


# ============================================================================
# Streak Management
# ============================================================================


@_retryable
async def update_streak(
    user_id: int,
    org_id: int,
    streak_type: StreakType,
    db_session: Session,
    activity_metadata: dict[str, Any] | None = None,
) -> UserGamificationProfile:
    """
    Update user's streak for a specific type.
    Server-authoritative streak calculation.
    """
    current_time = now_local()
    current_date = current_time.date()

    try:
        # Get profile (no explicit begin context to avoid nested transactions)
        profile = await get_or_create_profile(user_id, org_id, db_session)

        # Determine which streak to update based on type
        if streak_type == StreakType.LOGIN:
            current_streak_field = "current_login_streak"
            longest_streak_field = "longest_login_streak"
            last_date_field = "last_login_date"
            profile.total_sessions += 1
        elif streak_type == StreakType.LEARNING:
            current_streak_field = "current_learning_streak"
            longest_streak_field = "longest_learning_streak"
            last_date_field = "last_learning_activity_date"
        else:
            current_streak_field = "current_daily_goal_streak"
            longest_streak_field = "longest_daily_goal_streak"
            last_date_field = "last_xp_award_date"

        current_streak = getattr(profile, current_streak_field)
        longest_streak = getattr(profile, longest_streak_field)
        last_date = getattr(profile, last_date_field)

        # Check if we already recorded activity for today
        existing_record = db_session.exec(
            select(StreakRecord).where(
                and_(
                    StreakRecord.user_id == user_id,
                    StreakRecord.org_id == org_id,
                    StreakRecord.streak_type == streak_type,
                    func.date(StreakRecord.date) == current_date,
                )
            )
        ).first()

        if existing_record:
            # Update existing record (increment activities completed today)
            existing_record.activities_completed += 1
            if activity_metadata:
                # Merge metadata (later keys override)
                existing_record.streak_metadata = {
                    **existing_record.streak_metadata,
                    **activity_metadata,
                }
            db_session.add(existing_record)
            db_session.commit()
            return profile

        # Calculate new streak
        if is_same_day(last_date, current_time):
            # Same day - no change to streak
            new_streak = current_streak
        elif is_consecutive_day(last_date, current_time):
            # Consecutive day - increment streak
            new_streak = current_streak + 1
        else:
            # Broken streak - reset to 1
            new_streak = 1

        # Check for milestone bonus
        milestone_reached: int | None = None
        bonus_xp = 0
        if new_streak in GamificationConfig.STREAK_MILESTONES:
            milestone_reached = new_streak
            bonus_xp = GamificationConfig.STREAK_BONUS_XP.get(new_streak, 0)

        # Update profile
        setattr(profile, current_streak_field, new_streak)
        setattr(profile, longest_streak_field, max(longest_streak, new_streak))
        setattr(profile, last_date_field, current_time)
        profile.updated_at = current_time
        profile.version += 1

        # Create streak record
        # Build streak metadata, include milestone number if reached
        streak_metadata: dict[str, Any] = (
            activity_metadata.copy() if activity_metadata else {}
        )
        if milestone_reached:
            streak_metadata["milestone"] = milestone_reached

        streak_record = StreakRecord(
            user_id=user_id,
            org_id=org_id,
            streak_type=streak_type,
            date=current_time,
            streak_count=new_streak,
            is_milestone=bool(milestone_reached),
            activities_completed=1,
            xp_earned_today=0,  # Updated separately via XP awards
            streak_metadata=streak_metadata,
        )

        db_session.add(streak_record)
        db_session.commit()

        # Award milestone bonus XP if applicable (after commit to avoid nested transactions)
        if bonus_xp > 0:
            bonus_request = XPAwardRequest(
                source=XPSource.STREAK_BONUS,
                source_id=f"{streak_type}_{new_streak}",
                custom_amount=bonus_xp,
                idempotency_key=f"streak_bonus_{user_id}_{org_id}_{streak_type}_{new_streak}_{current_date}",
                metadata={
                    "streak_type": streak_type.value,
                    "milestone": new_streak,
                },
            )

            await award_xp(user_id, org_id, bonus_request, db_session)

        # Invalidate caches (profile + relevant leaderboard variants for streaks)
        CacheManager.delete(f"gamification:profile:{org_id}:{user_id}")
        CacheManager.delete_pattern(f"gamification:leaderboard:{org_id}:streaks:*")

        logger.info(
            f"Updated {streak_type} streak for user {user_id} in org {org_id}: {new_streak} days"
        )

        return profile

    except Exception as e:
        db_session.rollback()
        logger.exception(
            f"Failed to update streak for user {user_id} in org {org_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update streak",
        )


# ============================================================================
# Achievement System
# ============================================================================


async def check_and_award_achievements(
    user_id: int,
    org_id: int,
    profile: UserGamificationProfile,
    transaction: XPTransaction | None,
    db_session: Session,
) -> list[str]:
    """
    Check and award new achievements for user.
    Returns list of newly unlocked achievement keys.
    """
    newly_unlocked: list[str] = []

    try:
        # Fetch active achievements once
        achievements_stmt = select(Achievement).where(
            and_(Achievement.is_active == True, Achievement.org_id == org_id)  # noqa: E712
        )
        all_achievements = db_session.exec(achievements_stmt).all()

        # Determine already unlocked achievement IDs for user
        existing_achievements_stmt = select(UserAchievement.achievement_id).where(
            and_(UserAchievement.user_id == user_id, UserAchievement.org_id == org_id)
        )
        existing_ids = {row[0] for row in db_session.exec(existing_achievements_stmt)}

        # Buffer to award XP after persistence (avoid nested partial commits)
        reward_requests: list[tuple[Achievement, XPAwardRequest]] = []

        for achievement in all_achievements:
            if achievement.id in existing_ids:
                continue

            if await check_achievement_requirements(
                achievement, profile, transaction, db_session
            ):
                # Persist unlocked achievement
                ua = UserAchievement(
                    user_id=user_id,
                    org_id=org_id,
                    achievement_id=achievement.id,
                    progress_percent=100.0,
                    is_unlocked=True,
                    unlocked_at=now_local(),
                    progress_data={},
                )
                db_session.add(ua)
                newly_unlocked.append(achievement.achievement_key)

                if achievement.xp_reward > 0:
                    reward_requests.append(
                        (
                            achievement,
                            XPAwardRequest(
                                user_id=user_id,
                                source=XPSource.MILESTONE_ACHIEVEMENT,
                                source_id=f"achievement_{achievement.achievement_key}",
                                custom_amount=achievement.xp_reward,
                                idempotency_key=(
                                    f"achievement_{user_id}_{org_id}_{achievement.achievement_key}"
                                ),
                                metadata={
                                    "achievement_key": achievement.achievement_key,
                                    "achievement_type": achievement.achievement_type.value,
                                },
                            ),
                        )
                    )

        if newly_unlocked:
            # Commit unlocked achievements first so they are persisted before XP award
            db_session.commit()

            # Bundle XP to avoid multiple award_xp calls & cap fragmentation
            total_reward_xp = sum(a.xp_reward for a, _req in reward_requests)

            # Fetch fresh profile snapshot to determine remaining daily capacity
            profile = await get_or_create_profile(user_id, org_id, db_session)
            remaining_daily = max(0, profile.daily_xp_limit - profile.daily_xp_earned)

            if total_reward_xp <= remaining_daily and total_reward_xp > 0:
                # Single bundled award
                bundled_request = XPAwardRequest(
                    user_id=user_id,
                    source=XPSource.MILESTONE_ACHIEVEMENT,
                    source_id=f"achievement_bundle_{uuid.uuid4().hex[:8]}",
                    custom_amount=total_reward_xp,
                    idempotency_key=f"achievement_bundle_{user_id}_{org_id}_{'-'.join(sorted(newly_unlocked))}",
                    metadata={
                        "achievement_keys": newly_unlocked,
                        "bundled": True,
                        "count": len(newly_unlocked),
                        "total_reward_xp": total_reward_xp,
                    },
                )
                try:
                    await award_xp(user_id, org_id, bundled_request, db_session)
                except Exception as e:  # Fallback to sequential if bundle fails
                    logger.warning(
                        "Bundled achievement XP award failed (%s). Falling back sequential.",
                        e,
                    )
                    await _award_achievements_sequential(
                        user_id, org_id, reward_requests, db_session
                    )
            else:
                # Either no remaining capacity or bundle exceeds remaining daily XP.
                # Fallback: sequential truncated distribution until cap reached.
                await _award_achievements_sequential(
                    user_id, org_id, reward_requests, db_session, remaining_daily
                )

            logger.info(
                "Unlocked achievements for user %s in org %s (bundled=%s): %s",
                user_id,
                org_id,
                total_reward_xp <= remaining_daily,
                newly_unlocked,
            )

        return newly_unlocked
    except Exception as e:  # pragma: no cover
        logger.exception(f"Failed to check achievements for user {user_id}: {e}")
        return []


async def _award_achievements_sequential(
    user_id: int,
    org_id: int,
    reward_requests: list[tuple[Achievement, XPAwardRequest]],
    db_session: Session,
    remaining_daily: int | None = None,
) -> None:
    """Sequentially award achievement XP respecting remaining daily cap.

    If remaining_daily provided, stop once exhausted; truncated awards skipped silently.
    Each request already has idempotency protection.
    """
    if not reward_requests:
        return

    for achievement, reward_request in reward_requests:
        if remaining_daily is not None:
            if remaining_daily <= 0:
                logger.info(
                    "Daily cap exhausted while awarding achievements for user %s",
                    user_id,
                )
                break
            # Clamp custom_amount to remaining_daily
            if (
                reward_request.custom_amount
                and reward_request.custom_amount > remaining_daily
            ):
                reward_request.custom_amount = remaining_daily
        try:
            await award_xp(user_id, org_id, reward_request, db_session)
            if remaining_daily is not None and reward_request.custom_amount:
                remaining_daily -= reward_request.custom_amount
        except HTTPException as he:  # pragma: no cover - runtime-specific
            if he.status_code not in {
                status.HTTP_409_CONFLICT,
                status.HTTP_429_TOO_MANY_REQUESTS,
            }:
                logger.warning(
                    "Failed sequential achievement XP award for user %s achievement %s: %s",
                    user_id,
                    achievement.achievement_key,
                    he.detail,
                )
        except Exception as e:  # pragma: no cover
            logger.exception(
                f"Unexpected error in sequential achievement award for user {user_id}: {e}"
            )


async def check_achievement_requirements(
    achievement: Achievement,
    profile: UserGamificationProfile,
    transaction: XPTransaction | None,
    db_session: Session,
) -> bool:
    """Check if achievement requirements are satisfied."""
    requirements = achievement.requirements or {}

    try:
        # Level-based achievements
        if achievement.achievement_type == AchievementType.LEVEL_MILESTONE:
            required_level = int(requirements.get("level", 0))
            return profile.current_level >= required_level

        # Streak-based achievements
        if achievement.achievement_type == AchievementType.STREAK_MILESTONE:
            streak_type = requirements.get("streak_type", "login")
            required_streak = int(requirements.get("streak_count", 0))
            if streak_type == "login":
                return profile.current_login_streak >= required_streak
            if streak_type == "learning":
                return profile.current_learning_streak >= required_streak
            return getattr(profile, "current_daily_goal_streak", 0) >= required_streak

        # Course mastery achievements
        if achievement.achievement_type == AchievementType.COURSE_MASTERY:
            required_courses = int(requirements.get("courses_completed", 0))
            return profile.total_courses_completed >= required_courses

        # Activity completion achievements
        if achievement.achievement_type == AchievementType.PERFECT_STUDENT:
            required_activities = int(requirements.get("activities_completed", 0))
            return profile.total_activities_completed >= required_activities

        # XP-based achievements
        if achievement.achievement_type == AchievementType.SOCIAL_ENGAGEMENT:
            required_xp = int(requirements.get("total_xp", 0))
            return profile.total_xp >= required_xp

        return False

    except Exception as e:
        logger.warning(
            f"Failed to check requirements for achievement {achievement.achievement_key}: {e}"
        )
        return False


# ============================================================================
# Dashboard and Analytics
# ============================================================================


async def get_gamification_dashboard(
    user_id: int, org_id: int, db_session: Session
) -> GamificationDashboard:
    """
    Get comprehensive gamification dashboard data.
    Server-side aggregation with caching.
    """
    cache_key = f"gamification:dashboard:{org_id}:{user_id}"

    # Try cache first
    cached_data = CacheManager.get(cache_key)
    if cached_data:
        try:
            return GamificationDashboard(**cached_data)
        except Exception as e:
            logger.warning(f"Failed to deserialize cached dashboard: {e}")

    try:
        # Get profile
        profile = await get_or_create_profile(user_id, org_id, db_session)

        # Get recent transactions (last 10)
        transactions_stmt = (
            select(XPTransaction)
            .where(
                and_(XPTransaction.user_id == user_id, XPTransaction.org_id == org_id)
            )
            .order_by(desc(XPTransaction.created_at))
            .limit(10)
        )
        recent_transactions = db_session.exec(transactions_stmt).all()

        # Get daily XP history (last 30 days)
        # Business analytics period anchored to local timezone midnight
        thirty_days_ago = now_local() - timedelta(days=30)
        # Bind parameters explicitly because sqlmodel Session.exec only accepts a single positional argument
        daily_xp_stmt = text(
            """
                SELECT
                    DATE(created_at) as date,
                    SUM(xp_amount) as total_xp,
                    COUNT(*) as transaction_count
                FROM xp_transactions
                WHERE user_id = :user_id
                    AND org_id = :org_id
                    AND created_at >= :start_date
                GROUP BY DATE(created_at)
                ORDER BY date DESC
                """
        ).bindparams(user_id=user_id, org_id=org_id, start_date=thirty_days_ago)

        daily_xp_result = db_session.exec(daily_xp_stmt).all()

        daily_xp_history = [
            {"date": str(row[0]), "xp": row[1], "transactions": row[2]}
            for row in daily_xp_result
        ]

        # Calculate streak status
        streak_status = {
            "login": {
                "current": profile.current_login_streak,
                "longest": profile.longest_login_streak,
                "last_activity": profile.last_login_date.isoformat()
                if profile.last_login_date
                else None,
                "status": _get_streak_status(profile.last_login_date),
            },
            "learning": {
                "current": profile.current_learning_streak,
                "longest": profile.longest_learning_streak,
                "last_activity": profile.last_learning_activity_date.isoformat()
                if profile.last_learning_activity_date
                else None,
                "status": _get_streak_status(profile.last_learning_activity_date),
            },
        }

        # Get user achievements
        achievements_stmt = (
            select(UserAchievement, Achievement)
            .join(Achievement, Achievement.id == UserAchievement.achievement_id)
            .where(
                and_(
                    UserAchievement.user_id == user_id,
                    UserAchievement.org_id == org_id,
                    UserAchievement.is_unlocked == True,  # noqa: E712
                )
            )
            .order_by(desc(UserAchievement.unlocked_at))
        )
        user_achievements = db_session.exec(achievements_stmt).all()
        achievements_data = {
            "total": len(user_achievements),
            "recent": [
                {
                    "key": ach.achievement_key,
                    "title": ach.title,
                    "type": ach.achievement_type.value,
                    "xp_reward": ach.xp_reward,
                    "unlocked_at": ua.unlocked_at.isoformat()
                    if ua.unlocked_at
                    else None,
                }
                for ua, ach in user_achievements[:5]
            ],
        }

        # Get leaderboard position
        leaderboard_position = await get_user_leaderboard_position(
            user_id, org_id, db_session
        )

        # Calculate next level preview using current total_xp + remaining to next level
        future_total_xp = profile.total_xp + profile.xp_to_next_level
        next_level, *_ = calculate_level_details(future_total_xp)
        next_level_preview = {
            "level": next_level,
            "xp_required": profile.xp_to_next_level,
            "unlocks": _get_level_unlocks(next_level),
        }

        # Calculate daily progress
        daily_progress = {
            "xp_earned": profile.daily_xp_earned,
            "xp_limit": profile.daily_xp_limit,
            "goal_xp": profile.daily_goal_xp,
            "goal_progress": min(
                100.0, (profile.daily_xp_earned / profile.daily_goal_xp) * 100.0
            )
            if profile.daily_goal_xp > 0
            else 0.0,
            "limit_progress": (profile.daily_xp_earned / profile.daily_xp_limit) * 100.0
            if profile.daily_xp_limit > 0
            else 0.0,
        }

        # Build dashboard (model expects 'recent_xp_transactions')
        dashboard = GamificationDashboard(
            profile=UserGamificationProfileRead.model_validate(
                profile, from_attributes=True
            ),
            recent_xp_transactions=[
                XPTransactionRead.model_validate(tx, from_attributes=True)
                for tx in recent_transactions
            ],
            daily_xp_history=daily_xp_history,
            streak_status=streak_status,
            achievements=achievements_data,
            leaderboard_position=leaderboard_position,
            next_level_preview=next_level_preview,
            daily_progress=daily_progress,
        )

        # Cache result
        CacheManager.set(
            cache_key, dashboard.model_dump(), GamificationConfig.CACHE_TTL_DASHBOARD
        )

        return dashboard

    except Exception as e:
        logger.exception(
            f"Failed to get dashboard for user {user_id} in org {org_id}: {e}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load gamification dashboard",
        )


# ============================================================================
# Leaderboard System
# ============================================================================


async def get_organization_leaderboard(
    org_id: int,
    db_session: Session,
    leaderboard_type: str = "xp",
    period: str = "all_time",
    limit: int = 50,
    current_user_id: int | None = None,
) -> OrganizationLeaderboard:
    """
    Get organization leaderboard with server-side ranking.
    Uses cached snapshots for performance.
    """
    cache_key = f"gamification:leaderboard:{org_id}:{leaderboard_type}:{period}:{limit}"

    # Try cache first
    cached_data = CacheManager.get(cache_key)
    if cached_data:
        try:
            leaderboard = OrganizationLeaderboard(**cached_data)
            # Still need to get current user rank if requested
            if current_user_id:
                leaderboard.current_user_rank = await get_user_leaderboard_position(
                    current_user_id, org_id, db_session
                )
            return leaderboard
        except Exception as e:
            logger.warning(f"Failed to deserialize cached leaderboard: {e}")

    try:
        # Build query based on type and period
        if leaderboard_type == "xp":
            base_stmt = (
                select(
                    UserGamificationProfile.user_id,
                    UserGamificationProfile.total_xp,
                    UserGamificationProfile.current_level,
                    UserGamificationProfile.current_login_streak,
                    UserGamificationProfile.current_learning_streak,
                )
                .where(UserGamificationProfile.org_id == org_id)
                .order_by(
                    desc(UserGamificationProfile.total_xp),
                    desc(UserGamificationProfile.current_level),
                )
                .limit(limit)
            )
        elif leaderboard_type == "streaks":
            base_stmt = (
                select(
                    UserGamificationProfile.user_id,
                    UserGamificationProfile.current_login_streak,
                    UserGamificationProfile.current_learning_streak,
                    UserGamificationProfile.total_xp,
                    UserGamificationProfile.current_level,
                )
                .where(UserGamificationProfile.org_id == org_id)
                .order_by(
                    desc(UserGamificationProfile.current_learning_streak),
                    desc(UserGamificationProfile.current_login_streak),
                )
                .limit(limit)
            )
        else:  # achievements
            base_stmt = text(
                """
                SELECT
                    ugp.user_id,
                    COUNT(ua.id) as achievement_count,
                    ugp.total_xp,
                    ugp.current_level
                FROM user_gamification_profiles ugp
                LEFT JOIN user_achievements ua ON ua.user_id = ugp.user_id AND ua.org_id = ugp.org_id
                WHERE ugp.org_id = :org_id
                GROUP BY ugp.user_id, ugp.total_xp, ugp.current_level
                ORDER BY achievement_count DESC, ugp.total_xp DESC
                LIMIT :limit
                """
            ).bindparams(org_id=org_id, limit=limit)

        # Execute query (already bound params for TextClause; ORM select has none)
        results = db_session.exec(base_stmt).all()

        # Get total participants
        total_stmt = (
            select(func.count())
            .select_from(UserGamificationProfile)
            .where(UserGamificationProfile.org_id == org_id)
        )
        total_participants = db_session.exec(total_stmt).one()

        # Format entries
        entries = []
        for rank, result in enumerate(results, 1):
            if leaderboard_type == "xp":
                entries.append(
                    {
                        "rank": rank,
                        "user_id": result[0],
                        "total_xp": result[1],
                        "current_level": result[2],
                        "current_login_streak": result[3],
                        "current_learning_streak": result[4],
                    }
                )
            elif leaderboard_type == "streaks":
                entries.append(
                    {
                        "rank": rank,
                        "user_id": result[0],
                        "current_login_streak": result[1],
                        "current_learning_streak": result[2],
                        "total_xp": result[3],
                        "current_level": result[4],
                    }
                )
            else:  # achievements
                entries.append(
                    {
                        "rank": rank,
                        "user_id": result[0],
                        "achievement_count": result[1],
                        "total_xp": result[2],
                        "current_level": result[3],
                    }
                )

        # Get current user rank if requested
        current_user_rank = None
        if current_user_id:
            current_user_rank = await get_user_leaderboard_position(
                current_user_id, org_id, db_session
            )

        # Build leaderboard
        leaderboard = OrganizationLeaderboard(
            org_id=org_id,
            leaderboard_type=leaderboard_type,
            period=period,
            leaderboard_entries=entries,
            total_participants=total_participants,
            current_user_rank=current_user_rank,
            last_updated=now_local(),
        )

        # Cache result
        CacheManager.set(
            cache_key,
            leaderboard.model_dump(),
            GamificationConfig.CACHE_TTL_LEADERBOARD,
        )

        return leaderboard

    except Exception as e:
        logger.exception(f"Failed to get leaderboard for org {org_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load leaderboard",
        )


async def get_user_leaderboard_position(
    user_id: int, org_id: int, db_session: Session
) -> int | None:
    """Get user's position in the XP leaderboard."""
    try:
        # Count users with higher XP
        rank_stmt = text("""
            SELECT COUNT(*) + 1 as rank
            FROM user_gamification_profiles ugp1
            INNER JOIN user_gamification_profiles ugp2 ON ugp2.org_id = :org_id AND ugp2.user_id = :user_id
            WHERE ugp1.org_id = :org_id
                AND (ugp1.total_xp > ugp2.total_xp
                     OR (ugp1.total_xp = ugp2.total_xp AND ugp1.current_level > ugp2.current_level)
                     OR (ugp1.total_xp = ugp2.total_xp AND ugp1.current_level = ugp2.current_level AND ugp1.user_id < ugp2.user_id))
        """)
        # Bind params explicitly; sqlmodel Session.exec accepts a single statement argument
        bound_stmt = rank_stmt.bindparams(org_id=org_id, user_id=user_id)
        result = db_session.exec(bound_stmt).first()
        return result[0] if result else None

    except Exception as e:
        logger.warning(f"Failed to get leaderboard position for user {user_id}: {e}")
        return None


# ============================================================================
# Helper Functions
# ============================================================================


def _get_streak_status(last_date: datetime | None) -> str:
    """Get streak status string."""
    if not last_date:
        return "none"

    now = now_local()
    days_since = (now.date() - last_date.date()).days

    if days_since == 0:
        return "active"
    if days_since == 1:
        return "at_risk"
    return "broken"


def _get_level_unlocks(level: int) -> list[str]:
    """Get unlocks available at a specific level."""

    # Define level-based unlocks
    level_unlocks = {
        5: ["Avatar Frames"],
        10: ["Custom Avatar"],
        15: ["Special Themes"],
        20: ["Achievement Showcase"],
        25: ["Custom Titles"],
        30: ["Advanced Statistics"],
        40: ["Mentor Badge"],
        50: ["Legendary Status"],
    }

    return level_unlocks.get(level, [])


# ============================================================================
# Public API Functions
# ============================================================================


# Login streak update (called on user login)
async def update_login_streak(
    user_id: int, org_id: int, db_session: Session, request: Request | None = None
) -> UserGamificationProfile:
    """Update user's login streak and award daily login XP."""
    profile = await update_streak(user_id, org_id, StreakType.LOGIN, db_session)

    # Award daily login XP (idempotent)
    current_date = today_local()
    login_request = XPAwardRequest(
        user_id=user_id,
        source=XPSource.LOGIN_BONUS,
        idempotency_key=f"daily_login_{user_id}_{org_id}_{current_date}",
        metadata={"login_time": now_local().isoformat()},
    )

    try:
        await award_xp(user_id, org_id, login_request, db_session, request)
    except HTTPException as e:
        # Ignore if already awarded today
        if e.status_code != status.HTTP_409_CONFLICT:
            raise

    return profile


# Learning streak update (called on activity completion)
async def update_learning_streak(
    user_id: int, org_id: int, db_session: Session, activity_id: str | None = None
) -> UserGamificationProfile:
    """Update user's learning streak."""
    metadata = {"activity_id": activity_id} if activity_id else None
    return await update_streak(
        user_id, org_id, StreakType.LEARNING, db_session, metadata
    )


# Main service functions that will be called from routers
__all__ = [
    "GamificationConfig",
    "award_xp",
    "get_gamification_dashboard",
    "get_or_create_profile",
    "get_organization_leaderboard",
    "update_learning_streak",
    "update_login_streak",
]
