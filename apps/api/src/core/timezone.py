"""
Timezone utilities for OpenU

Provides a centralized way to get timezone-aware datetime objects
based on the configured timezone in config.yaml
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from config.config import get_openu_config

_CACHED_TIMEZONE: ZoneInfo | None = None


def get_timezone() -> ZoneInfo:
    """
    Get the configured timezone as a ZoneInfo object.

    Returns:
        ZoneInfo: Configured timezone (defaults to UTC if invalid)
    """
    global _CACHED_TIMEZONE

    if _CACHED_TIMEZONE is not None:
        return _CACHED_TIMEZONE

    config = get_openu_config()
    tz_name = config.general_config.timezone

    try:
        _CACHED_TIMEZONE = ZoneInfo(tz_name)
    except Exception:
        # Fallback to UTC if timezone is invalid
        _CACHED_TIMEZONE = ZoneInfo("UTC")

    return _CACHED_TIMEZONE


def now() -> datetime:
    """
    Get current datetime in the configured timezone.

    Returns:
        datetime: Current datetime with configured timezone
    """
    return datetime.now(get_timezone())


def utcnow() -> datetime:
    """
    Get current datetime in UTC.

    This is useful when you explicitly need UTC time
    regardless of the configured timezone.

    Returns:
        datetime: Current datetime in UTC
    """
    return datetime.now(timezone.utc)


def to_timezone(dt: datetime) -> datetime:
    """
    Convert a datetime to the configured timezone.

    Args:
        dt: datetime object to convert

    Returns:
        datetime: datetime in configured timezone
    """
    if dt.tzinfo is None:
        # If naive, assume UTC
        dt = dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(get_timezone())


def invalidate_cache() -> None:
    """
    Invalidate the cached timezone.
    Useful for testing or when config changes.
    """
    global _CACHED_TIMEZONE
    _CACHED_TIMEZONE = None
