"""ETag utilities for gamification resources."""

from __future__ import annotations

import hashlib
from typing import Any


def make_profile_etag(profile_id: int, updated_at: str | None, total_xp: int) -> str:
    base = f"p:{profile_id}:{updated_at}:{total_xp}".encode()
    return hashlib.sha256(base).hexdigest()[:16]


def make_dashboard_etag(
    profile_id: int, updated_at: str | None, total_xp: int, recent_tx_hash: str
) -> str:
    base = f"d:{profile_id}:{updated_at}:{total_xp}:{recent_tx_hash}".encode()
    return hashlib.sha256(base).hexdigest()[:16]
