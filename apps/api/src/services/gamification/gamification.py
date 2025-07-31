"""
Gamification Service for LMS

Handles XP calculations, streak tracking, level progression, and all gamification logic.
Designed to be highly extensible for future features like badges, achievements, and challenges.
"""

from datetime import datetime, timedelta
from typing import Any

from fastapi import HTTPException, Request, status
from sqlmodel import Session, select

from src.db.gamification import (
    GamificationDashboard,
    OrganizationLeaderboard,
    StreakRecord,
    StreakRecordCreate,
    StreakRecordRead,
    StreakRecordUpdate,
    StreakTypeEnum,
    UserGamificationProfile,
    UserGamificationProfileCreate,
    UserGamificationProfileRead,
    UserGamificationProfileUpdate,
    XPTransaction,
    XPTransactionCreate,
    XPTransactionRead,
)
from src.db.users import AnonymousUser, PublicUser


# XP Constants - Easily configurable for balancing
XP_REWARDS = {
    "login_daily": 10,
    "activity_completion": 25,
    "course_completion": 100,
    "perfect_score": 50,  # Bonus for 100% on assignments
    "first_activity": 25,  # Bonus for first activity completion
    "streak_bonus_7_days": 50,
    "streak_bonus_30_days": 200,
    "streak_bonus_100_days": 1000,
}

# Level calculation constants
BASE_XP_PER_LEVEL = 100
XP_MULTIPLIER_PER_LEVEL = 1.2


def calculate_level_from_xp(total_xp: int) -> tuple[int, int]:
    """
    Calculate user level and XP needed for next level.

    Returns:
        tuple: (current_level, xp_to_next_level)
    """
    if total_xp <= 0:
        return 1, BASE_XP_PER_LEVEL

    level = 1
    xp_required = 0

    while True:
        xp_for_this_level = int(
            BASE_XP_PER_LEVEL * (XP_MULTIPLIER_PER_LEVEL ** (level - 1))
        )
        if xp_required + xp_for_this_level > total_xp:
            xp_to_next_level = xp_required + xp_for_this_level - total_xp
            return level, xp_to_next_level

        xp_required += xp_for_this_level
        level += 1

        # Safety limit to prevent infinite loops
        if level > 1000:
            return level, 0


def is_consecutive_day(last_date_str: str | None, current_date: datetime) -> bool:
    """
    Check if current date is consecutive to the last date.

    Args:
        last_date_str: ISO date string of last activity
        current_date: Current datetime

    Returns:
        bool: True if dates are consecutive days
    """
    if not last_date_str:
        return False

    try:
        last_date = datetime.fromisoformat(last_date_str.replace("Z", "+00:00"))
        # Convert to date only for comparison
        last_date_only = last_date.date()
        current_date_only = current_date.date()

        # Check if it's the next day
        return (current_date_only - last_date_only).days == 1
    except (ValueError, AttributeError):
        return False


def is_same_day(last_date_str: str | None, current_date: datetime) -> bool:
    """
    Check if current date is the same day as the last date.

    Args:
        last_date_str: ISO date string of last activity
        current_date: Current datetime

    Returns:
        bool: True if dates are the same day
    """
    if not last_date_str:
        return False

    try:
        last_date = datetime.fromisoformat(last_date_str.replace("Z", "+00:00"))
        return last_date.date() == current_date.date()
    except (ValueError, AttributeError):
        return False


async def get_or_create_gamification_profile(
    request: Request,
    user: PublicUser,
    org_id: int,
    db_session: Session,
) -> UserGamificationProfileRead:
    """
    Get existing gamification profile or create a new one for the user.

    Args:
        request: FastAPI request object
        user: Current user
        org_id: Organization ID
        db_session: Database session

    Returns:
        UserGamificationProfileRead: User's gamification profile
    """
    if isinstance(user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Anonymous users cannot access gamification features",
        )

    # Try to get existing profile
    statement = select(UserGamificationProfile).where(
        UserGamificationProfile.user_id == user.id,
        UserGamificationProfile.org_id == org_id,
    )
    profile = db_session.exec(statement).first()

    if profile:
        return UserGamificationProfileRead.model_validate(profile)

    # Create new profile
    profile_create = UserGamificationProfileCreate(user_id=user.id, org_id=org_id)

    new_profile = UserGamificationProfile(**profile_create.model_dump())
    db_session.add(new_profile)
    db_session.commit()
    db_session.refresh(new_profile)

    return UserGamificationProfileRead.model_validate(new_profile)


