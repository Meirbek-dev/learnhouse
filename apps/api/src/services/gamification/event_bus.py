"""Minimal in-process event dispatcher for gamification (clean version)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class BaseEvent:
    user_id: int
    org_id: int
    occurred_at: datetime = datetime.now(UTC)
    metadata: dict[str, Any] | None = None


@dataclass(slots=True)
class XPAwardedEvent(BaseEvent):
    xp_amount: int = 0
    source: Any | None = None
    source_id: str | None = None
    total_xp: int = 0
    previous_level: int = 0
    new_level: int = 0


@dataclass(slots=True)
class LevelUpEvent(BaseEvent):
    previous_level: int = 0
    new_level: int = 0
    total_xp: int = 0
    xp_source: Any | None = None


@dataclass(slots=True)
class StreakMilestoneEvent(BaseEvent):
    streak_type: str = ""
    streak_count: int = 0
    bonus_xp: int = 0


@dataclass(slots=True)
class AchievementUnlockedEvent(BaseEvent):
    achievement_code: str = ""
    achievement_id: int | None = None
    xp_reward: int = 0
    total_xp: int = 0
    new_level: int = 0


@dataclass(slots=True)
class BadgeEarnedEvent(BaseEvent):
    badge_code: str = ""
    badge_id: int | None = None


EventHandler = Callable[[BaseEvent], Awaitable[None]]


class EventDispatcher:
    def __init__(self) -> None:
        self._subs: dict[type, list[EventHandler]] = {}

    def subscribe(self, event_type: type, handler: EventHandler) -> None:
        self._subs.setdefault(event_type, []).append(handler)

    async def emit(self, event: BaseEvent) -> None:
        handlers = list(self._subs.get(type(event), []))
        if not handlers:
            return

        async def _run(h: EventHandler) -> None:  # fire concurrently, isolate failures
            try:  # pragma: no cover - defensive
                await h(event)
            except Exception:
                logger.exception(
                    "Event handler failed for %s via %s", type(event).__name__, h
                )

        await asyncio.gather(*(_run(h) for h in handlers), return_exceptions=True)


EventBus = EventDispatcher


def create_event_bus() -> EventBus:
    """Factory returning a new in-process event bus.

    Kept minimal intentionally; can be swapped with a distributed implementation
    (Redis, NATS, Kafka) behind same interface later.
    """
    return EventDispatcher()
