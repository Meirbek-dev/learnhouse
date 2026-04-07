"""Redis helper utilities — sync and async — with safe fallback and JSON serialization.

Sync API (legacy, kept for non-request code paths):
- get_redis_client() -> Optional[redis.Redis]
- get_json(key) -> Optional[dict]
- set_json(key, dict, ttl_seconds)
- delete_keys(*keys)

Async API (used by auth request handlers):
- get_async_redis_client() -> Optional[redis.asyncio.Redis]

Design:
- Separate lazy-cached instances for sync and async clients
- Uses orjson if available for speed, falls back to json
- Swallows exceptions and logs — callers stay simple and robust
- Easy to patch in tests (patch get_redis_client / get_async_redis_client)
"""

from __future__ import annotations

import logging
from typing import Optional

try:
    import redis
    import redis.asyncio as aioredis
except Exception:  # pragma: no cover - environment without redis installed
    redis = None
    aioredis = None

try:
    import orjson as _orjson  # type: ignore

    def _dumps(o: object) -> bytes:  # type: ignore
        return _orjson.dumps(o)

    def _loads(b: bytes) -> object:  # type: ignore
        return _orjson.loads(b)

except Exception:  # pragma: no cover - orjson optional
    import json as _json

    def _dumps(o: object) -> bytes:  # type: ignore
        return _json.dumps(o, default=str).encode()

    def _loads(b: bytes) -> object:  # type: ignore
        return _json.loads(b.decode())


_logger = logging.getLogger(__name__)
_client: "redis.Redis | None" = None
_async_client: "aioredis.Redis | None" = None


def _get_redis_url() -> str | None:
    """Return the Redis connection URL from config, or None if not configured."""
    try:
        from config.config import get_settings

        cfg = get_settings()
        url = getattr(cfg.redis_config, "redis_connection_string", None)
        return url or None
    except Exception:
        _logger.debug("no platform config available for redis client")
        return None


def get_redis_client() -> "redis.Redis | None":
    """Return a cached synchronous Redis client, or None if not configured/available."""
    global _client
    if _client is not None:
        return _client

    if redis is None:
        _logger.debug("redis package not available")
        return None

    url = _get_redis_url()
    if not url:
        _logger.debug("no redis connection string configured")
        return None

    try:
        _client = redis.Redis.from_url(url)
        return _client
    except Exception as exc:
        _logger.exception("Failed to initialize sync redis client: %s", exc)
        _client = None
        return None


def get_async_redis_client() -> "aioredis.Redis | None":
    """Return a cached async Redis client, or None if not configured/available.

    This client must be used from async context (auth request handlers).
    It shares the same connection URL as the sync client but is a separate
    instance backed by asyncio-compatible connection pools.
    """
    global _async_client
    if _async_client is not None:
        return _async_client

    if aioredis is None:
        _logger.debug("redis.asyncio not available")
        return None

    url = _get_redis_url()
    if not url:
        _logger.debug("no redis connection string configured for async client")
        return None

    try:
        _async_client = aioredis.Redis.from_url(url, decode_responses=False)
        return _async_client
    except Exception as exc:
        _logger.exception("Failed to initialize async redis client: %s", exc)
        _async_client = None
        return None


def get_json(key: str) -> dict | None:
    r = get_redis_client()
    if not r:
        return None
    try:
        raw = r.get(key)
        if not raw:
            return None
        return _loads(raw)
    except Exception:
        _logger.exception("redis get_json failed for key=%s", key)
        return None


def set_json(key: str, value: object, ttl: int | None = None) -> None:
    r = get_redis_client()
    if not r:
        return
    try:
        payload = _dumps(value)
        if ttl:
            r.setex(key, ttl, payload)
        else:
            r.set(key, payload)
    except Exception:
        _logger.exception("redis set_json failed for key=%s", key)


def delete_keys(*keys: str) -> None:
    r = get_redis_client()
    if not r:
        return
    try:
        if keys:
            r.delete(*keys)
    except Exception:
        _logger.exception("redis delete_keys failed: %s", keys)