async def award_xp(
    request: Request,
    user: PublicUser,
    org_id: int,
    xp_amount: int,
    xp_source: str,
    db_session: Session,
    xp_context: dict[str, Any] | None = None,
    related_activity_id: int | None = None,
    related_course_id: int | None = None,
    related_trail_step_id: int | None = None,
) -> UserGamificationProfileRead:
    """
    Award XP to a user and update their profile.

    Args:
        request: FastAPI request object
        user: Current user
        org_id: Organization ID
        xp_amount: Amount of XP to award
        xp_source: Source of the XP (for tracking)
        xp_context: Additional context for the XP transaction
        related_activity_id: Optional related activity ID
        related_course_id: Optional related course ID
        related_trail_step_id: Optional related trail step ID
        db_session: Database session

    Returns:
        UserGamificationProfileRead: Updated gamification profile
    """
    if isinstance(user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Anonymous users cannot earn XP",
        )

    # Get or create profile
    profile = await get_or_create_gamification_profile(
        request, user, org_id, db_session
    )

    # Record XP transaction
    xp_transaction = XPTransactionCreate(
        user_id=user.id,
        org_id=org_id,
        xp_amount=xp_amount,
        xp_source=xp_source,
        xp_context=xp_context or {},
        related_activity_id=related_activity_id,
        related_course_id=related_course_id,
        related_trail_step_id=related_trail_step_id,
    )

    new_transaction = XPTransaction(**xp_transaction.model_dump())
    db_session.add(new_transaction)

    # Update profile
    new_total_xp = profile.total_xp + xp_amount
    new_level, xp_to_next_level = calculate_level_from_xp(new_total_xp)

    # Check for level up
    level_up = new_level > profile.current_level

    # Update profile in database
    statement = select(UserGamificationProfile).where(
        UserGamificationProfile.user_id == user.id,
        UserGamificationProfile.org_id == org_id,
    )
    db_profile = db_session.exec(statement).first()

    if db_profile:
        db_profile.total_xp = new_total_xp
        db_profile.current_level = new_level
        db_profile.xp_to_next_level = xp_to_next_level
        db_profile.update_date = str(datetime.now())

        # Add level up info to profile data if applicable
        if level_up:
            profile_data = db_profile.profile_data or {}
            profile_data["last_level_up"] = str(datetime.now())
            profile_data["levels_gained"] = profile_data.get("levels_gained", 0) + (
                new_level - profile.current_level
            )
            db_profile.profile_data = profile_data

        db_session.commit()
        db_session.refresh(db_profile)

        return UserGamificationProfileRead.model_validate(db_profile)

    return profile


async def update_login_streak(
    request: Request,
    user: PublicUser,
    org_id: int,
    db_session: Session,
) -> UserGamificationProfileRead:
    """
    Update user's login streak and award appropriate XP.

    Args:
        request: FastAPI request object
        user: Current user
        org_id: Organization ID
        db_session: Database session

    Returns:
        UserGamificationProfileRead: Updated gamification profile
    """
    if isinstance(user, AnonymousUser):
        return await get_or_create_gamification_profile(
            request, user, org_id, db_session
        )

    current_time = datetime.now()
    profile = await get_or_create_gamification_profile(
        request, user, org_id, db_session
    )

    # Check if user already logged in today
    if is_same_day(profile.last_login_date, current_time):
        return profile  # No streak update needed

    # Calculate new streak
    if is_consecutive_day(profile.last_login_date, current_time):
        # Continue streak
        new_streak = profile.current_login_streak + 1
    else:
        # Start new streak
        new_streak = 1

    # Update profile
    statement = select(UserGamificationProfile).where(
        UserGamificationProfile.user_id == user.id,
        UserGamificationProfile.org_id == org_id,
    )
    db_profile = db_session.exec(statement).first()

    if db_profile:
        db_profile.current_login_streak = new_streak
        db_profile.longest_login_streak = max(new_streak, profile.longest_login_streak)
        db_profile.last_login_date = current_time.isoformat()
        db_profile.update_date = str(current_time)

        db_session.commit()
        db_session.refresh(db_profile)

        # Award XP for daily login
        await award_xp(
            request=request,
            user=user,
            org_id=org_id,
            xp_amount=XP_REWARDS["login_daily"],
            xp_source="daily_login",
            xp_context={
                "streak_count": new_streak,
                "login_date": current_time.isoformat(),
            },
            db_session=db_session,
        )

        # Award streak bonuses
        if new_streak == 7:
            await award_xp(
                request=request,
                user=user,
                org_id=org_id,
                xp_amount=XP_REWARDS["streak_bonus_7_days"],
                xp_source="login_streak_7_days",
                xp_context={"streak_count": new_streak},
                db_session=db_session,
            )
        elif new_streak == 30:
            await award_xp(
                request=request,
                user=user,
                org_id=org_id,
                xp_amount=XP_REWARDS["streak_bonus_30_days"],
                xp_source="login_streak_30_days",
                xp_context={"streak_count": new_streak},
                db_session=db_session,
            )
        elif new_streak == 100:
            await award_xp(
                request=request,
                user=user,
                org_id=org_id,
                xp_amount=XP_REWARDS["streak_bonus_100_days"],
                xp_source="login_streak_100_days",
                xp_context={"streak_count": new_streak},
                db_session=db_session,
            )

        return UserGamificationProfileRead.model_validate(db_profile)

    return profile


