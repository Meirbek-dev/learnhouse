"""ETag utilities for gamification resources."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any


def _norm_ts(ts: str | datetime | None) -> str:
    if ts is None:
        return ""
    if isinstance(ts, datetime):
        # Normalize to ISO-8601 in UTC
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=UTC)
        return ts.astimezone(UTC).isoformat()
    return ts


def make_profile_etag(
    profile_id: int, updated_at: str | datetime | None, total_xp: int
) -> str:
    base = f"p:{profile_id}:{_norm_ts(updated_at)}:{total_xp}".encode()
    return hashlib.sha256(base).hexdigest()[:16]


def make_dashboard_etag(
    profile_id: int,
    updated_at: str | datetime | None,
    total_xp: int,
    recent_tx_hash: str,
) -> str:
    base = f"d:{profile_id}:{_norm_ts(updated_at)}:{total_xp}:{recent_tx_hash}".encode()
    return hashlib.sha256(base).hexdigest()[:16]
