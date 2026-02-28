"""
Thread-safe cache manager for AI services with proper TTL management.
"""

import asyncio
import inspect
import logging
from collections.abc import Awaitable, Callable
from threading import Lock
from typing import Any, TypeVar

from cachetools import TTLCache

from config.config import get_platform_config

logger = logging.getLogger(__name__)

T = TypeVar("T")


class ThreadSafeCache[T]:
    """Thread-safe cache with TTL support using cachetools."""

    def __init__(self, maxsize: int = 100, ttl: int = 3600) -> None:
        """
        Initialize thread-safe cache.

        Args:
            maxsize: Maximum number of items to store
            ttl: Time-to-live in seconds
        """
        self._cache: TTLCache[str, T] = TTLCache(maxsize=maxsize, ttl=ttl)
        self._lock = Lock()
        # Async lock to be used by async methods to avoid blocking the event loop
        self._async_lock = asyncio.Lock()
        self._hit_count = 0
        self._miss_count = 0

    def get(self, key: str) -> T | None:
        """
        Get item from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        with self._lock:
            try:
                value = self._cache[key]
                self._hit_count += 1
                logger.debug(f"Cache hit for key: {key}")
                return value
            except KeyError:
                self._miss_count += 1
                logger.debug(f"Cache miss for key: {key}")
                return None

    async def async_get(self, key: str) -> T | None:
        """Async-safe getter wrapper."""
        # Fast-path using sync get under thread lock to avoid blocking event loop
        return self.get(key)

    def set(self, key: str, value: T) -> None:
        """
        Set item in cache.

        Args:
            key: Cache key
            value: Value to cache
        """
        with self._lock:
            self._cache[key] = value
            logger.debug(f"Cached item with key: {key}")

    async def async_set(self, key: str, value: T) -> None:
        """Async-safe setter wrapper."""
        # Use thread-safe sync set to modify the underlying cache
        return await asyncio.to_thread(self.set, key, value)

    def delete(self, key: str) -> None:
        """
        Delete item from cache.

        Args:
            key: Cache key
        """
        with self._lock:
            try:
                del self._cache[key]
                logger.debug(f"Deleted cache entry: {key}")
            except KeyError:
                pass

    async def async_delete(self, key: str) -> None:
        """Async-safe delete wrapper."""
        return await asyncio.to_thread(self.delete, key)

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
            self._hit_count = 0
            self._miss_count = 0
            logger.info("Cache cleared")

    def get_stats(self) -> dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache stats
        """
        with self._lock:
            total_requests = self._hit_count + self._miss_count
            hit_rate = (
                (self._hit_count / total_requests * 100) if total_requests > 0 else 0
            )

            return {
                "size": len(self._cache),
                "maxsize": self._cache.maxsize,
                "hit_count": self._hit_count,
                "miss_count": self._miss_count,
                "hit_rate": f"{hit_rate:.2f}%",
                "ttl": self._cache.ttl,
            }

    async def get_or_set(
        self,
        key: str,
        factory: Callable[[], T | Awaitable[T]],
    ) -> T | None:
        """
        Get value from cache or compute and cache it.

        Args:
            key: Cache key
            factory: Callable to generate value if not cached

        Returns:
            Cached or newly computed value
        """
        # Fast-path cache check (use async_get for consistency)
        cached_value = await self.async_get(key)
        if cached_value is not None:
            return cached_value

        # Compute value (call factory - it may return an awaitable)
        try:
            value_or_awaitable = factory()

            if inspect.isawaitable(value_or_awaitable):
                value = await value_or_awaitable
            else:
                value = value_or_awaitable

            # Protect write path with async lock to avoid races
            async with self._async_lock:
                # Double-check cache in case of concurrent writer
                cached_value = await self.async_get(key)
                if cached_value is not None:
                    return cached_value

                if value is not None:
                    self.set(key, value)

                return value

        except Exception as e:
            logger.exception(f"Failed to compute value for key {key}: {e}")
            return None


class AICacheManager:
    """Centralized cache manager for all AI-related caches."""

    def __init__(self) -> None:
        """Initialize cache manager with separate caches for different data types."""

        platform_config = get_platform_config()
        vector_config = getattr(platform_config.ai_config, "vector_store", None)
        cache_config = getattr(platform_config.ai_config, "cache", None)

        vector_ttl = getattr(vector_config, "collection_retention", 86400)
        vector_maxsize = max(100, getattr(vector_config, "chromadb_pool_size", 10) * 10)

        embedding_ttl = getattr(cache_config, "embedding_cache_ttl", 7200)

        # Vector store cache - large TTL, smaller size
        self.vector_store_cache: ThreadSafeCache = ThreadSafeCache(
            maxsize=vector_maxsize,
            ttl=vector_ttl,
        )

        # Agent cache - medium TTL, medium size
        self.agent_cache: ThreadSafeCache = ThreadSafeCache(
            maxsize=100,
            ttl=1800,  # 30 minutes
        )

        # Database query cache - short TTL, larger size
        self.db_cache: ThreadSafeCache = ThreadSafeCache(
            maxsize=200,
            ttl=300,  # 5 minutes
        )

        # Embedding cache - long TTL, medium size
        self.embedding_cache: ThreadSafeCache = ThreadSafeCache(
            maxsize=100,
            ttl=embedding_ttl,
        )

        # LLM instance cache - long TTL, small size
        self.llm_cache: ThreadSafeCache = ThreadSafeCache(maxsize=10, ttl=embedding_ttl)

        logger.info("AI Cache Manager initialized")

    def clear_all(self) -> None:
        """Clear all caches."""
        self.vector_store_cache.clear()
        self.agent_cache.clear()
        self.db_cache.clear()
        self.embedding_cache.clear()
        self.llm_cache.clear()
        logger.info("All AI caches cleared")

    def get_all_stats(self) -> dict[str, Any]:
        """
        Get statistics for all caches.

        Returns:
            Dictionary with stats for each cache
        """
        return {
            "vector_store": self.vector_store_cache.get_stats(),
            "agent": self.agent_cache.get_stats(),
            "database": self.db_cache.get_stats(),
            "embedding": self.embedding_cache.get_stats(),
            "llm": self.llm_cache.get_stats(),
        }

    def invalidate_activity_cache(self, activity_uuid: str) -> None:
        """
        Invalidate all caches related to a specific activity.

        Args:
            activity_uuid: Activity UUID
        """
        # Clear related database cache
        self.db_cache.delete(f"activity_{activity_uuid}")

        # Clear vector store cache (activity-specific)
        # Note: This requires knowing the cache key format
        logger.info(f"Invalidated caches for activity: {activity_uuid}")


# Global cache manager instance
_cache_manager: AICacheManager | None = None


def get_ai_cache_manager() -> AICacheManager:
    """
    Get or create global AI cache manager instance.

    Returns:
        Global AICacheManager instance
    """
    global _cache_manager

    if _cache_manager is None:
        _cache_manager = AICacheManager()

    return _cache_manager
