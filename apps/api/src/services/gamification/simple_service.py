"""
Clean Gamification Service - Simple and Focused

Direct approach without over-engineering:
- Single service class
- Clear error handling
- Minimal abstractions
"""

from datetime import UTC, datetime
from typing import List, Optional, Tuple

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, and_, select

from src.db.gamification import (
    DAILY_XP_LIMIT,
    XP_REWARDS,
    GamificationProfile,
    StreakType,
    XPSource,
    XPTransaction,
    calculate_level,
)


class GamificationError(Exception):
    """Base gamification error"""


class DailyLimitExceededError(GamificationError):
    """Daily XP limit exceeded"""


def get_profile(db: Session, user_id: int, org_id: int) -> GamificationProfile:
    """Get or create user profile - simplified"""
    stmt = select(GamificationProfile).where(
        and_(
            GamificationProfile.user_id == user_id, GamificationProfile.org_id == org_id
        )
    )
    profile = db.exec(stmt).first()

    if not profile:
        profile = GamificationProfile(user_id=user_id, org_id=org_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)

    return profile


def award_xp(
    db: Session,
    user_id: int,
    org_id: int,
    source: str,
    amount: int | None = None,
    source_id: str | None = None,
    idempotency_key: str | None = None,
) -> tuple[GamificationProfile, bool]:
    """Award XP to user - returns (profile, level_up_occurred)"""
    try:
        profile = get_profile(db, user_id, org_id)

        # Determine XP amount
        if amount is None:
            amount = XP_REWARDS.get(source, 0)

        if amount <= 0:
            msg = f"Invalid XP amount: {amount}"
            raise GamificationError(msg)

        # Check daily limit (except admin awards)
        if source != XPSource.ADMIN_AWARD and _exceeds_daily_limit(profile, amount):
            msg = "Daily XP limit exceeded"
            raise DailyLimitExceededError(msg)

        # Check for duplicate transaction
        if _is_duplicate(db, user_id, org_id, source, source_id, idempotency_key):
            return profile, False

        # Calculate level before XP award
        old_level = profile.level

        # Update profile
        profile.total_xp += amount
        profile.level = calculate_level(profile.total_xp)
        profile.updated_at = datetime.now(UTC)

        # Update daily tracking
        _update_daily_tracking(profile, amount)

        # Create transaction record
        transaction = XPTransaction(
            user_id=user_id,
            org_id=org_id,
            amount=amount,
            source=XPSource(source),
            source_id=source_id,
            previous_level=old_level,
            triggered_level_up=(profile.level > old_level),
            idempotency_key=idempotency_key,
        )

        db.add(transaction)
        db.commit()
        db.refresh(profile)

        return profile, profile.level > old_level

    except IntegrityError as e:
        db.rollback()
        if "idempotency_key" in str(e):
            return get_profile(db, user_id, org_id), False
        msg = f"Database error: {e}"
        raise GamificationError(msg)
    except Exception:
        db.rollback()
        raise


def update_streak(
    db: Session, user_id: int, org_id: int, streak_type: str
) -> GamificationProfile:
    """Update user streak"""
    profile = get_profile(db, user_id, org_id)
    now = datetime.now(UTC)
    today = now.date()

    if streak_type == StreakType.LOGIN:
        last_date = profile.last_login_date
        current_streak = profile.login_streak
        profile.last_login_date = now
    elif streak_type == StreakType.LEARNING:
        last_date = profile.last_learning_date
        current_streak = profile.learning_streak
        profile.last_learning_date = now
    else:
        msg = f"Invalid streak type: {streak_type}"
        raise GamificationError(msg)

    # Calculate new streak
    if last_date:
        days_since = (today - last_date.date()).days
        if days_since == 0:
            new_streak = current_streak
        elif days_since == 1:
            new_streak = current_streak + 1
        else:
            new_streak = 1
    else:
        new_streak = 1

    # Update profile
    if streak_type == StreakType.LOGIN:
        profile.login_streak = new_streak
        profile.longest_login_streak = max(profile.longest_login_streak, new_streak)
    else:
        profile.learning_streak = new_streak
        profile.longest_learning_streak = max(
            profile.longest_learning_streak, new_streak
        )

    profile.updated_at = now
    db.commit()
    db.refresh(profile)

    return profile


