"""Lightweight cache abstraction (in-memory default).

Provides a minimal interface we can later back with Redis. All TTLs in seconds.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Optional, Protocol


class CacheClient(Protocol):
    def get(self, key: str) -> Any | None: ...
    def set(self, key: str, value: Any, ttl: int | None = None) -> None: ...
    def delete(self, key: str) -> None: ...


@dataclass
class _Entry:
    value: Any
    expires_at: float | None


class InMemoryCache(CacheClient):
    def __init__(self) -> None:
        self._store: dict[str, _Entry] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if not entry:
            return None
        if entry.expires_at and entry.expires_at < time.time():
            self._store.pop(key, None)
            return None
        return entry.value

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        expires = time.time() + ttl if ttl else None
        self._store[key] = _Entry(value=value, expires_at=expires)

    def delete(self, key: str) -> None:
        self._store.pop(key, None)


_global_cache: InMemoryCache | None = None


def get_cache() -> InMemoryCache:
    global _global_cache
    if _global_cache is None:
        _global_cache = InMemoryCache()
    return _global_cache
