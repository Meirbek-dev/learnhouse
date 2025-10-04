"""
Gamification Service - cohesive business logic layer

Responsibilities:
- Idempotent, atomic XP awards with daily caps and level computation
- Streak updates and counters
- Leaderboard, dashboard aggregation, rank
- Preference updates
- Emits domain events via EventPublisher

Notes:
- Policy (rewards/daily limit) resolution is handled via PolicyRepo with a TTL cache
"""

from __future__ import annotations

import contextlib
import logging
from datetime import datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, and_, select

from src.core.timezone import now as tz_now
from src.db.gamification import (
    GamificationProfile,
    StreakType,
    XPSource,
    XPTransaction,
    calculate_level,
)
from src.services.gamification.policy import get_org_policy


class GamificationError(Exception):
    """Base gamification error"""


class DailyLimitExceededError(GamificationError):
    """Daily XP limit exceeded"""


def _exceeds_daily_limit(
    profile: GamificationProfile, amount: int, daily_limit: int
) -> bool:
    # Non-positive limit means "unlimited" (ignore). This also safeguards against
    # transient misconfiguration cached in policy.
    if daily_limit <= 0:
        return False
    today = tz_now().date()
    if profile.last_xp_award_date and profile.last_xp_award_date.date() == today:
        return (profile.daily_xp_earned + amount) > daily_limit
    return amount > daily_limit


def _update_daily_tracking_with_policy(
    profile: GamificationProfile, amount: int, now: datetime
) -> None:
    today = now.date()
    if profile.last_xp_award_date and profile.last_xp_award_date.date() == today:
        profile.daily_xp_earned += amount
    else:
        profile.daily_xp_earned = amount
    profile.last_xp_award_date = now


def get_profile(db: Session, user_id: int, org_id: int) -> GamificationProfile:
    stmt = select(GamificationProfile).where(
        and_(
            GamificationProfile.user_id == user_id, GamificationProfile.org_id == org_id
        )
    )
    # Removed with_for_update() lock to prevent hanging on new user creation
    # The unique constraint on (user_id, org_id) handles concurrency
    profile = db.exec(stmt).first()
    if not profile:
        profile = GamificationProfile(user_id=user_id, org_id=org_id)
        db.add(profile)
        try:
            db.commit()
            db.refresh(profile)
        except IntegrityError:
            # Handle race condition: another request created the profile
            db.rollback()
            profile = db.exec(stmt).first()
            if not profile:
                # If still not found, re-raise the error
                raise
    return profile


def award_xp(
    db: Session,
    user_id: int,
    org_id: int,
    source: str,
    amount: int | None = None,
    source_id: str | None = None,
    idempotency_key: str | None = None,
):
    """Award XP atomically and idempotently.

    Returns (profile, transaction, level_up_occurred, is_new_transaction).
    """
    now = tz_now()
    try:
        try:
            xp_source = XPSource(source)
        except ValueError:
            msg = f"Invalid XP source: {source}"
            raise GamificationError(msg)

        rewards, daily_limit = get_org_policy(db, org_id)
        resolved_amount = (
            amount if amount is not None else rewards.get(xp_source.value, 0)
        )
        if resolved_amount <= 0:
            msg = f"Invalid XP amount: {resolved_amount}"
            raise GamificationError(msg)

        pre_profile = get_profile(db, user_id, org_id)
        old_level = pre_profile.level
        tx = XPTransaction(
            user_id=user_id,
            org_id=org_id,
            amount=resolved_amount,
            source=xp_source,
            source_id=source_id,
            previous_level=old_level,
            triggered_level_up=False,
            idempotency_key=idempotency_key,
        )
        db.add(tx)
        db.flush()

        profile = get_profile(db, user_id, org_id)
        if xp_source != XPSource.ADMIN_AWARD and _exceeds_daily_limit(
            profile, resolved_amount, daily_limit
        ):
            msg = "Daily XP limit exceeded"
            raise DailyLimitExceededError(msg)

        profile.total_xp += resolved_amount
        profile.level = calculate_level(profile.total_xp)
        profile.updated_at = now
        _update_daily_tracking_with_policy(profile, resolved_amount, now)

        tx.triggered_level_up = profile.level > old_level

        db.commit()
        db.refresh(profile)
        return profile, tx, tx.triggered_level_up, True
    except IntegrityError as e:
        db.rollback()
        if any(
            s in str(e).lower()
            for s in ["uq_xp_tx_user_org_source_once", "idempotency_key", "unique"]
        ):
            profile = get_profile(db, user_id, org_id)
            stmt = None
            if idempotency_key:
                stmt = select(XPTransaction).where(
                    and_(
                        XPTransaction.user_id == user_id,
                        XPTransaction.org_id == org_id,
                        XPTransaction.idempotency_key == idempotency_key,
                    )
                )
            elif source_id is not None:
                try:
                    xp_source = XPSource(source)
                except Exception:
                    xp_source = None  # type: ignore[assignment]
                if xp_source is not None:
                    stmt = select(XPTransaction).where(
                        and_(
                            XPTransaction.user_id == user_id,
                            XPTransaction.org_id == org_id,
                            XPTransaction.source == xp_source,
                            XPTransaction.source_id == source_id,
                        )
                    )
            existing_tx = db.exec(stmt).first() if stmt is not None else None
            if existing_tx is None:
                existing_tx = db.exec(
                    select(XPTransaction)
                    .where(
                        and_(
                            XPTransaction.user_id == user_id,
                            XPTransaction.org_id == org_id,
                        )
                    )
                    .order_by(XPTransaction.created_at.desc())
                ).first()
            if existing_tx is None:
                msg = "Transaction not found after idempotent insert"
                raise GamificationError(msg)
            return profile, existing_tx, False, False
        msg = f"Database error: {e}"
        raise GamificationError(msg)
    except Exception:
        db.rollback()
        raise