async def update_learning_streak(
    request: Request,
    user: PublicUser,
    org_id: int,
    db_session: Session,
    activity_id: int | None = None,
    course_id: int | None = None,
) -> UserGamificationProfileRead:
    """
    Update user's learning streak when they complete an activity.

    Args:
        request: FastAPI request object
        user: Current user
        org_id: Organization ID
        activity_id: Optional activity ID that was completed
        course_id: Optional course ID
        db_session: Database session

    Returns:
        UserGamificationProfileRead: Updated gamification profile
    """
    if isinstance(user, AnonymousUser):
        return await get_or_create_gamification_profile(
            request, user, org_id, db_session
        )

    current_time = datetime.now()
    profile = await get_or_create_gamification_profile(
        request, user, org_id, db_session
    )

    # Check if user already had learning activity today
    if is_same_day(profile.last_learning_activity_date, current_time):
        # Still award XP for activity completion, but don't update streak
        await award_xp(
            request=request,
            user=user,
            org_id=org_id,
            xp_amount=XP_REWARDS["activity_completion"],
            xp_source="activity_completion",
            xp_context={
                "activity_id": activity_id,
                "course_id": course_id,
                "completion_date": current_time.isoformat(),
            },
            related_activity_id=activity_id,
            related_course_id=course_id,
            db_session=db_session,
        )
        return profile

    # Calculate new learning streak
    if is_consecutive_day(profile.last_learning_activity_date, current_time):
        # Continue streak
        new_streak = profile.current_learning_streak + 1
    else:
        # Start new streak
        new_streak = 1

    # Update profile
    statement = select(UserGamificationProfile).where(
        UserGamificationProfile.user_id == user.id,
        UserGamificationProfile.org_id == org_id,
    )
    db_profile = db_session.exec(statement).first()

    if db_profile:
        db_profile.current_learning_streak = new_streak
        db_profile.longest_learning_streak = max(
            new_streak, profile.longest_learning_streak
        )
        db_profile.last_learning_activity_date = current_time.isoformat()
        db_profile.update_date = str(current_time)

        db_session.commit()
        db_session.refresh(db_profile)

        # Award XP for activity completion
        await award_xp(
            request=request,
            user=user,
            org_id=org_id,
            xp_amount=XP_REWARDS["activity_completion"],
            xp_source="activity_completion",
            xp_context={
                "activity_id": activity_id,
                "course_id": course_id,
                "learning_streak": new_streak,
                "completion_date": current_time.isoformat(),
            },
            related_activity_id=activity_id,
            related_course_id=course_id,
            db_session=db_session,
        )

        return UserGamificationProfileRead.model_validate(db_profile)

    return profile


