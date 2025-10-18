"""
ChromaDB connection pool for efficient resource management.
"""

import asyncio
import inspect
import logging
from contextlib import asynccontextmanager
from typing import Any

import chromadb
from chromadb.config import Settings

from config.config import get_openu_config

logger = logging.getLogger(__name__)


class ChromaDBPool:
    """Connection pool for ChromaDB with thread-safe operations."""

    def __init__(self, max_connections: int = 10) -> None:
        """
        Initialize ChromaDB connection pool.

        Args:
            max_connections: Maximum number of connections to maintain
        """
        self._pool: list[chromadb.Client] = []
        self._max_connections = max_connections
        self._lock = asyncio.Lock()
        self._total_created = 0
        self._settings = self._get_chromadb_settings()
        logger.info(f"Initialized ChromaDB pool with max {max_connections} connections")

    def _get_chromadb_settings(self) -> Settings:
        """Get ChromaDB settings from config."""
        return Settings(
            anonymized_telemetry=False,
            allow_reset=True,
            is_persistent=True,
        )

    def _create_client(self) -> chromadb.Client:
        """Create a new ChromaDB client instance."""
        try:
            config = get_openu_config()
            chromadb_config = getattr(config.ai_config, "chromadb_config", None)

            if (
                chromadb_config
                and isinstance(chromadb_config.db_host, str)
                and chromadb_config.db_host
                and getattr(chromadb_config, "isSeparateDatabaseEnabled", False)
            ):
                logger.info(
                    f"Creating ChromaDB client for host: {chromadb_config.db_host}"
                )
                try:
                    client = chromadb.HttpClient(
                        host=chromadb_config.db_host,
                        port=8000,
                        settings=self._settings,
                    )
                    # Test connection
                    client.heartbeat()
                    self._total_created += 1
                    logger.debug(f"Created ChromaDB HttpClient #{self._total_created}")
                    return client
                except Exception as remote_error:
                    logger.warning(f"Remote ChromaDB unavailable: {remote_error}")
                    logger.info("Falling back to ephemeral in-memory client")
            else:
                logger.info("Creating ephemeral in-memory ChromaDB client")

            # Create ephemeral in-memory client (no server needed)
            ephemeral_settings = Settings(
                anonymized_telemetry=False,
                allow_reset=True,
                is_persistent=False,  # In-memory only
            )
            client = chromadb.EphemeralClient(settings=ephemeral_settings)
            self._total_created += 1
            logger.debug(f"Created ChromaDB EphemeralClient #{self._total_created}")
            return client

        except Exception as e:
            logger.exception(f"Failed to create ChromaDB client: {e}")
            # Last resort: ephemeral client with minimal settings
            logger.warning("Using minimal ephemeral client as last resort")
            return chromadb.EphemeralClient()

    @asynccontextmanager
    async def get_client(self, cancel_event: asyncio.Event | None = None):
        """
        Get a ChromaDB client from the pool.

        Yields:
            ChromaDB client instance

        Usage:
            async with pool.get_client() as client:
                # Use client
                collection = client.get_collection("my_collection")
        """
        client = None
        async with self._lock:
            if self._pool:
                client = self._pool.pop()
                logger.debug(f"Reusing client from pool (pool size: {len(self._pool)})")
            else:
                # Creating Chroma clients can be blocking; perform in thread
                client = await asyncio.to_thread(self._create_client)
                logger.debug("Created new client (pool empty)")

        try:
            yield client
        finally:
            async with self._lock:
                if len(self._pool) < self._max_connections:
                    self._pool.append(client)
                    logger.debug(
                        f"Returned client to pool (pool size: {len(self._pool)})"
                    )
                else:
                    logger.debug("Pool full, discarding client")

    async def close_all(self) -> None:
        """Close all connections in the pool."""
        async with self._lock:
            while self._pool:
                client = self._pool.pop()
                try:
                    # Attempt graceful shutdown if available
                    close_fn = getattr(client, "close", None) or getattr(
                        client, "_shutdown", None
                    )
                    if callable(close_fn):
                        maybe = close_fn()
                        if inspect.isawaitable(maybe):
                            await maybe
                    # Otherwise rely on GC
                except Exception as e:
                    logger.warning(f"Error closing client: {e}")

            logger.info(f"Closed all connections. Total created: {self._total_created}")

    # (old close_all removed - graceful shutdown implementation above is used)

    def get_stats(self) -> dict[str, Any]:
        """
        Get pool statistics.

        Returns:
            Dictionary with pool stats
        """
        return {
            "pool_size": len(self._pool),
            "max_connections": self._max_connections,
            "total_created": self._total_created,
            "available": len(self._pool),
            "in_use": self._total_created - len(self._pool),
        }


# Global pool instance
_chromadb_pool: ChromaDBPool | None = None


def get_chromadb_pool() -> ChromaDBPool:
    """
    Get or create global ChromaDB pool instance.

    Returns:
        Global ChromaDBPool instance
    """
    global _chromadb_pool

    if _chromadb_pool is None:
        config = get_openu_config()
        pool_size = getattr(
            getattr(config.ai_config, "vector_store", None),
            "chromadb_pool_size",
            10,
        )
        _chromadb_pool = ChromaDBPool(max_connections=pool_size)
        logger.info(f"Created global ChromaDB pool with size {pool_size}")

    return _chromadb_pool


async def cleanup_chromadb_pool() -> None:
    """Cleanup function for ChromaDB pool."""
    global _chromadb_pool
    if _chromadb_pool:
        await _chromadb_pool.close_all()
        _chromadb_pool = None
        logger.info("ChromaDB pool cleaned up")
