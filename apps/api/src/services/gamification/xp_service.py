"""Atomic XP awarding service with idempotency (clean minimal variant)."""

from __future__ import annotations

import logging
from typing import Any

from datetime import UTC, datetime
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, and_, select

# Use UTC server time for deterministic calculations
from src.db.gamification import (
    UserGamificationProfile,
    UserGamificationProfileRead,
    XPAwardResponse,
    XPSource,
    XPTransaction,
    XPTransactionRead,
)
from src.services.gamification.cache_service import create_cache_service
from src.services.gamification.config import get_gamification_config

from .level_calculator import calculate_level_details
from .result import Result

logger = logging.getLogger(__name__)


class XPService:
    def __init__(self, db_session: Session) -> None:
        self.db_session = db_session
        self.config = get_gamification_config()

    async def award_xp(
        self,
        user_id: int,
        org_id: int,
        source: XPSource,
        source_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        custom_amount: int | None = None,
        idempotency_key: str | None = None,
        admin_user_id: int | None = None,
    ) -> Result[XPAwardResponse]:
        metadata = metadata or {}
        try:
            profile = await self._get_or_create_profile(user_id, org_id)
            # Best effort lock
            try:
                self.db_session.exec(
                    text(
                        "SELECT id FROM user_gamification_profiles WHERE id=:id FOR UPDATE"
                    ),
                    {"id": profile.id},
                )
            except Exception:  # pragma: no cover
                pass

            # Idempotency by key
            if idempotency_key:
                existing = self.db_session.exec(
                    select(XPTransaction).where(
                        XPTransaction.idempotency_key == idempotency_key
                    )
                ).first()
                if existing:
                    return Result.success(
                        await self._build_response(profile, existing, is_new=False)
                    )

            # Semantic idempotency
            if source_id:
                dup = self.db_session.exec(
                    select(XPTransaction).where(
                        and_(
                            XPTransaction.user_id == user_id,
                            XPTransaction.org_id == org_id,
                            XPTransaction.source == source,
                            XPTransaction.source_id == source_id,
                        )
                    )
                ).first()
                if dup:
                    return Result.success(
                        await self._build_response(profile, dup, is_new=False)
                    )

            xp_amount = self.config.xp_rewards.get_reward(source, custom_amount)
            if xp_amount <= 0:
                return Result.fail("invalid_amount")

            # Calculate today's awarded XP from transactions to enforce cap
            # Use UTC server-day semantics consistently
            now_utc = datetime.now(UTC)
            today = now_utc.date()
            start_ts = datetime.combine(today, datetime.min.time(), tzinfo=UTC)
            end_ts = datetime.combine(today, datetime.max.time(), tzinfo=UTC)
            # Reset profile.daily_xp_earned if last award was on a previous day
            try:
                if profile.last_xp_award_date and profile.last_xp_award_date.date() != today:
                    profile.daily_xp_earned = 0
            except Exception:
                pass
            # Use SUM aggregate rather than loading all rows
            try:
                from sqlalchemy import func
                today_sum = (
                    self.db_session.exec(
                        select(func.coalesce(func.sum(XPTransaction.xp_amount), 0)).where(
                            and_(
                                XPTransaction.user_id == user_id,
                                XPTransaction.org_id == org_id,
                                XPTransaction.created_at >= start_ts,
                                XPTransaction.created_at <= end_ts,
                            )
                        )
                    ).one()
                )
                # today_sum may be a scalar or tuple depending on driver
                today_sum = int(today_sum[0] if isinstance(today_sum, tuple) else today_sum)
            except Exception:
                today_sum = profile.daily_xp_earned or 0

            remaining_cap = max(0, self.config.daily_caps.max_daily_xp - today_sum)
            if remaining_cap <= 0:
                return Result.fail("daily_cap")
            awarded = min(xp_amount, remaining_cap)

            prev_level = profile.current_level
            profile.total_xp += awarded
            profile.daily_xp_earned += awarded
            profile.last_xp_award_date = now_utc

            lvl = calculate_level_details(profile.total_xp)
            profile.current_level = lvl["level"]
            profile.xp_in_level = lvl["xp_in_level"]
            profile.xp_to_next_level = lvl["xp_to_next"]
            profile.level_progress_percent = lvl["progress"] * 100

            tx = XPTransaction(
                user_id=user_id,
                org_id=org_id,
                xp_amount=awarded,
                source=source,
                source_id=source_id,
                idempotency_key=idempotency_key,
                transaction_metadata=metadata,
                previous_level=prev_level,
                new_level=profile.current_level,
                triggered_level_up=profile.current_level > prev_level,
                created_by_admin=bool(admin_user_id) if source == XPSource.ADMIN_AWARD else False,
                admin_user_id=admin_user_id if source == XPSource.ADMIN_AWARD else None,
            )
            self.db_session.add(tx)
            self.db_session.add(profile)
            try:
                self.db_session.commit()
            except IntegrityError:
                self.db_session.rollback()
                # Recheck idempotency after race
                if idempotency_key:
                    existing = self.db_session.exec(
                        select(XPTransaction).where(
                            XPTransaction.idempotency_key == idempotency_key
                        )
                    ).first()
                    if existing:
                        return Result.success(
                            await self._build_response(profile, existing, is_new=False)
                        )
                if source_id:
                    dup = self.db_session.exec(
                        select(XPTransaction).where(
                            and_(
                                XPTransaction.user_id == user_id,
                                XPTransaction.org_id == org_id,
                                XPTransaction.source == source,
                                XPTransaction.source_id == source_id,
                            )
                        )
                    ).first()
                    if dup:
                        return Result.success(
                            await self._build_response(profile, dup, is_new=False)
                        )
                return Result.fail("integrity_error")

            # No outbox/event-bus side effects in the simplified core path

            return Result.success(await self._build_response(profile, tx, is_new=True))
        except Exception as e:  # pragma: no cover
            self.db_session.rollback()
            logger.exception("award_xp failed: %s", e)
            return Result.fail("internal_error")
        finally:
            # Ensure cache is refreshed with latest profile after any attempt if commit succeeded earlier
            try:  # pragma: no cover - best effort cache refresh
                if "profile" in locals() and getattr(profile, "id", None):
                    cache = create_cache_service()
                    cache.set_profile(user_id, org_id, profile)
            except Exception:  # pragma: no cover
                logger.debug("profile cache refresh failed", exc_info=True)

    async def get_user_xp_summary(self, user_id: int, org_id: int) -> Result[dict]:
        try:
            profile = await self._get_or_create_profile(user_id, org_id)
            return Result.success(
                {
                    "user_id": user_id,
                    "org_id": org_id,
                    "total_xp": profile.total_xp,
                    "current_level": profile.current_level,
                    "daily": {
                        "earned": profile.daily_xp_earned,
                        "limit": profile.daily_xp_limit,
                    },
                }
            )
        except Exception as e:  # pragma: no cover
            logger.exception("xp summary failed: %s", e)
            return Result.fail("internal_error")

    async def _build_response(
        self, profile: UserGamificationProfile, tx: XPTransaction, is_new: bool
    ) -> XPAwardResponse:
        # Determine whether default config XP was used or a custom amount (admin)
        custom_amt = None
        try:
            meta = getattr(tx, "transaction_metadata", {}) or {}
            if isinstance(meta, dict) and "custom_amount" in meta:
                custom_amt = int(meta.get("custom_amount") or 0) or None
        except Exception:
            custom_amt = None
        used_default = (tx.source != XPSource.ADMIN_AWARD) or (custom_amt is None)

        return XPAwardResponse(
            transaction=XPTransactionRead.model_validate(tx, from_attributes=True),
            profile=UserGamificationProfileRead.model_validate(
                profile, from_attributes=True
            ),
            level_up_occurred=tx.triggered_level_up,
            previous_level=tx.previous_level,
            achievements_unlocked=None,
            is_new_transaction=is_new,
            used_default_xp=used_default,
            used_custom_amount=custom_amt,
        )

    async def _get_or_create_profile(
        self, user_id: int, org_id: int
    ) -> UserGamificationProfile:
        stmt = select(UserGamificationProfile).where(
            and_(
                UserGamificationProfile.user_id == user_id,
                UserGamificationProfile.org_id == org_id,
            )
        )
        profile = self.db_session.exec(stmt).first()
        if profile:
            return profile
        profile = UserGamificationProfile(user_id=user_id, org_id=org_id)
        self.db_session.add(profile)
        self.db_session.commit()
        self.db_session.refresh(profile)
        return profile

def create_xp_service(db_session: Session) -> XPService:
    return XPService(db_session)