async def get_gamification_dashboard(
    request: Request,
    user: PublicUser,
    org_id: int,
    db_session: Session,
) -> GamificationDashboard:
    """
    Get comprehensive gamification dashboard data for a user.

    Args:
        request: FastAPI request object
        user: Current user
        org_id: Organization ID
        db_session: Database session

    Returns:
        GamificationDashboard: Complete gamification data
    """
    if isinstance(user, AnonymousUser):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Anonymous users cannot access gamification dashboard",
        )

    # Get profile
    profile = await get_or_create_gamification_profile(
        request, user, org_id, db_session
    )

    # Get recent XP transactions (last 10)
    xp_statement = (
        select(XPTransaction)
        .where(XPTransaction.user_id == user.id, XPTransaction.org_id == org_id)
        .order_by(XPTransaction.creation_date.desc())
        .limit(10)
    )

    xp_transactions = db_session.exec(xp_statement).all()
    xp_reads = [XPTransactionRead.model_validate(xp) for xp in xp_transactions]

    # Get active streaks
    streak_statement = select(StreakRecord).where(
        StreakRecord.user_id == user.id,
        StreakRecord.org_id == org_id,
        StreakRecord.is_active == True,
    )

    streaks = db_session.exec(streak_statement).all()
    streak_reads = [StreakRecordRead.model_validate(streak) for streak in streaks]

    # Get user's rank in organization (simplified for now)
    rank_statement = (
        select(UserGamificationProfile)
        .where(UserGamificationProfile.org_id == org_id)
        .order_by(UserGamificationProfile.total_xp.desc())
    )

    all_profiles = db_session.exec(rank_statement).all()
    rank_in_org = None
    for idx, prof in enumerate(all_profiles, 1):
        if prof.user_id == user.id:
            rank_in_org = idx
            break

    # Calculate total courses completed from all XP transactions (not just recent ones)
    total_courses_statement = select(XPTransaction).where(
        XPTransaction.user_id == user.id,
        XPTransaction.org_id == org_id,
        XPTransaction.xp_source == "course_completion"
    )
    course_completion_transactions = db_session.exec(total_courses_statement).all()
    total_courses_completed = len(course_completion_transactions)

    # Debug logging
    print(f"🐛 DEBUG: User ID: {user.id}, Org ID: {org_id}")
    print(f"🐛 DEBUG: Found {total_courses_completed} course completion transactions")
    for transaction in course_completion_transactions:
        print(f"🐛 DEBUG: Course completion XP transaction: {transaction.id}, XP: {transaction.xp_amount}, Date: {transaction.creation_date}")

    # Calculate total activities completed from all XP transactions (not just recent ones)
    total_activities_statement = select(XPTransaction).where(
        XPTransaction.user_id == user.id,
        XPTransaction.org_id == org_id,
        XPTransaction.xp_source == "activity_completion"
    )
    activity_completion_transactions = db_session.exec(total_activities_statement).all()
    total_activities_completed = len(activity_completion_transactions)
    print(f"🐛 DEBUG: Found {total_activities_completed} activity completion transactions")

    # Get total certificates for this user in this organization
    from src.db.courses.certifications import CertificateUser, Certifications
    from src.db.courses.courses import Course
    certificates_statement = select(CertificateUser).join(
        Certifications, CertificateUser.certification_id == Certifications.id
    ).join(
        Course, Certifications.course_id == Course.id
    ).where(
        CertificateUser.user_id == user.id,
        Course.org_id == org_id
    )
    certificate_records = db_session.exec(certificates_statement).all()
    total_certificates = len(certificate_records)
    print(f"🐛 DEBUG: Found {total_certificates} certificate records")
    for cert in certificate_records:
        print(f"🐛 DEBUG: Certificate: {cert.user_certification_uuid}, Created: {cert.created_at}")

    # Update profile data to include certificate count
    updated_profile_data = profile.profile_data.copy()
    updated_profile_data["total_certificates"] = total_certificates

    return GamificationDashboard(
        profile=profile,
        recent_xp_transactions=xp_reads,
        active_streaks=streak_reads,
        rank_in_organization=rank_in_org,
        total_activities_completed=total_activities_completed,
        total_courses_completed=total_courses_completed,
        total_certificates=total_certificates,
    )


async def get_organization_leaderboard(
    request: Request,
    org_id: int,
    db_session: Session,
    limit: int = 50,
) -> OrganizationLeaderboard:
    """
    Get organization-wide leaderboard.

    Args:
        request: FastAPI request object
        org_id: Organization ID
        limit: Maximum number of entries to return
        db_session: Database session

    Returns:
        OrganizationLeaderboard: Leaderboard data
    """
    from src.db.users import User

    # Get top users by XP with user profile data
    statement = (
        select(UserGamificationProfile, User)
        .join(User, UserGamificationProfile.user_id == User.id)
        .where(UserGamificationProfile.org_id == org_id)
        .order_by(UserGamificationProfile.total_xp.desc())
        .limit(limit)
    )

    results = db_session.exec(statement).all()

    # Convert to leaderboard entries with user profile data
    leaderboard_entries = []
    for idx, (profile, user) in enumerate(results, 1):
        leaderboard_entries.append(
            {
                "rank": idx,
                "user_id": profile.user_id,
                "total_xp": profile.total_xp,
                "current_level": profile.current_level,
                "current_login_streak": profile.current_login_streak,
                "current_learning_streak": profile.current_learning_streak,
                # User profile data
                "username": user.username,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "avatar_image": user.avatar_image,
                "user_uuid": user.user_uuid,
            }
        )

    # Get total participants count
    total_statement = select(UserGamificationProfile).where(
        UserGamificationProfile.org_id == org_id
    )
    total_participants = len(db_session.exec(total_statement).all())

    return OrganizationLeaderboard(
        org_id=org_id,
        leaderboard_entries=leaderboard_entries,
        total_participants=total_participants,
    )
