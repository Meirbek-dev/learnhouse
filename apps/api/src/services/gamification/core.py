"""
Simplified Gamification Core

Thin wrapper around the service functions for backward compatibility.
All new code should use the simple_service functions directly.
"""

from sqlmodel import Session

from src.services.gamification import simple_service

# Export errors for backward compatibility
from src.services.gamification.simple_service import (
    DailyLimitExceededError,
    GamificationError,
)


def get_profile(db: Session, user_id: int, org_id: int):
    """Get or create user's gamification profile"""
    return simple_service.get_profile(db, user_id, org_id)


def award_xp(
    db: Session,
    user_id: int,
    org_id: int,
    source: str,
    source_id=None,
    custom_amount=None,
    idempotency_key=None,
):
    """Award XP to a user"""
    profile, level_up = simple_service.award_xp(
        db=db,
        user_id=user_id,
        org_id=org_id,
        source=source,
        amount=custom_amount,
        source_id=source_id,
        idempotency_key=idempotency_key,
    )

    # Create a fake transaction for backward compatibility
    from src.db.gamification import XPTransaction

    transaction = XPTransaction(
        user_id=user_id,
        org_id=org_id,
        amount=custom_amount or 0,
        source=source,
        source_id=source_id,
    )

    return profile, transaction, level_up


def update_streak(db: Session, user_id: int, org_id: int, streak_type: str):
    """Update user's streak"""
    profile = simple_service.update_streak(db, user_id, org_id, streak_type)
    return profile, getattr(profile, f"{streak_type}_streak", 0)


def get_leaderboard(db: Session, org_id: int, limit: int = 10):
    """Get organization leaderboard"""
    profiles = simple_service.get_leaderboard(db, org_id, limit)

    # Transform to expected format
    leaderboard = []
    for rank, profile in enumerate(profiles, 1):
        leaderboard.append(
            {
                "rank": rank,
                "user_id": profile.user_id,
                "total_xp": profile.total_xp,
                "current_level": profile.level,
                "username": None,  # Would need to join with users table
            }
        )

    return leaderboard


def get_recent_transactions(db: Session, user_id: int, org_id: int, limit: int = 10):
    """Get user's recent transactions"""
    return simple_service.get_recent_transactions(db, user_id, org_id, limit)


async def get_gamification_dashboard_result(user_id: int, org_id: int, db: Session):
    """Get complete dashboard data"""
    try:
        data = simple_service.get_dashboard_data(db, user_id, org_id)

        # Transform to expected format
        dashboard_data = {
            "profile": {
                "id": data["profile"].id,
                "user_id": data["profile"].user_id,
                "organization_id": data["profile"].org_id,
                "total_xp": data["profile"].total_xp,
                "level": data["profile"].level,
                "current_streak": data["profile"].login_streak,
                "longest_streak": data["profile"].longest_login_streak,
                "last_activity_date": data["profile"].last_login_date.isoformat()
                if data["profile"].last_login_date
                else None,
                "preferences": data["profile"].preferences,
                "created_at": data["profile"].created_at.isoformat(),
                "updated_at": data["profile"].updated_at.isoformat(),
            },
            "recent_transactions": [
                {
                    "id": tx.id,
                    "user_id": tx.user_id,
                    "organization_id": tx.org_id,
                    "amount": tx.amount,
                    "activity_type": tx.source.value,
                    "activity_id": tx.source_id,
                    "reason": tx.source.value,
                    "created_at": tx.created_at.isoformat(),
                }
                for tx in data["recent_transactions"]
            ],
            "leaderboard": {
                "organization_id": org_id,
                "period": "all_time",
                "entries": [
                    {
                        "user_id": profile.user_id,
                        "total_xp": profile.total_xp,
                        "level": profile.level,
                        "rank": rank + 1,
                    }
                    for rank, profile in enumerate(data["leaderboard"])
                ],
                "generated_at": None,
            },
            "streak_info": data["streak_info"],
        }

        return type(
            "DashboardResult", (), {"ok": True, "value": dashboard_data, "error": None}
        )()

    except Exception as e:
        return type(
            "DashboardResult", (), {"ok": False, "value": None, "error": str(e)}
        )()
