"""Thin cache adapter."""

from __future__ import annotations

from typing import Any

from .cache_client import InMemoryCache, get_cache

PROFILE_TTL = 30  # seconds (authoritative)
LEADERBOARD_TTL = 15


class CacheService:
    def __init__(self, backend: InMemoryCache | None = None) -> None:
        self.backend = backend or get_cache()
        self.hits = 0
        self.misses = 0

    # generic helpers -------------------------------------------------
    def get(self, key: str) -> Any | None:
        value = self.backend.get(key)
        if value is None:
            self.misses += 1
        else:
            self.hits += 1
        return value

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        self.backend.set(key, value, ttl)

    def delete(self, key: str) -> None:
        self.backend.delete(key)

    # domain specific convenience ------------------------------------
    def get_profile(self, user_id: int, org_id: int) -> Any | None:
        return self.get(f"profile:{org_id}:{user_id}")

    def set_profile(self, user_id: int, org_id: int, data: Any) -> None:
        self.set(f"profile:{org_id}:{user_id}", data, PROFILE_TTL)

    def get_leaderboard(self, org_id: int, limit: int) -> Any | None:
        return self.get(f"leaderboard:{org_id}:{limit}")

    def set_leaderboard(self, org_id: int, limit: int, data: Any) -> None:
        self.set(f"leaderboard:{org_id}:{limit}", data, LEADERBOARD_TTL)


_cache_service_singleton: CacheService | None = None


def create_cache_service() -> CacheService:  # single current factory
    global _cache_service_singleton
    if _cache_service_singleton is None:
        _cache_service_singleton = CacheService()
    return _cache_service_singleton