def update_streak(
    db: Session, user_id: int, org_id: int, streak_type: str
) -> GamificationProfile:
    profile = get_profile(db, user_id, org_id)
    now = tz_now()
    today = now.date()
    try:
        s_type = StreakType(streak_type)
    except ValueError:
        msg = f"Invalid streak type: {streak_type}"
        raise GamificationError(msg)

    if s_type == StreakType.LOGIN:
        last_date = profile.last_login_date
        current_streak = profile.login_streak
        profile.last_login_date = now
    else:
        last_date = profile.last_learning_date
        current_streak = profile.learning_streak
        profile.last_learning_date = now

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

    if s_type == StreakType.LOGIN:
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
    db: Session, org_id: int, limit: int = 10, offset: int = 0
) -> list[GamificationProfile]:
    stmt = (
        select(GamificationProfile)
        .where(GamificationProfile.org_id == org_id)
        .order_by(GamificationProfile.total_xp.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.exec(stmt).all())


def get_recent_transactions(
    db: Session, user_id: int, org_id: int, limit: int = 10
) -> list[XPTransaction]:
    stmt = (
        select(XPTransaction)
        .where(and_(XPTransaction.user_id == user_id, XPTransaction.org_id == org_id))
        .order_by(XPTransaction.created_at.desc())
        .limit(limit)
    )
    return list(db.exec(stmt).all())


def get_dashboard_data(db: Session, user_id: int, org_id: int) -> dict:
    profile = get_profile(db, user_id, org_id)
    transactions = get_recent_transactions(db, user_id, org_id, limit=10)
    leaderboard = get_leaderboard(db, org_id, limit=10)

    user_xp = profile.total_xp
    _res = db.exec(
        select(func.count())
        .select_from(GamificationProfile)
        .where(
            and_(
                GamificationProfile.org_id == org_id,
                GamificationProfile.total_xp > user_xp,
            )
        )
    )
    try:
        higher_count = int(_res.scalar_one())  # type: ignore[attr-defined]
    except Exception:
        try:
            _one = _res.one()
            higher_count = int(_one if isinstance(_one, (int, float)) else _one[0])
        except Exception:
            _first = _res.first()
            higher_count = int(
                _first
                if isinstance(_first, (int, float))
                else (_first[0] if _first else 0)
            )
    user_rank = higher_count + 1 if profile else None

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


def update_preferences(
    db: Session, user_id: int, org_id: int, updates: dict[str, Any]
) -> GamificationProfile:
    """Merge and persist profile preferences, returning updated profile.

    - Non-dict values in updates are ignored
    - None values remove keys from preferences
    """
    profile = get_profile(db, user_id, org_id)
    prefs = dict(profile.preferences or {})
    for k, v in updates.items():
        if v is None:
            prefs.pop(k, None)
        else:
            prefs[k] = v
    profile.preferences = prefs
    profile.updated_at = tz_now()
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def get_leaderboard_read(db: Session, org_id: int, limit: int = 10, offset: int = 0):
    """Return typed LeaderboardRead including total participants and usernames."""
    from src.db.gamification import LeaderboardEntryRead, LeaderboardRead
    from src.db.users import User as DBUser

    profiles = get_leaderboard(db, org_id, limit=limit, offset=offset)
    # total participants
    _res = db.exec(
        select(func.count())
        .select_from(GamificationProfile)
        .where(GamificationProfile.org_id == org_id)
    )
    try:
        total = int(_res.scalar_one())  # type: ignore[attr-defined]
    except Exception:
        try:
            _one = _res.one()
            total = int(_one if isinstance(_one, (int, float)) else _one[0])
        except Exception:
            _first = _res.first()
            total = int(
                _first
                if isinstance(_first, (int, float))
                else (_first[0] if _first else 0)
            )

    ids = [p.user_id for p in profiles]
    user_map: dict[int, DBUser] = {}
    if ids:
        try:
            users = db.exec(select(DBUser).where(DBUser.id.in_(ids))).all()  # type: ignore[arg-type]
            user_map = {u.id: u for u in users}
        except Exception:
            user_map = {}

    entries = [
        LeaderboardEntryRead(
            rank=offset + i + 1,
            user_id=p.user_id,
            total_xp=p.total_xp,
            level=p.level,
            username=(
                user_map.get(p.user_id).username if user_map.get(p.user_id) else None
            ),
        )
        for i, p in enumerate(profiles)
    ]
    return LeaderboardRead(org_id=org_id, entries=entries, total_participants=total)


def get_user_rank(db: Session, user_id: int, org_id: int) -> int | None:
    profile = get_profile(db, user_id, org_id)
    if not profile:
        return None
    _res = db.exec(
        select(func.count())
        .select_from(GamificationProfile)
        .where(
            and_(
                GamificationProfile.org_id == org_id,
                GamificationProfile.total_xp > profile.total_xp,
            )
        )
    )
    try:
        higher_count = int(_res.scalar_one())  # type: ignore[attr-defined]
    except Exception:
        try:
            _one = _res.one()
            higher_count = int(_one if isinstance(_one, (int, float)) else _one[0])
        except Exception:
            _first = _res.first()
            higher_count = int(
                _first
                if isinstance(_first, (int, float))
                else (_first[0] if _first else 0)
            )
    return higher_count + 1


def on_activity_completed(
    db: Session,
    user_id: int,
    org_id: int,
    *,
    activity_id: int | None = None,
    source_id: str | None = None,
    idempotency_key: str | None = None,
):
    profile, _tx, _level_up, _is_new = award_xp(
        db=db,
        user_id=user_id,
        org_id=org_id,
        source=XPSource.ACTIVITY_COMPLETION.value,
        amount=None,
        source_id=source_id
        if source_id is not None
        else (str(activity_id) if activity_id is not None else None),
        idempotency_key=idempotency_key,
    )
    # Only update streaks and counters if this call resulted in a new XP transaction
    if _is_new:
        profile = update_streak(db, user_id, org_id, StreakType.LEARNING.value)
        profile = get_profile(db, user_id, org_id)
        profile.total_activities_completed = (
            profile.total_activities_completed or 0
        ) + 1
        profile.updated_at = tz_now()
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def on_course_completed(
    db: Session,
    user_id: int,
    org_id: int,
    *,
    course_id: int | None = None,
    source_id: str | None = None,
    idempotency_key: str | None = None,
):
    profile, _tx, _level_up, _is_new = award_xp(
        db=db,
        user_id=user_id,
        org_id=org_id,
        source=XPSource.COURSE_COMPLETION.value,
        amount=None,
        source_id=source_id
        if source_id is not None
        else (str(course_id) if course_id is not None else None),
        idempotency_key=idempotency_key,
    )
    # Only update streaks and counters if this call resulted in a new XP transaction
    if _is_new:
        profile = update_streak(db, user_id, org_id, StreakType.LEARNING.value)
        profile = get_profile(db, user_id, org_id)
        profile.total_courses_completed = (profile.total_courses_completed or 0) + 1
        profile.updated_at = tz_now()
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
