"""
Gamification API Router

Provides endpoints for gamification features including:
- User gamification profiles
- XP transactions and history
- Streak tracking
- Leaderboards
- Dashboard data
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlmodel import Session

from src.core.events.database import get_db_session
from src.db.gamification import (
    GamificationDashboard,
    OrganizationLeaderboard,
    UserGamificationProfileRead,
)
from src.db.users import AnonymousUser, PublicUser
from src.security.auth import get_current_user
from src.services.gamification import (
    get_gamification_dashboard,
    get_or_create_gamification_profile,
    get_organization_leaderboard,
    update_login_streak,
)

router = APIRouter()


@router.get("/profile/{org_id}")
async def get_user_gamification_profile(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> UserGamificationProfileRead:
    """
    Get or create user's gamification profile for a specific organization.

    Returns:
        UserGamificationProfileRead: User's gamification profile
    """
    return await get_or_create_gamification_profile(
        request=request,
        user=current_user,
        org_id=org_id,
        db_session=db_session,
    )


@router.post("/login-streak/{org_id}")
async def update_user_login_streak(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> UserGamificationProfileRead:
    """
    Update user's login streak and award daily login XP.
    Should be called when user logs in.

    Returns:
        UserGamificationProfileRead: Updated gamification profile
    """
    return await update_login_streak(
        request=request,
        user=current_user,
        org_id=org_id,
        db_session=db_session,
    )


@router.get("/dashboard/{org_id}")
async def get_user_gamification_dashboard(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
) -> GamificationDashboard:
    """
    Get comprehensive gamification dashboard data for the user.

    Returns:
        GamificationDashboard: Complete gamification data including profile,
                              recent transactions, streaks, and statistics
    """
    return await get_gamification_dashboard(
        request=request,
        user=current_user,
        org_id=org_id,
        db_session=db_session,
    )


@router.get("/leaderboard/{org_id}")
async def get_org_leaderboard(
    request: Request,
    org_id: int,
    current_user: Annotated[PublicUser | AnonymousUser, Depends(get_current_user)],
    db_session: Annotated[Session, Depends(get_db_session)],
    limit: int = 50,
) -> OrganizationLeaderboard:
    """
    Get organization-wide leaderboard showing top users by XP.

    Args:
        org_id: Organization ID
        limit: Maximum number of entries to return (default: 50)

    Returns:
        OrganizationLeaderboard: Leaderboard data with rankings and stats
    """
    return await get_organization_leaderboard(
        request=request,
        org_id=org_id,
        db_session=db_session,
        limit=limit,
    )


@router.get("/xp-rewards")
async def get_xp_reward_structure() -> dict[str, int]:
    """
    Get the current XP reward structure for transparency.

    Returns:
        dict: XP rewards for different actions
    """
    from src.services.gamification import XP_REWARDS

    return XP_REWARDS
