"""Atomic XP awarding service with idempotency (clean minimal variant)."""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, and_, select

from src.core.timezone import now_local, today_local
from src.db.gamification import (
    UserGamificationProfile,
    UserGamificationProfileRead,
    XPAwardResponse,
    XPSource,
    XPTransaction,
    XPTransactionRead,
)
from src.db.gamification_events import EventType, GamificationEvent
from src.services.gamification.cache_service import create_cache_service
from src.services.gamification.config import get_gamification_config
from src.services.gamification.event_bus import EventBus, LevelUpEvent, XPAwardedEvent

from .level_calculator import calculate_level_details
from .result import Result

logger = logging.getLogger(__name__)


class XPService:
    def __init__(self, db_session: Session, event_bus: EventBus | None = None) -> None:
        self.db_session = db_session
        self.config = get_gamification_config()
        self.event_bus = event_bus

    async def award_xp(
        self,
        user_id: int,
        org_id: int,
        source: XPSource,
        source_id: str | None = None,
        metadata: dict[str, Any] | None = None,
        custom_amount: int | None = None,
        idempotency_key: str | None = None,
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

            # Daily reset
            if (
                profile.last_xp_award_date
                and profile.last_xp_award_date.date() != today_local()
            ):
                profile.daily_xp_earned = 0

            remaining_cap = max(
                0, self.config.daily_caps.max_daily_xp - profile.daily_xp_earned
            )
            if remaining_cap <= 0:
                return Result.fail("daily_cap")
            awarded = min(xp_amount, remaining_cap)

            prev_level = profile.current_level
            profile.total_xp += awarded
            profile.daily_xp_earned += awarded
            profile.last_xp_award_date = now_local()

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

            # Record events (best effort)
            try:
                await self._record_event(
                    EventType.XP_AWARDED,
                    user_id,
                    org_id,
                    f"profile:{profile.id}",
                    "user_profile",
                    {
                        "xp_amount": awarded,
                        "source": source.value,
                        "source_id": source_id,
                        "total_xp": profile.total_xp,
                        "previous_level": prev_level,
                        "new_level": profile.current_level,
                        "idempotency_key": idempotency_key,
                    },
                )
                if profile.current_level > prev_level:
                    await self._record_event(
                        EventType.LEVEL_UP,
                        user_id,
                        org_id,
                        f"profile:{profile.id}",
                        "user_profile",
                        {
                            "previous_level": prev_level,
                            "new_level": profile.current_level,
                            "total_xp": profile.total_xp,
                            "source": source.value,
                        },
                    )
                self.db_session.commit()
            except Exception:  # pragma: no cover
                self.db_session.rollback()
                logger.exception("event record failed")

            if self.event_bus:
                try:
                    await self.event_bus.emit(
                        XPAwardedEvent(
                            user_id=user_id,
                            org_id=org_id,
                            xp_amount=awarded,
                            source=source,
                            source_id=source_id,
                            total_xp=profile.total_xp,
                            previous_level=prev_level,
                            new_level=profile.current_level,
                            metadata=metadata,
                        )
                    )
                    if profile.current_level > prev_level:
                        await self.event_bus.emit(
                            LevelUpEvent(
                                user_id=user_id,
                                org_id=org_id,
                                previous_level=prev_level,
                                new_level=profile.current_level,
                                total_xp=profile.total_xp,
                                xp_source=source,
                                metadata=metadata,
                            )
                        )
                except Exception:  # pragma: no cover
                    logger.exception("event bus emit failed")

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
        return XPAwardResponse(
            transaction=XPTransactionRead.model_validate(tx, from_attributes=True),
            profile=UserGamificationProfileRead.model_validate(
                profile, from_attributes=True
            ),
            level_up_occurred=tx.triggered_level_up,
            previous_level=tx.previous_level,
            achievements_unlocked=None,
            is_new_transaction=is_new,
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

    async def _record_event(
        self,
        event_type: EventType,
        user_id: int,
        org_id: int,
        aggregate_id: str,
        aggregate_type: str,
        data: dict[str, Any],
    ) -> None:
        try:
            seq = (
                self.db_session.exec(
                    select(GamificationEvent).where(
                        GamificationEvent.aggregate_id == aggregate_id,
                        GamificationEvent.aggregate_type == aggregate_type,
                    )
                ).count()
                if hasattr(self.db_session, "exec")
                else 0
            )
        except Exception:
            seq = 0
        evt = GamificationEvent(
            event_type=event_type,
            aggregate_id=aggregate_id,
            aggregate_type=aggregate_type,
            sequence_number=seq,
            user_id=user_id,
            org_id=org_id,
            event_data=data,
        )
        self.db_session.add(evt)


def create_xp_service(
    db_session: Session, event_bus: EventBus | None = None
) -> XPService:
    return XPService(db_session, event_bus)
