"""
Gamification API Router

Provides endpoints for gamification features including:
- User gamification profiles
- XP transactions and history
- Streak tracking
- Leaderboards
- Dashboard data
"""

from typing import Annotated, Any, Optional
from datetime import datetime, timezone
import uuid

from fastapi import APIRouter, Depends, Query, Request, HTTPException, status
from sqlmodel import Session, select

from src.core.events.database import get_db_session
from src.db.gamification import (
    GamificationDashboard,
    OrganizationLeaderboard,
    UserGamificationProfileRead,
    UserGamificationPreference,
    UserGamificationPreferenceRead,
    UserGamificationPreferenceUpsert,
    XPAwardRequest,
    XPAwardResponse,
)
from src.db.users import AnonymousUser, PublicUser
from src.db.user_organizations import UserOrganization
from src.security.auth import get_current_user
from src.services.gamification import (
    get_gamification_dashboard,
    get_or_create_gamification_profile,
    get_organization_leaderboard,
    update_login_streak,
    award_xp,
    calculate_level_from_xp,
)
from src.shared.gamification_constants import XP_REWARDS

router = APIRouter()


def _serialize_profile(profile) -> dict[str, Any]:
    """Serialize DB profile to API contract expected by web app.

    Frontend currently expects: creation_date/update_date & xp_to_next_level.
    We keep DB field names intact and only transform the outbound shape.
    """
    # Support both SQLModel instance and already-dumped dict
    if isinstance(profile, dict):
        total_xp = profile.get("total_xp", 0)
        level, xp_to_next_level = calculate_level_from_xp(total_xp)
        return {
            "id": profile.get("id"),
            "user_id": profile.get("user_id"),
            "org_id": profile.get("org_id"),
            "total_xp": total_xp,
            "current_level": level,
            "xp_to_next_level": xp_to_next_level,
            "current_login_streak": profile.get("current_login_streak", 0),
            "longest_login_streak": profile.get("longest_login_streak", 0),
            "current_learning_streak": profile.get("current_learning_streak", 0),
            "longest_learning_streak": profile.get("longest_learning_streak", 0),
            "last_login_date": profile.get("last_login_date"),
            "last_learning_activity_date": profile.get("last_learning_activity_date"),
            "creation_date": profile.get("created_at") or profile.get("creation_date"),
            "update_date": profile.get("updated_at") or profile.get("update_date"),
            "profile_data": profile.get("profile_data", {}),
        }

    level, xp_to_next_level = calculate_level_from_xp(profile.total_xp)
    return {
        "id": profile.id,
        "user_id": profile.user_id,
        "org_id": profile.org_id,
        "total_xp": profile.total_xp,
        "current_level": level,  # ensure recalculated consistency
        "xp_to_next_level": xp_to_next_level,
        "current_login_streak": profile.current_login_streak,
        "longest_login_streak": profile.longest_login_streak,
        "current_learning_streak": profile.current_learning_streak,
        "longest_learning_streak": profile.longest_learning_streak,
        "last_login_date": profile.last_login_date,
        "last_learning_activity_date": profile.last_learning_activity_date,
        # Aliases for FE naming
        "creation_date": profile.created_at,
        "update_date": profile.updated_at,
        # Placeholder profile_data for future enrichment (keep consistent with FE type)
        "profile_data": {},
    }


def _serialize_transaction(tx) -> dict[str, Any]:
    """Map XPTransaction model to FE contract.

    Frontend expects: xp_source, xp_context, creation_date; we provide graceful fallbacks.
    """
    if isinstance(tx, dict):
        src = tx.get("source") or tx.get("xp_source")
        return {
            "id": tx.get("id"),
            "user_id": tx.get("user_id"),
            "org_id": tx.get("org_id"),
            "xp_amount": tx.get("xp_amount", 0),
            "xp_source": src,
            "xp_context": tx.get("transaction_metadata") or tx.get("xp_context") or {},
            "related_activity_id": tx.get("source_id"),
            "related_course_id": None,
            "related_trail_step_id": None,
            "creation_date": tx.get("created_at") or tx.get("creation_date"),
        }
    return {
        "id": tx.id,
        "user_id": tx.user_id,
        "org_id": tx.org_id,
        "xp_amount": tx.xp_amount,
        "xp_source": tx.source,
        "xp_context": tx.transaction_metadata or {},
        "related_activity_id": tx.source_id,
        "related_course_id": None,
        "related_trail_step_id": None,
        "creation_date": tx.created_at,
    }


async def verify_user_org_membership(
    user_id: int,
    org_id: int,
    db_session: Session
) -> bool:
    """Verify that user belongs to the organization."""
    membership = db_session.exec(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.org_id == org_id
        )
    ).first()
    return membership is not None


@router.get("/profile/{org_id}")
async def get_gamification_profile(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """Get user's gamification profile for organization."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization"
        )

    profile = await get_or_create_gamification_profile(
        current_user.id, org_id, db_session
    )

    return _serialize_profile(profile)


@router.post("/login-streak/{org_id}")
async def update_user_login_streak(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """Update user's login streak. Idempotent per day."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization"
        )

    profile = await update_login_streak(
        current_user.id, org_id, db_session
    )

    return _serialize_profile(profile)


