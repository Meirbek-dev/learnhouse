"""Simple event outbox processor for gamification events.

Uses `gamification_events` table as an outbox. Events with status=PENDING are
fetched in small batches, dispatched to the in-process EventBus (if provided),
and then marked COMPLETED (or FAILED with retry_count incremented).

This is a lightweight reliability layer; a production system would likely
separate storage from delivery transport and include exponential backoff.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

from sqlmodel import Session, select

from src.db.gamification_events import EventStatus, EventType, GamificationEvent
from src.services.gamification.event_bus import (
    AchievementUnlockedEvent,
    BadgeEarnedEvent,
    EventBus,
    LevelUpEvent,
    StreakMilestoneEvent,
    XPAwardedEvent,
)

logger = logging.getLogger(__name__)

# Map EventType -> factory returning an EventBus event instance
_EVENT_FACTORIES = {
    EventType.XP_AWARDED: lambda e: XPAwardedEvent(
        user_id=e.user_id,
        org_id=e.org_id,
        xp_amount=e.event_data.get("xp_amount", 0),
        source=e.event_data.get("source"),
        source_id=e.event_data.get("source_id"),
        total_xp=e.event_data.get("total_xp", 0),
        previous_level=e.event_data.get("previous_level", 0),
        new_level=e.event_data.get("new_level", 0),
        metadata=e.event_data,
    ),
    EventType.LEVEL_UP: lambda e: LevelUpEvent(
        user_id=e.user_id,
        org_id=e.org_id,
        previous_level=e.event_data.get("previous_level", 0),
        new_level=e.event_data.get("new_level", 0),
        total_xp=e.event_data.get("total_xp", 0),
        xp_source=e.event_data.get("source"),
        metadata=e.event_data,
    ),
    EventType.STREAK_MILESTONE: lambda e: StreakMilestoneEvent(
        user_id=e.user_id,
        org_id=e.org_id,
        streak_type=e.event_data.get("streak_type", ""),
        streak_count=e.event_data.get("streak_count", 0),
        bonus_xp=e.event_data.get("bonus_xp", 0),
        metadata=e.event_data,
    ),
    EventType.ACHIEVEMENT_UNLOCKED: lambda e: AchievementUnlockedEvent(
        user_id=e.user_id,
        org_id=e.org_id,
        achievement_code=e.event_data.get("achievement_key", ""),
        achievement_id=e.event_data.get("achievement_id"),
        xp_reward=e.event_data.get("xp_reward", 0),
        total_xp=e.event_data.get("total_xp", 0),
        new_level=e.event_data.get("new_level", 0),
        metadata=e.event_data,
    ),
    EventType.BADGE_EARNED: lambda e: BadgeEarnedEvent(
        user_id=e.user_id,
        org_id=e.org_id,
        badge_code=e.event_data.get("badge_key", ""),
        badge_id=e.event_data.get("badge_id"),
        metadata=e.event_data,
    ),
}


async def process_outbox(
    db_session: Session,
    event_bus: EventBus | None = None,
    batch_size: int = 50,
    max_retries: int = 5,
) -> int:
    """Process pending outbox events.

    Returns number of successfully dispatched events.
    """
    stmt = (
        select(GamificationEvent)
        .where(GamificationEvent.status == EventStatus.PENDING)
        .order_by(GamificationEvent.id.asc())
        .limit(batch_size)
    )
    events = list(db_session.exec(stmt).all())
    dispatched = 0

    for evt in events:
        factory = _EVENT_FACTORIES.get(evt.event_type)
        if not factory:
            # Mark completed if no runtime consumer; prevents perpetual retry
            evt.status = EventStatus.COMPLETED
            evt.processed_at = datetime.now(UTC)
            db_session.add(evt)
            continue
        if not event_bus:
            # Without a bus we still mark as completed (idempotent replay window could be added later)
            evt.status = EventStatus.COMPLETED
            evt.processed_at = datetime.now(UTC)
            db_session.add(evt)
            dispatched += 1
            continue
        try:
            bus_event = factory(evt)
            await event_bus.emit(bus_event)
            evt.status = EventStatus.COMPLETED
            evt.processed_at = datetime.now(UTC)
            db_session.add(evt)
            dispatched += 1
        except Exception:  # pragma: no cover
            logger.exception("Failed dispatching outbox event %s", evt.event_id)
            evt.status = (
                EventStatus.RETRYING
                if evt.retry_count + 1 < max_retries
                else EventStatus.FAILED
            )
            evt.retry_count += 1
            evt.error_message = "Dispatch failure"
            db_session.add(evt)

    if events:
        try:
            db_session.commit()
        except Exception:  # pragma: no cover
            db_session.rollback()
            logger.exception("Failed committing outbox changes")

    return dispatched
