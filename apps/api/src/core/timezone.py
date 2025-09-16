from __future__ import annotations

from datetime import UTC, datetime
from functools import lru_cache

from config.config import get_openu_config

"""Timezone utilities centralizing application-wide timezone (default Asia/Almaty).

We keep DB storage in UTC but business-day calculations (streaks, daily caps)
should use the configured local timezone (Kazakhstan Astana => Asia/Almaty).
"""

try:  # pragma: no cover - stdlib presence
    from zoneinfo import ZoneInfo  # Python 3.9+
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore


DEFAULT_TZ_NAME = "Asia/Almaty"


@lru_cache(maxsize=1)
def get_app_timezone_name() -> str:
    cfg = get_openu_config()
    return getattr(cfg.general_config, "timezone", None) or DEFAULT_TZ_NAME


@lru_cache(maxsize=1)
def get_app_timezone():  # returns ZoneInfo or None
    if ZoneInfo is None:
        return None
    name = get_app_timezone_name()
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo(DEFAULT_TZ_NAME)


def now_local() -> datetime:
    tz = get_app_timezone()
    if tz is None:
        # Fallback to naive UTC then treat as local
        return datetime.utcnow().replace(tzinfo=None)
    return datetime.now(tz)


def today_local() -> datetime.date:
    return now_local().date()


# --- UTC-first helpers (preferred for server-day logic) ---
def utc_now() -> datetime:
    return datetime.now(UTC)


def utc_date(dt: datetime) -> datetime.date:
    """Return the date in UTC for a given datetime.

    If dt is naive, treat it as UTC.
    """
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(UTC).date()