@router.post("/award-xp/{org_id}")
async def award_user_xp(
    org_id: int,
    award_request: XPAwardRequest,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """
    Award XP to user with idempotency guarantees.
    Requires idempotency_key to prevent duplicate awards.
    """

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization"
        )

    # Generate idempotency key if not provided
    if not award_request.idempotency_key:
        award_request.idempotency_key = str(uuid.uuid4())

    response = await award_xp(current_user.id, org_id, award_request, db_session)
    # Return same schema but normalize embedded profile
    data = response.model_dump()
    data["profile_updated"] = _serialize_profile(data["profile_updated"])
    data["transaction"] = _serialize_transaction(data["transaction"])
    return data


@router.get("/dashboard/{org_id}")
async def get_user_gamification_dashboard(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> dict[str, Any]:
    """Get comprehensive gamification dashboard for user."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization"
        )

    dashboard = await get_gamification_dashboard(
        current_user.id, org_id, db_session
    )

    # Enrich profile in dashboard for FE parity
    dash_dict = dashboard.model_dump()
    dash_dict["profile"] = _serialize_profile(dashboard.profile)
    # Normalize transactions list name differences
    if "recent_transactions" in dash_dict:
        dash_dict["recent_xp_transactions"] = [
            _serialize_transaction(tx) for tx in dash_dict.pop("recent_transactions")
        ]
    return dash_dict


@router.get("/leaderboard/{org_id}", response_model=OrganizationLeaderboard)
async def get_org_leaderboard(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
    limit: int = Query(default=50, le=100, ge=1),
) -> OrganizationLeaderboard:
    """Get organization leaderboard."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization"
        )

    leaderboard = await get_organization_leaderboard(
        org_id, db_session, limit
    )

    return leaderboard


@router.get("/xp-rewards")
async def get_xp_rewards() -> dict[str, int]:
    """Get XP reward values for different actions."""
    return XP_REWARDS


@router.get("/level-metadata")
async def get_level_metadata() -> dict[str, Any]:
    """Get level calculation metadata and sample progression."""
    from src.shared.gamification_constants import BASE_XP_PER_LEVEL, XP_MULTIPLIER_PER_LEVEL
    from src.services.gamification import calculate_level_from_xp

    # Generate sample level progression
    sample_levels = []
    for level in range(1, 21):  # First 20 levels
        if level == 1:
            cumulative_xp = 0
        else:
            # Calculate XP needed for this level
            xp_needed = int(BASE_XP_PER_LEVEL * (XP_MULTIPLIER_PER_LEVEL ** (level - 1)))
            if level == 2:
                cumulative_xp = xp_needed
            else:
                prev_cumulative = sample_levels[-1]["cumulative_xp"]
                cumulative_xp = prev_cumulative + xp_needed

        sample_levels.append({
            "level": level,
            "xp_required": int(BASE_XP_PER_LEVEL * (XP_MULTIPLIER_PER_LEVEL ** (level - 1))) if level > 1 else 0,
            "cumulative_xp": cumulative_xp
        })

    return {
        "base_xp_per_level": BASE_XP_PER_LEVEL,
        "xp_multiplier_per_level": XP_MULTIPLIER_PER_LEVEL,
        "sample_levels": sample_levels,
        "calculation_note": "XP required for level N = BASE_XP * (MULTIPLIER ^ (N-1))"
    }


@router.get("/preferences/{org_id}", response_model=UserGamificationPreferenceRead)
async def get_gamification_preferences(
    org_id: int,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> UserGamificationPreferenceRead:
    """Get user's gamification preferences."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization"
        )

    # Get or create preferences
    prefs = db_session.exec(
        select(UserGamificationPreference).where(
            UserGamificationPreference.user_id == current_user.id,
            UserGamificationPreference.org_id == org_id
        )
    ).first()

    if not prefs:
        # Return default preferences
        default_prefs = {
            "notifications": {
                "levelUp": True,
                "xpGain": True,
                "streakReminder": False,
                "weeklyReport": True,
            },
            "privacy": {
                "showOnLeaderboard": True,
                "publicProfileStats": True,
                "shareProgress": False,
            },
            "display": {
                "animatedEffects": True,
                "compactMode": False,
                "showLevelIndicator": True,
                "autoHideToasts": False,
            },
        }

        return UserGamificationPreferenceRead(
            id=0,
            user_id=current_user.id,
            org_id=org_id,
            preferences=default_prefs,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    return UserGamificationPreferenceRead.model_validate(prefs)


@router.put("/preferences/{org_id}", response_model=UserGamificationPreferenceRead)
async def update_gamification_preferences(
    org_id: int,
    preferences_update: UserGamificationPreferenceUpsert,
    request: Request,
    current_user: Annotated[PublicUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> UserGamificationPreferenceRead:
    """Update user's gamification preferences."""

    # Verify user belongs to org
    if not await verify_user_org_membership(current_user.id, org_id, db_session):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization"
        )

    # Get existing preferences or create new
    existing_prefs = db_session.exec(
        select(UserGamificationPreference).where(
            UserGamificationPreference.user_id == current_user.id,
            UserGamificationPreference.org_id == org_id
        )
    ).first()

    if existing_prefs:
        # Update existing
        existing_prefs.preferences = preferences_update.preferences
        existing_prefs.updated_at = datetime.now(timezone.utc)
        db_session.add(existing_prefs)
    else:
        # Create new
        existing_prefs = UserGamificationPreference(
            user_id=current_user.id,
            org_id=org_id,
            preferences=preferences_update.preferences,
        )
        db_session.add(existing_prefs)

    db_session.commit()
    db_session.refresh(existing_prefs)

    return UserGamificationPreferenceRead.model_validate(existing_prefs)
