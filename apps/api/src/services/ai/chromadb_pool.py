"""
ChromaDB connection pool for efficient resource management.
"""

import asyncio
import inspect
import logging
from contextlib import asynccontextmanager
from threading import Lock
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import chromadb
    from chromadb.config import Settings

from config.config import get_platform_config

logger = logging.getLogger(__name__)


class ChromaDBPool:
    """Connection pool for ChromaDB with thread-safe operations.

    Design:
    - Remote ChromaDB (HttpClient): a bounded pool of connections is maintained
      so concurrent requests reuse existing HTTP connections.
    - In-process ephemeral: a **single shared EphemeralClient singleton** is
      used. ChromaDB's EphemeralClient creates a completely isolated in-memory
      database per instance, so pooling multiple EphemeralClients would give
      every checkout a *different* database, breaking collection reuse entirely.
    """

    def __init__(self, max_connections: int = 10) -> None:
        self._pool: list["chromadb.Client"] = []
        self._max_connections = max_connections
        # Lazy-initialised inside the running event loop to avoid binding the
        # lock to the wrong loop when __init__ is called before asyncio.run().
        self._loop_lock: asyncio.Lock | None = None
        self._total_created = 0
        # Single shared EphemeralClient — all callers share one in-memory DB.
        self._ephemeral_singleton: "chromadb.Client | None" = None
        self._ephemeral_lock = Lock()  # thread lock for singleton creation
        logger.info(
            "Initialized ChromaDB pool with max %d connections", max_connections
        )

    @property
    def _lock(self) -> asyncio.Lock:
        """Return (or create) the async lock inside the running event loop."""
        if self._loop_lock is None:
            self._loop_lock = asyncio.Lock()
        return self._loop_lock

    def _get_chromadb_settings(self) -> "Settings":
        from chromadb.config import Settings

        return Settings(
            anonymized_telemetry=False, allow_reset=True, is_persistent=True
        )

    def _is_remote_mode(self) -> bool:
        """Return True when an external ChromaDB server is configured."""
        config = get_platform_config()
        chromadb_config = getattr(config.ai_config, "chromadb_config", None)
        return bool(
            chromadb_config
            and isinstance(chromadb_config.db_host, str)
            and chromadb_config.db_host
            and getattr(chromadb_config, "isSeparateDatabaseEnabled", False)
        )

    def _create_http_client(self) -> "chromadb.Client":
        """Create a new HTTP client to the remote ChromaDB server."""
        import chromadb

        config = get_platform_config()
        chromadb_config = config.ai_config.chromadb_config
        port = getattr(chromadb_config, "db_port", 8001)
        logger.info(
            "Creating ChromaDB HttpClient for %s:%d", chromadb_config.db_host, port
        )
        try:
            client = chromadb.HttpClient(
                host=chromadb_config.db_host,
                port=port,
                settings=self._get_chromadb_settings(),
            )
            client.heartbeat()  # fail fast if server is unreachable
            self._total_created += 1
            logger.debug("Created ChromaDB HttpClient #%d", self._total_created)
            return client
        except Exception as e:
            logger.warning(
                "Remote ChromaDB unavailable (%s); falling back to ephemeral", e
            )
            return self._get_or_create_ephemeral_singleton()

    def _get_or_create_ephemeral_singleton(self) -> "chromadb.Client":
        """Return the single shared EphemeralClient, creating it on first call."""
        if self._ephemeral_singleton is not None:
            return self._ephemeral_singleton
        with self._ephemeral_lock:
            if self._ephemeral_singleton is None:
                import chromadb
                from chromadb.config import Settings

                settings = Settings(
                    anonymized_telemetry=False,
                    allow_reset=True,
                    is_persistent=False,
                )
                self._ephemeral_singleton = chromadb.EphemeralClient(settings=settings)
                self._total_created += 1
                logger.info("Created shared ChromaDB EphemeralClient singleton")
        return self._ephemeral_singleton

    @asynccontextmanager
    async def get_client(self, cancel_event: asyncio.Event | None = None):
        """Yield a ChromaDB client.

        - Ephemeral mode: yields the shared singleton directly (no pool overhead).
        - Remote mode: checks out a pooled HttpClient, returning it afterwards.

        Usage::

            async with pool.get_client() as client:
                collection = client.get_or_create_collection("my_collection")
        """
        if not self._is_remote_mode():
            # In-process mode — yield the singleton; never "return" it to a pool.
            client = await asyncio.to_thread(self._get_or_create_ephemeral_singleton)
            yield client
            return

        # Remote / pooled mode
        client = None
        async with self._lock:
            if self._pool:
                client = self._pool.pop()
                logger.debug("Reusing HttpClient from pool (size: %d)", len(self._pool))

        if client is None:
            client = await asyncio.to_thread(self._create_http_client)

        try:
            yield client
        finally:
            async with self._lock:
                if len(self._pool) < self._max_connections:
                    self._pool.append(client)
                else:
                    logger.debug("Pool full, discarding HttpClient")

    async def close_all(self) -> None:
        """Close pooled connections and reset the ephemeral singleton."""
        async with self._lock:
            while self._pool:
                client = self._pool.pop()
                try:
                    close_fn = getattr(client, "close", None) or getattr(
                        client, "_shutdown", None
                    )
                    if callable(close_fn):
                        maybe = close_fn()
                        if inspect.isawaitable(maybe):
                            await maybe
                except Exception as e:
                    logger.warning("Error closing client: %s", e)

        with self._ephemeral_lock:
            self._ephemeral_singleton = None

        logger.info("Closed all connections. Total created: %d", self._total_created)

    def get_stats(self) -> dict[str, Any]:
        return {
            "pool_size": len(self._pool),
            "max_connections": self._max_connections,
            "total_created": self._total_created,
            "available": len(self._pool),
            "in_use": self._total_created - len(self._pool),
            "has_ephemeral_singleton": self._ephemeral_singleton is not None,
        }


# Global pool instance
_chromadb_pool: ChromaDBPool | None = None
_chromadb_pool_lock = Lock()


def get_chromadb_pool() -> ChromaDBPool:
    """
    Get or create global ChromaDB pool instance.

    Returns:
        Global ChromaDBPool instance
    """
    global _chromadb_pool

    if _chromadb_pool is None:
        with _chromadb_pool_lock:
            if _chromadb_pool is None:
                config = get_platform_config()
                pool_size = getattr(
                    getattr(config.ai_config, "vector_store", None),
                    "chromadb_pool_size",
                    10,
                )
                _chromadb_pool = ChromaDBPool(max_connections=pool_size)
                logger.info("Created global ChromaDB pool with size %d", pool_size)

    return _chromadb_pool


async def cleanup_chromadb_pool() -> None:
    """Cleanup function for ChromaDB pool."""
    global _chromadb_pool
    if _chromadb_pool:
        await _chromadb_pool.close_all()
        _chromadb_pool = None
        logger.info("ChromaDB pool cleaned up")