def get_leaderboard(
    db: Session, org_id: int, limit: int = 10
) -> list[GamificationProfile]:
    """Get organization leaderboard"""
    stmt = (
        select(GamificationProfile)
        .where(GamificationProfile.org_id == org_id)
        .order_by(GamificationProfile.total_xp.desc())
        .limit(limit)
    )
    return list(db.exec(stmt).all())


def get_recent_transactions(
    db: Session, user_id: int, org_id: int, limit: int = 10
) -> list[XPTransaction]:
    """Get user's recent transactions"""
    stmt = (
        select(XPTransaction)
        .where(and_(XPTransaction.user_id == user_id, XPTransaction.org_id == org_id))
        .order_by(XPTransaction.created_at.desc())
        .limit(limit)
    )
    return list(db.exec(stmt).all())


def get_dashboard_data(db: Session, user_id: int, org_id: int) -> dict:
    """Get complete dashboard data in one call - eliminates multiple API requests"""
    profile = get_profile(db, user_id, org_id)
    transactions = get_recent_transactions(db, user_id, org_id, limit=10)
    leaderboard = get_leaderboard(db, org_id, limit=10)

    # Calculate user's rank
    rank_stmt = (
        select(GamificationProfile.user_id)
        .where(GamificationProfile.org_id == org_id)
        .order_by(GamificationProfile.total_xp.desc())
    )
    all_profiles = list(db.exec(rank_stmt).all())
    user_rank = next((i + 1 for i, p in enumerate(all_profiles) if p == user_id), None)

    return {
        "profile": profile,
        "recent_transactions": transactions,
        "leaderboard": leaderboard,
        "user_rank": user_rank,
        "streak_info": {
            "login_streak": profile.login_streak,
            "learning_streak": profile.learning_streak,
            "longest_login_streak": profile.longest_login_streak,
            "longest_learning_streak": profile.longest_learning_streak,
        },
    }


# Helper functions
def _exceeds_daily_limit(profile: GamificationProfile, amount: int) -> bool:
    """Check if adding amount would exceed daily limit"""
    today = datetime.now(UTC).date()
    if profile.last_xp_award_date and profile.last_xp_award_date.date() == today:
        return (profile.daily_xp_earned + amount) > DAILY_XP_LIMIT
    return amount > DAILY_XP_LIMIT


def _is_duplicate(
    db: Session,
    user_id: int,
    org_id: int,
    source: str,
    source_id: str | None,
    idempotency_key: str | None,
) -> bool:
    """Check for duplicate transaction"""
    if idempotency_key:
        stmt = select(XPTransaction).where(
            and_(
                XPTransaction.user_id == user_id,
                XPTransaction.org_id == org_id,
                XPTransaction.idempotency_key == idempotency_key,
            )
        )
        return db.exec(stmt).first() is not None

    if source_id:
        stmt = select(XPTransaction).where(
            and_(
                XPTransaction.user_id == user_id,
                XPTransaction.org_id == org_id,
                XPTransaction.source == source,
                XPTransaction.source_id == source_id,
            )
        )
        return db.exec(stmt).first() is not None

    return False


def _update_daily_tracking(profile: GamificationProfile, amount: int) -> None:
    """Update daily XP tracking"""
    now = datetime.now(UTC)
    today = now.date()

    if profile.last_xp_award_date and profile.last_xp_award_date.date() == today:
        profile.daily_xp_earned += amount
    else:
        profile.daily_xp_earned = amount

    profile.last_xp_award_date = now
